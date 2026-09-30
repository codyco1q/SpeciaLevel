"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import {
  createTaskInputSchema,
  taskCommentInputSchema,
  taskStatusSchema,
  type TaskActionState,
  type TaskInput,
} from "@/lib/validations/tasks";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { RichTextBlock, TaskPriority, TaskStatus } from "@/types/database";

export interface TaskPerson {
  id: string;
  fullName: string | null;
  email: string | null;
  avatarUrl?: string | null;
}

export interface TaskCommentRow {
  id: string;
  taskId: string;
  organizationId: string;
  userId: string;
  content: string;
  createdAt: string;
  author: TaskPerson;
}

export interface TaskRow {
  id: string;
  parentId: string | null;
  title: string;
  description: string | null;
  descriptionText: string;
  descriptionJson: RichTextBlock[];
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  startDate: string | null;
  estimatedHours: number | null;
  tags: string[];
  isDoc: boolean;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
  createdBy: TaskPerson | null;
  assignedTo: TaskPerson | null;
  isClientVisible: boolean;
  subtasks?: TaskRow[];
  commentsCount?: number;
}

export interface TaskFilter {
  isDoc?: boolean;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignedTo?: string;
  parentId?: string | null;
}

interface RawTaskJoinRow {
  id: string;
  parent_id: string | null;
  title: string;
  description?: string | null;
  description_text?: string | null;
  description_json?: RichTextBlock[] | null;
  status: string;
  priority: string;
  due_date: string | null;
  start_date: string | null;
  estimated_hours: number | null;
  tags: string[] | null;
  is_doc: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
  is_client_visible?: boolean;
  created_by?: { id: string; full_name: string | null; email: string | null; avatar_url?: string | null } | { id: string; full_name: string | null; email: string | null; avatar_url?: string | null }[] | null;
  assigned_to?: { id: string; full_name: string | null; email: string | null; avatar_url?: string | null } | { id: string; full_name: string | null; email: string | null; avatar_url?: string | null }[] | null;
}

type TaskAuthResult =
  | { ok: true; organizationId: string; userId: string; permissions: string[] }
  | { ok: false; error: TaskActionState };

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
    permissions: userContext.permissions,
  };
}

function parseFieldErrors(
  issues: z.ZodIssue[]
): TaskActionState["fieldErrors"] {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string") {
      (fieldErrors[key as keyof TaskInput] ??= []).push(issue.message);
    }
  }
  return fieldErrors;
}

function normalizePerson(
  raw: RawTaskJoinRow["created_by"] | RawTaskJoinRow["assigned_to"]
): TaskPerson | null {
  if (!raw) return null;
  const item = Array.isArray(raw) ? raw[0] : raw;
  if (!item || !item.id) return null;
  return {
    id: item.id,
    fullName: item.full_name ?? null,
    email: item.email ?? null,
    avatarUrl: item.avatar_url ?? null,
  };
}

function toTaskRow(row: RawTaskJoinRow): TaskRow {
  const descText = row.description_text || row.description || "";
  const descJson: RichTextBlock[] = Array.isArray(row.description_json)
    ? row.description_json
    : [];

  return {
    id: row.id,
    parentId: row.parent_id ?? null,
    title: row.title,
    description: descText || null,
    descriptionText: descText,
    descriptionJson: descJson,
    status: (row.status as TaskStatus) || "todo",
    priority: (row.priority as TaskPriority) || "medium",
    dueDate: row.due_date,
    startDate: row.start_date,
    estimatedHours: row.estimated_hours !== null ? Number(row.estimated_hours) : null,
    tags: Array.isArray(row.tags) ? row.tags : [],
    isDoc: Boolean(row.is_doc),
    orderIndex: row.order_index ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isClientVisible: Boolean(row.is_client_visible),
    createdBy: normalizePerson(row.created_by),
    assignedTo: normalizePerson(row.assigned_to),
  };
}

/**
 * Lists tasks (and docs) in caller's organization.
 */
export async function getTasks(filter?: TaskFilter): Promise<TaskRow[]> {
  const auth = await requireTaskPermission("tasks.view");
  if (!auth.ok) return [];

  const supabase = await createServerClient();

  let query = supabase
    .from("tasks")
    .select(
      `
      id,
      parent_id,
      title,
      description,
      description_text,
      description_json,
      status,
      priority,
      due_date,
      start_date,
      estimated_hours,
      tags,
      is_doc,
      order_index,
      created_at,
      updated_at,
      is_client_visible,
      created_by:profiles!fk_tasks_created_by(id, full_name, email, avatar_url),
      assigned_to:profiles!fk_tasks_assigned_to(id, full_name, email, avatar_url)
    `
    )
    .eq("organization_id", auth.organizationId)
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: false });

  if (filter?.isDoc !== undefined) {
    query = query.eq("is_doc", filter.isDoc);
  }
  if (filter?.status) {
    query = query.eq("status", filter.status);
  }
  if (filter?.priority) {
    query = query.eq("priority", filter.priority);
  }
  if (filter?.assignedTo) {
    query = query.eq("assigned_to", filter.assignedTo);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[tasks] getTasks failed:", error.message);
    return [];
  }

  const allRows: TaskRow[] = (data ?? []).map((r) =>
    toTaskRow(r as unknown as RawTaskJoinRow)
  );

  const { data: commentsData } = await supabase
    .from("task_comments")
    .select("task_id")
    .eq("organization_id", auth.organizationId);

  const commentCountMap = new Map<string, number>();
  if (commentsData) {
    for (const c of commentsData) {
      commentCountMap.set(c.task_id, (commentCountMap.get(c.task_id) ?? 0) + 1);
    }
  }

  for (const row of allRows) {
    row.commentsCount = commentCountMap.get(row.id) ?? 0;
  }

  const taskMap = new Map<string, TaskRow>();
  const rootTasks: TaskRow[] = [];

  for (const item of allRows) {
    item.subtasks = [];
    taskMap.set(item.id, item);
  }

  for (const item of allRows) {
    if (item.parentId && taskMap.has(item.parentId)) {
      const parent = taskMap.get(item.parentId)!;
      parent.subtasks = parent.subtasks || [];
      parent.subtasks.push(item);
    } else {
      rootTasks.push(item);
    }
  }

  return rootTasks;
}

/**
 * Get single task by ID with subtasks and full details.
 */
export async function getTaskById(taskId: string): Promise<TaskRow | null> {
  const auth = await requireTaskPermission("tasks.view");
  if (!auth.ok) return null;

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(
      `
      id,
      parent_id,
      title,
      description,
      description_text,
      description_json,
      status,
      priority,
      due_date,
      start_date,
      estimated_hours,
      tags,
      is_doc,
      order_index,
      created_at,
      updated_at,
      is_client_visible,
      created_by:profiles!fk_tasks_created_by(id, full_name, email, avatar_url),
      assigned_to:profiles!fk_tasks_assigned_to(id, full_name, email, avatar_url)
    `
    )
    .eq("id", taskId)
    .eq("organization_id", auth.organizationId)
    .single();

  if (error || !data) return null;

  const task = toTaskRow(data as unknown as RawTaskJoinRow);

  const { data: subtaskData } = await supabase
    .from("tasks")
    .select(
      `
      id,
      parent_id,
      title,
      description_text,
      description_json,
      status,
      priority,
      due_date,
      start_date,
      estimated_hours,
      tags,
      is_doc,
      order_index,
      created_at,
      updated_at,
      created_by:profiles!fk_tasks_created_by(id, full_name, email, avatar_url),
      assigned_to:profiles!fk_tasks_assigned_to(id, full_name, email, avatar_url)
    `
    )
    .eq("parent_id", taskId)
    .eq("organization_id", auth.organizationId)
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  task.subtasks = (subtaskData ?? []).map((r) =>
    toTaskRow(r as unknown as RawTaskJoinRow)
  );

  return task;
}

/**
 * Creates a new task, subtask, or document.
 */
export async function createTask(
  data: Partial<TaskInput>
): Promise<TaskActionState> {
  const auth = await requireTaskPermission("tasks.manage");
  if (!auth.ok) return auth.error;

  const dict = await getDictionary();
  const err = dict.platform.tasks.errors;

  const parsed = createTaskInputSchema(err).safeParse(data);
  if (!parsed.success) {
    return {
      status: "error",
      error: err.highlightFields,
      fieldErrors: parseFieldErrors(parsed.error.issues),
    };
  }

  const supabase = await createServerClient();
  const descText = parsed.data.descriptionText || parsed.data.description || "";
  const descJson = parsed.data.descriptionJson || [];

  const payload: Record<string, unknown> = {
    organization_id: auth.organizationId,
    created_by: auth.userId,
    title: parsed.data.title,
    description: descText,
    description_text: descText,
    description_json: descJson,
    status: parsed.data.status,
    priority: parsed.data.priority,
    assigned_to: parsed.data.assignedTo || null,
    parent_id: parsed.data.parentId || null,
    due_date: parsed.data.dueDate
      ? new Date(parsed.data.dueDate).toISOString()
      : null,
    start_date: parsed.data.startDate
      ? new Date(parsed.data.startDate).toISOString()
      : null,
    estimated_hours: parsed.data.estimatedHours,
    tags: parsed.data.tags || [],
    is_doc: parsed.data.isDoc || false,
    order_index: parsed.data.orderIndex ?? 0,
  };

  const { data: inserted, error } = await supabase
    .from("tasks")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    console.error("[tasks] create failed:", error.message);
    return {
      status: "error",
      error: err.createFailed,
    };
  }

  revalidatePath("/tasks");
  return { status: "success", taskId: inserted?.id };
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
 * Updates an existing task's details. Requires `tasks.manage`.
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
  if (parsed.data.descriptionText !== undefined) {
    updates.description_text = parsed.data.descriptionText;
    updates.description = parsed.data.descriptionText;
  } else if (parsed.data.description !== undefined) {
    updates.description = parsed.data.description;
    updates.description_text = parsed.data.description;
  }
  if (parsed.data.descriptionJson !== undefined) {
    updates.description_json = parsed.data.descriptionJson;
  }
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.priority !== undefined) updates.priority = parsed.data.priority;
  if (parsed.data.assignedTo !== undefined) updates.assigned_to = parsed.data.assignedTo || null;
  if (parsed.data.parentId !== undefined) updates.parent_id = parsed.data.parentId || null;
  if (parsed.data.dueDate !== undefined) {
    updates.due_date = parsed.data.dueDate ? new Date(parsed.data.dueDate).toISOString() : null;
  }
  if (parsed.data.startDate !== undefined) {
    updates.start_date = parsed.data.startDate ? new Date(parsed.data.startDate).toISOString() : null;
  }
  if (parsed.data.estimatedHours !== undefined) {
    updates.estimated_hours = parsed.data.estimatedHours;
  }
  if (parsed.data.tags !== undefined) updates.tags = parsed.data.tags;
  if (parsed.data.isDoc !== undefined) updates.is_doc = parsed.data.isDoc;
  if (parsed.data.orderIndex !== undefined) updates.order_index = parsed.data.orderIndex;

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
 * Deletes a task. Requires `tasks.manage`.
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

/**
 * Reorders tasks in batch (for drag and drop).
 */
export async function reorderTasks(
  items: { id: string; orderIndex: number; status?: TaskStatus }[]
): Promise<TaskActionState> {
  const auth = await requireTaskPermission("tasks.manage");
  if (!auth.ok) return auth.error;

  const supabase = await createServerClient();

  for (const item of items) {
    const payload: Record<string, unknown> = {
      order_index: item.orderIndex,
      updated_at: new Date().toISOString(),
    };
    if (item.status) {
      payload.status = item.status;
    }
    await supabase
      .from("tasks")
      .update(payload)
      .eq("id", item.id)
      .eq("organization_id", auth.organizationId);
  }

  revalidatePath("/tasks");
  return { status: "success" };
}

/**
 * Comments CRUD.
 */
export async function getTaskComments(taskId: string): Promise<TaskCommentRow[]> {
  const auth = await requireTaskPermission("tasks.view");
  if (!auth.ok) return [];

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("task_comments")
    .select(
      `
      id,
      task_id,
      organization_id,
      user_id,
      content,
      created_at,
      author:profiles!fk_task_comments_user(id, full_name, email, avatar_url)
    `
    )
    .eq("task_id", taskId)
    .eq("organization_id", auth.organizationId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    console.error("[tasks] get comments failed:", error?.message);
    return [];
  }

  return (data as unknown as Array<{
    id: string;
    task_id: string;
    organization_id: string;
    user_id: string;
    content: string;
    created_at: string;
    author: RawTaskJoinRow["created_by"];
  }>).map((c) => ({
    id: c.id,
    taskId: c.task_id,
    organizationId: c.organization_id,
    userId: c.user_id,
    content: c.content,
    createdAt: c.created_at,
    author: normalizePerson(c.author) || {
      id: c.user_id,
      fullName: "Unknown",
      email: null,
    },
  }));
}

export async function addTaskComment(
  taskId: string,
  content: string
): Promise<TaskActionState & { comment?: TaskCommentRow }> {
  const auth = await requireTaskPermission("tasks.view");
  if (!auth.ok) return auth.error;

  const parsed = taskCommentInputSchema.safeParse({ taskId, content });
  if (!parsed.success) {
    return {
      status: "error",
      error: parsed.error.issues[0]?.message || "Invalid comment",
    };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("task_comments")
    .insert({
      task_id: parsed.data.taskId,
      organization_id: auth.organizationId,
      user_id: auth.userId,
      content: parsed.data.content,
    })
    .select(
      `
      id,
      task_id,
      organization_id,
      user_id,
      content,
      created_at,
      author:profiles!fk_task_comments_user(id, full_name, email, avatar_url)
    `
    )
    .single();

  if (error || !data) {
    console.error("[tasks] add comment failed:", error?.message);
    return { status: "error", error: "Failed to add comment" };
  }

  const raw = data as unknown as {
    id: string;
    task_id: string;
    organization_id: string;
    user_id: string;
    content: string;
    created_at: string;
    author: RawTaskJoinRow["created_by"];
  };

  revalidatePath("/tasks");
  return {
    status: "success",
    comment: {
      id: raw.id,
      taskId: raw.task_id,
      organizationId: raw.organization_id,
      userId: raw.user_id,
      content: raw.content,
      createdAt: raw.created_at,
      author: normalizePerson(raw.author) || {
        id: raw.user_id,
        fullName: "You",
        email: null,
      },
    },
  };
}

export async function deleteTaskComment(commentId: string): Promise<TaskActionState> {
  const auth = await requireTaskPermission("tasks.view");
  if (!auth.ok) return auth.error;

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("task_comments")
    .delete()
    .eq("id", commentId)
    .eq("organization_id", auth.organizationId);

  if (error) {
    console.error("[tasks] delete comment failed:", error.message);
    return { status: "error", error: "Failed to delete comment" };
  }

  revalidatePath("/tasks");
  return { status: "success" };
}
