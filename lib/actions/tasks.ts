"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import {
  createTaskInputSchema,
  taskStatusSchema,
  type TaskActionState,
  type TaskInput,
} from "@/lib/validations/tasks";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { TaskPriority, TaskStatus } from "@/types/database";

/**
 * Task server actions.
 *
 * Security model:
 *  - `organization_id` and `created_by` are NEVER read from the payload —
 *    they come exclusively from `getCurrentUserContext()`, so a caller can
 *    only touch rows inside their own organization.
 *  - Viewing requires `tasks.view`; creating/editing/deleting requires
 *    `tasks.manage`. Status-only changes additionally allow a view-only
 *    member to move tasks assigned to themselves.
 *  - Updates and deletes verify the task belongs to the caller's
 *    organization in the same statement (RLS backstops this, but we never
 *    rely on frontend-only checks).
 *  - Input is re-validated with Zod server-side (schema shared with the
 *    client forms).
 */

export interface TaskPerson {
  id: string;
  fullName: string | null;
  email: string | null;
}

export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: TaskPerson;
  assignedTo: TaskPerson | null;
}

export interface TaskFilter {
  status?: TaskStatus;
  assignedTo?: string;
}

/** Raw joined row shape coming back from PostgREST. */
interface TaskJoinRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  created_by: { id: string; full_name: string | null; email: string | null }[];
  assigned_to:
    | { id: string; full_name: string | null; email: string | null }[]
    | null;
}

type TaskAuthResult =
  | { ok: true; organizationId: string; userId: string }
  | { ok: false; error: TaskActionState };

/**
 * Verifies the session, the caller's organization, and that the caller
 * holds the given task permission.
 */
async function requireTaskPermission(
  permission: "tasks.view" | "tasks.manage"
): Promise<TaskAuthResult> {
  const userContext = await getCurrentUserContext();
  const dict = await getDictionary();
  const err = dict.platform.tasks.errors;

  if (!userContext) {
    return {
      ok: false,
      error: { status: "error", error: err.signedIn },
    };
  }

  if (!hasPermission(permission, userContext.permissions)) {
    return {
      ok: false,
      error: {
        status: "error",
        error: err.noPermission,
      },
    };
  }

  const organizationId = userContext.organization?.id;

  if (!organizationId) {
    return {
      ok: false,
      error: {
        status: "error",
        error: err.noOrg,
      },
    };
  }

  return {
    ok: true,
    organizationId,
    userId: userContext.user.id,
  };
}

function parseFieldErrors(
  issues: z.ZodIssue[]
): TaskActionState["fieldErrors"] {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string") {
      (fieldErrors[key] ??= []).push(issue.message);
    }
  }
  return fieldErrors;
}

function toTaskRow(row: TaskJoinRow): TaskRow {
  // PostgREST may return a single object or an array for a to-one join.
  const creator = Array.isArray(row.created_by)
    ? row.created_by[0]
    : (row.created_by as unknown as TaskJoinRow["created_by"][number]);
  const assigneeRows = Array.isArray(row.assigned_to)
    ? row.assigned_to
    : row.assigned_to
      ? [
          row.assigned_to as unknown as NonNullable<
            TaskJoinRow["assigned_to"]
          >[number],
        ]
      : null;

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status as TaskStatus,
    priority: row.priority as TaskPriority,
    dueDate: row.due_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: {
      id: creator.id,
      fullName: creator.full_name ?? null,
      email: creator.email ?? null,
    },
    assignedTo: assigneeRows?.[0]
      ? {
          id: assigneeRows[0].id,
          fullName: assigneeRows[0].full_name ?? null,
          email: assigneeRows[0].email ?? null,
        }
      : null,
  };
}

/**
 * Retrieves the current organization's tasks, optionally narrowed by
 * status and/or assignee. Requires `tasks.view`.
 */
export async function getTasks(
  filter?: TaskFilter
): Promise<TaskRow[] | null> {
  const userContext = await getCurrentUserContext();

  if (!userContext || !hasPermission("tasks.view", userContext.permissions)) {
    return null;
  }

  const organizationId = userContext.organization?.id;
  if (!organizationId) {
    return null;
  }

  const supabase = await createServerClient();

  let query = supabase
    .from("tasks")
    .select(
      `
        id,
        title,
        description,
        status,
        priority,
        due_date,
        created_at,
        updated_at,
        created_by:profiles!fk_tasks_created_by(id, full_name, email),
        assigned_to:profiles!fk_tasks_assigned_to(id, full_name, email)
      `
    )
    .eq("organization_id", organizationId);

  if (filter?.status) {
    query = query.eq("status", filter.status);
  }

  if (filter?.assignedTo) {
    query = query.eq("assigned_to", filter.assignedTo);
  }

  query = query.order("created_at", { ascending: true });

  const { data, error } = await query;

  if (error || !data) {
    console.error("[tasks] fetch failed:", error?.message ?? "no rows");
    return null;
  }

  return (data as unknown as TaskJoinRow[]).map(toTaskRow);
}

/**
 * Creates a task in the current organization. Requires `tasks.manage`.
 * The creator (`created_by`) and `organization_id` come from the session.
 */
export async function createTask(data: TaskInput): Promise<TaskActionState> {
  const auth = await requireTaskPermission("tasks.manage");
  if (!auth.ok) return auth.error;

  const dict = await getDictionary();
  const err = dict.platform.tasks.errors;
  const parsed = createTaskInputSchema(dict.platform.tasks.errors).safeParse(data);
  if (!parsed.success) {
    return {
      status: "error",
      error: err.highlightFields,
      fieldErrors: parseFieldErrors(parsed.error.issues),
    };
  }

  const { title, description, status, priority, assignedTo, dueDate } =
    parsed.data;

  const supabase = await createServerClient();

  const { error } = await supabase
    .from("tasks")
    .insert({
      organization_id: auth.organizationId,
      title,
      description: description || null,
      status,
      priority,
      assigned_to: assignedTo || null,
      created_by: auth.userId,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
    });

  if (error) {
    console.error("[tasks] create failed:", error.message);
    return {
      status: "error",
      error: err.createFailed,
    };
  }

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  return { status: "success" };
}
/**
 * Updates only a task's status. Members with `tasks.manage` may move any
 * task; view-only members may move tasks assigned to themselves. The task
 * must belong to the caller's organization (checked in the same statement).
 */
export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus
): Promise<TaskActionState> {
  const userContext = await getCurrentUserContext();
  const dict = await getDictionary();
  const err = dict.platform.tasks.errors;

  if (!userContext) {
    return {
      status: "error",
      error: err.signedIn,
    };
  }

  const organizationId = userContext.organization?.id;
  if (!organizationId) {
    return {
      status: "error",
      error: err.noOrg,
    };
  }

  const canManage = hasPermission("tasks.manage", userContext.permissions);
  const canView = hasPermission("tasks.view", userContext.permissions);

  if (!canManage && !canView) {
    return {
      status: "error",
      error: err.noPermission,
    };
  }

  if (!taskId) {
    return { status: "error", error: err.missingId };
  }

  // Re-validate the status server-side even though the client is typed.
  const parsedStatus = taskStatusSchema.safeParse(status);
  if (!parsedStatus.success) {
    return { status: "error", error: err.invalidStatus };
  }

  const supabase = await createServerClient();

  // View-only members are limited to tasks assigned to themselves.
  if (!canManage) {
    const { data: task } = await supabase
      .from("tasks")
      .select("assigned_to")
      .eq("id", taskId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (!task || task.assigned_to !== userContext.user.id) {
      return {
        status: "error",
        error: err.onlyOwnStatus,
      };
    }
  }

  const { data: updated, error } = await supabase
    .from("tasks")
    .update({
      status: parsedStatus.data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .eq("organization_id", organizationId)
    .select("id");

  if (error) {
    console.error("[tasks] status update failed:", error.message);
    return {
      status: "error",
      error: err.updateFailed,
    };
  }

  if (!updated || updated.length === 0) {
    return {
      status: "error",
      error: err.notFound,
    };
  }

  revalidatePath("/tasks");
  return { status: "success" };
}

/**
 * Updates an existing task's details. Requires `tasks.manage`. The task
 * must belong to the caller's organization (checked in the same statement).
 */
export async function updateTask(
  taskId: string,
  data: Partial<TaskInput>
): Promise<TaskActionState> {
  const auth = await requireTaskPermission("tasks.manage");
  if (!auth.ok) return auth.error;

  const dict = await getDictionary();
  const err = dict.platform.tasks.errors;

  if (!taskId) {
    return { status: "error", error: err.missingId };
  }

  const parsed = createTaskInputSchema(err).partial().safeParse(data);
  if (!parsed.success) {
    return {
      status: "error",
      error: err.highlightFields,
      fieldErrors: parseFieldErrors(parsed.error.issues),
    };
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.description !== undefined) {
    updates.description = parsed.data.description || null;
  }
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.priority !== undefined) {
    updates.priority = parsed.data.priority;
  }
  if (parsed.data.assignedTo !== undefined) {
    updates.assigned_to = parsed.data.assignedTo || null;
  }
  if (parsed.data.dueDate !== undefined) {
    updates.due_date = parsed.data.dueDate
      ? new Date(parsed.data.dueDate).toISOString()
      : null;
  }

  const supabase = await createServerClient();

  const { data: updated, error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", taskId)
    .eq("organization_id", auth.organizationId)
    .select("id");

  if (error) {
    console.error("[tasks] update failed:", error.message);
    return {
      status: "error",
      error: err.updateFailed,
    };
  }

  if (!updated || updated.length === 0) {
    return {
      status: "error",
      error: err.notFound,
    };
  }

  revalidatePath("/tasks");
  return { status: "success" };
}
/**
 * Deletes a task. Requires `tasks.manage`. The task must belong to the
 * caller's organization (checked in the same statement).
 */
export async function deleteTask(taskId: string): Promise<TaskActionState> {
  const auth = await requireTaskPermission("tasks.manage");
  if (!auth.ok) return auth.error;

  const dict = await getDictionary();
  const err = dict.platform.tasks.errors;

  if (!taskId) {
    return { status: "error", error: err.missingId };
  }

  const supabase = await createServerClient();

  const { data: deleted, error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("organization_id", auth.organizationId)
    .select("id");

  if (error) {
    console.error("[tasks] delete failed:", error.message);
    return {
      status: "error",
      error: err.deleteFailed,
    };
  }

  if (!deleted || deleted.length === 0) {
    return {
      status: "error",
      error: err.notFound,
    };
  }

  revalidatePath("/tasks");
  return { status: "success" };
}