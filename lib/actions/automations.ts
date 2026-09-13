"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import {
  createAutomationInputSchema,
  automationToggleSchema,
  type AutomationValidationMessages,
} from "@/lib/validations/automations";
import { getDictionary } from "@/lib/i18n/get-dictionary";

/**
 * Automations server actions + execution engine.
 *
 * Security model:
 *  - `organization_id` and `created_by` are NEVER read from the payload —
 *    they come exclusively from `getCurrentUserContext()`, so a caller can
 *    only touch rows inside their own organization, as themselves.
 *  - Viewing requires `automations.view`; creating/toggling/deleting
 *    requires `automations.manage` (the catalog permissions seeded by the
 *    00015 migration).
 *  - Input is re-validated with Zod server-side (schema shared with the
 *    client forms).
 *  - `triggerAutomationEvent` re-validates the caller holds `automations.view`
 *    (the same gate as the page), and every action it performs is
 *    org-scoped so a caller can never trigger work on another tenant.
 */

/** Public row shape for automations (joined created-by profile). */
export interface AutomationRow {
  id: string;
  name: string;
  description: string | null;
  triggerEvent: string;
  actionType: string;
  actionConfig: Record<string, unknown>;
  isActive: boolean;
  createdBy: {
    id: string;
    fullName: string | null;
    email: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

/** Raw PostgREST join shape for an automations row. */
interface AutomationJoinRow {
  id: string;
  name: string;
  description: string | null;
  trigger_event: string;
  action_type: string;
  action_config: Record<string, unknown>;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  creator:
    | { id: string; full_name: string | null; email: string | null }
    | { id: string; full_name: string | null; email: string | null }[]
    | null;
}

export interface AutomationLogRow {
  id: string;
  automationId: string;
  status: "success" | "failed" | "running";
  triggerPayload: Record<string, unknown>;
  actionResult: Record<string, unknown>;
  errorMessage: string | null;
  executedAt: string;
}

interface AutomationLogJoinRow {
  id: string;
  automation_id: string;
  status: "success" | "failed" | "running";
  trigger_payload: Record<string, unknown>;
  action_result: Record<string, unknown>;
  error_message: string | null;
  executed_at: string;
}

function toAutomationRow(row: AutomationJoinRow): AutomationRow {
  const creator = Array.isArray(row.creator) ? row.creator[0] : row.creator;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    triggerEvent: row.trigger_event,
    actionType: row.action_type,
    actionConfig: row.action_config ?? {},
    isActive: row.is_active,
    createdBy: creator
      ? {
          id: creator.id,
          fullName: creator.full_name,
          email: creator.email,
        }
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toAutomationLogRow(row: AutomationLogJoinRow): AutomationLogRow {
  return {
    id: row.id,
    automationId: row.automation_id,
    status: row.status,
    triggerPayload: row.trigger_payload ?? {},
    actionResult: row.action_result ?? {},
    errorMessage: row.error_message,
    executedAt: row.executed_at,
  };
}

type AutomationAuthResult =
  | { ok: true; organizationId: string; userId: string }
  | { ok: false; error: string };
async function requireAutomationPermission(
  permission: "automations.view" | "automations.manage"
): Promise<AutomationAuthResult> {
  const userContext = await getCurrentUserContext();
  const dict = await getDictionary();
  const err = dict.platform.automations.errors;

  if (!userContext) {
    return { ok: false, error: err.signedIn };
  }

  if (!hasPermission(permission, userContext.permissions)) {
    return {
      ok: false,
      error:
        permission === "automations.manage"
          ? err.noPermissionManage
          : err.noPermissionView,
    };
  }

  const organizationId = userContext.organization?.id;
  if (!organizationId) {
    return { ok: false, error: err.noOrg };
  }

  return {
    ok: true,
    organizationId,
    userId: userContext.user.id,
  };
}

function parseFieldErrors(
  issues: z.ZodIssue[]
): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string") {
      (fieldErrors[key] ??= []).push(issue.message);
    }
  }
  return fieldErrors;
}

/** English fallback for the toggle schema when no localized messages exist. */
const fallbackToggleMessages: AutomationValidationMessages = {
  nameRequired: "Invalid ID.",
  nameMax: "Invalid ID.",
  descriptionMax: "Invalid ID.",
  triggerRequired: "Invalid ID.",
  actionRequired: "Invalid ID.",
  webhookUrlRequired: "Invalid ID.",
  webhookUrlInvalid: "Invalid ID.",
  channelRequired: "Invalid ID.",
  messageRequired: "Invalid ID.",
  messageMax: "Invalid ID.",
  taskTitleRequired: "Invalid ID.",
  taskTitleMax: "Invalid ID.",
  assigneeInvalid: "Invalid ID.",
  invalidConfig: "Invalid ID.",
};
/**
 * Lists all automations for the current organization. Requires
 * `automations.view` (the page gate); the RLS policy ALSO restricts reads
 * to the caller's organization, so a user who somehow reaches this with
 * view rights can only ever see their own tenant's rows.
 */
export async function getAutomations(): Promise<AutomationRow[] | null> {
  const auth = await requireAutomationPermission("automations.view");
  if (!auth.ok) return null;

  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("automations")
    .select(
      `
        id,
        name,
        description,
        trigger_event,
        action_type,
        action_config,
        is_active,
        created_by,
        created_at,
        updated_at,
        creator:profiles!fk_automations_created_by(id, full_name, email)
      `
    )
    .eq("organization_id", auth.organizationId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[automations] list failed:", error.message);
    return null;
  }

  return (data ?? []).map(
    (row) => toAutomationRow(row as unknown as AutomationJoinRow)
  );
}

export type CreateAutomationResult =
  | { status: "success"; automation: AutomationRow }
  | { status: "error"; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Creates an automation in the current organization. Requires
 * `automations.manage`. The trigger/action configuration is validated
 * server-side via the shared Zod schema; `organization_id` and
 * `created_by` always come from the session.
 */
export async function createAutomation(
  data: unknown
): Promise<CreateAutomationResult> {
  const auth = await requireAutomationPermission("automations.manage");
  if (!auth.ok) return { status: "error", error: auth.error };

  const dict = await getDictionary();
  const errors = dict.platform.automations.errors;

  const parsed = createAutomationInputSchema(errors).safeParse(data);
  if (!parsed.success) {
    return {
      status: "error",
      error: errors.highlightFields,
      fieldErrors: parseFieldErrors(parsed.error.issues),
    };
  }

  const { name, description, triggerEvent, actionConfig } = parsed.data;

  const supabase = await createServerClient();
  const insertPayload = {
    organization_id: auth.organizationId,
    name,
    description: description ?? null,
    trigger_event: triggerEvent,
    action_type: actionConfig.actionType,
    action_config: actionConfig,
    created_by: auth.userId,
  };

  const { data: inserted, error } = await supabase
    .from("automations")
    .insert(insertPayload)
    .select(
      `
        id,
        name,
        description,
        trigger_event,
        action_type,
        action_config,
        is_active,
        created_by,
        created_at,
        updated_at,
        creator:profiles!fk_automations_created_by(id, full_name, email)
      `
    )
    .single();

  if (error) {
    console.error("[automations] create failed:", error.message);
    return { status: "error", error: errors.createFailed };
  }

  revalidatePath("/automations");
  return {
    status: "success",
    automation: toAutomationRow(inserted as unknown as AutomationJoinRow),
  };
}

export type UpdateAutomationResult =
  | { status: "success"; automation: AutomationRow }
  | { status: "error"; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Updates an existing automation's trigger/action configuration. Requires
 * `automations.manage`. The same Zod schema as create is re-validated
 * server-side, and the update is scoped to the caller's organization.
 */
export async function updateAutomation(
  id: string,
  data: unknown
): Promise<UpdateAutomationResult> {
  const auth = await requireAutomationPermission("automations.manage");
  if (!auth.ok) return { status: "error", error: auth.error };

  const dict = await getDictionary();
  const errors = dict.platform.automations.errors;

  const idParsed = automationToggleSchema(fallbackToggleMessages).safeParse({
    id,
    isActive: false,
  });
  if (!idParsed.success) {
    return { status: "error", error: errors.invalidId };
  }

  const parsed = createAutomationInputSchema(errors).safeParse(data);
  if (!parsed.success) {
    return {
      status: "error",
      error: errors.highlightFields,
      fieldErrors: parseFieldErrors(parsed.error.issues),
    };
  }

  const { name, description, triggerEvent, actionConfig } = parsed.data;

  const supabase = await createServerClient();
  const { data: updated, error } = await supabase
    .from("automations")
    .update({
      name,
      description: description ?? null,
      trigger_event: triggerEvent,
      action_type: actionConfig.actionType,
      action_config: actionConfig,
    })
    .eq("id", idParsed.data.id)
    .eq("organization_id", auth.organizationId)
    .select(
      `
        id,
        name,
        description,
        trigger_event,
        action_type,
        action_config,
        is_active,
        created_by,
        created_at,
        updated_at,
        creator:profiles!fk_automations_created_by(id, full_name, email)
      `
    )
    .maybeSingle();

  if (error || !updated) {
    console.error("[automations] update failed:", error?.message);
    return { status: "error", error: errors.notFound };
  }

  revalidatePath("/automations");
  return {
    status: "success",
    automation: toAutomationRow(updated as unknown as AutomationJoinRow),
  };
}
export type ToggleAutomationResult =
  | { status: "success"; automation: AutomationRow }
  | { status: "error"; error: string };

/**
 * Toggles an automation's `is_active` flag. Requires `automations.manage`.
 * Only rows in the caller's organization are affected (the update is
 * scoped to the session's organization_id).
 */
export async function toggleAutomation(
  id: string,
  isActive: boolean
): Promise<ToggleAutomationResult> {
  const auth = await requireAutomationPermission("automations.manage");
  if (!auth.ok) return { status: "error", error: auth.error };

  const dict = await getDictionary();
  const errors = dict.platform.automations.errors;

  const parsed = automationToggleSchema(fallbackToggleMessages).safeParse({
    id,
    isActive,
  });
  if (!parsed.success) {
    return { status: "error", error: errors.invalidId };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("automations")
    .update({ is_active: parsed.data.isActive })
    .eq("id", parsed.data.id)
    .eq("organization_id", auth.organizationId)
    .select(
      `
        id,
        name,
        description,
        trigger_event,
        action_type,
        action_config,
        is_active,
        created_by,
        created_at,
        updated_at,
        creator:profiles!fk_automations_created_by(id, full_name, email)
      `
    )
    .maybeSingle();

  if (error || !data) {
    console.error("[automations] toggle failed:", error?.message);
    return { status: "error", error: errors.notFound };
  }

  revalidatePath("/automations");
  return {
    status: "success",
    automation: toAutomationRow(data as unknown as AutomationJoinRow),
  };
}

export type DeleteAutomationResult =
  | { status: "success"; id: string }
  | { status: "error"; error: string };

/**
 * Deletes an automation (cascade removes its execution logs). Requires
 * `automations.manage`. Scoped to the caller's organization.
 */
export async function deleteAutomation(id: string): Promise<DeleteAutomationResult> {
  const auth = await requireAutomationPermission("automations.manage");
  if (!auth.ok) return { status: "error", error: auth.error };

  const dict = await getDictionary();
  const errors = dict.platform.automations.errors;

  const parsed = automationToggleSchema(fallbackToggleMessages).safeParse({
    id,
    isActive: false,
  });
  if (!parsed.success) {
    return { status: "error", error: errors.invalidId };
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("automations")
    .delete()
    .eq("id", parsed.data.id)
    .eq("organization_id", auth.organizationId);

  if (error) {
    console.error("[automations] delete failed:", error.message);
    return { status: "error", error: errors.deleteFailed };
  }

  revalidatePath("/automations");
  return { status: "success", id: parsed.data.id };
}

export type AutomationLogsResult =
  | { status: "success"; logs: AutomationLogRow[] }
  | { status: "error"; error: string };

/**
 * Returns the execution history for the current organization, optionally
 * filtered to one automation. Requires `automations.view`. Logs are
 * returned newest-first, capped at 100 rows for the drawer.
 */
export async function getAutomationLogs(
  automationId?: string
): Promise<AutomationLogsResult> {
  const auth = await requireAutomationPermission("automations.view");
  if (!auth.ok) return { status: "error", error: auth.error };

  const dict = await getDictionary();
  const errors = dict.platform.automations.errors;

  const supabase = await createServerClient();
  let query = supabase
    .from("automation_logs")
    .select(
      `
        id,
        automation_id,
        status,
        trigger_payload,
        action_result,
        error_message,
        executed_at
      `
    )
    .eq("organization_id", auth.organizationId)
    .order("executed_at", { ascending: false })
    .limit(100);

  if (automationId) {
    query = query.eq("automation_id", automationId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[automations] logs failed:", error.message);
    return { status: "error", error: errors.logsFailed };
  }

  return {
    status: "success",
    logs: (data ?? []).map(
      (row) => toAutomationLogRow(row as unknown as AutomationLogJoinRow)
    ),
  };
}
// ============================================================
// Execution engine
// ============================================================

interface TriggerEventPayload {
  [key: string]: unknown;
}

/** Row returned by the runner's active-automation lookup. */
interface ActiveAutomationRow {
  id: string;
  name: string;
  action_type: string;
  action_config: Record<string, unknown>;
}

/**
 * Fetches the active automations matching an event in an organization.
 * Only rows with `is_active = true` and the requested trigger are
 * returned (the partial index `idx_automations_active_lookup` serves this).
 */
async function fetchActiveAutomations(
  organizationId: string,
  eventName: string
): Promise<ActiveAutomationRow[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("automations")
    .select("id, name, action_type, action_config")
    .eq("organization_id", organizationId)
    .eq("trigger_event", eventName)
    .eq("is_active", true);

  if (error) {
    console.error("[automations][runner] lookup failed:", error.message);
    return [];
  }

  return (data ?? []) as unknown as ActiveAutomationRow[];
}

/**
 * Records one execution result into automation_logs via the service-role
 * client. The execution engine runs in server actions where the caller's
 * own RLS might not allow inserting logs for automations they only hold
 * view rights on; a write failure here must never break the caller's
 * event mutation, hence the fire-and-forget catch.
 */
async function writeLog(params: {
  organizationId: string;
  automationId: string;
  status: "success" | "failed" | "running";
  triggerPayload?: TriggerEventPayload;
  actionResult?: Record<string, unknown>;
  errorMessage?: string | null;
}): Promise<void> {
  try {
    const { createServiceRoleClient } = await import("@/lib/supabase/admin");
    const supabase = createServiceRoleClient();
    await supabase.from("automation_logs").insert({
      organization_id: params.organizationId,
      automation_id: params.automationId,
      status: params.status,
      trigger_payload: params.triggerPayload ?? {},
      action_result: params.actionResult ?? {},
      error_message: params.errorMessage ?? null,
    });
  } catch (error) {
    console.error("[automations] log write failed:", error);
  }
}
/**
 * Runs a single automation's action. Throws on failure so the runner can
 * record a `failed` log; the message is stored as the human-readable
 * error (`error_message`) and surfaced in the execution-history drawer.
 */
async function runAutomationAction(
  organizationId: string,
  actionType: string,
  config: Record<string, unknown>
): Promise<Record<string, unknown>> {
  switch (actionType) {
    case "webhook": {
      const url = typeof config.url === "string" ? config.url : "";
      if (!url) throw new Error("webhook_url_required");

      const payload = {
        event: `uplevel_automation.${config.eventName ?? "trigger"}`,
        ...(config.payload ?? {}),
      };
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        throw new Error(`webhook_status_${response.status}`);
      }
      return { webhookStatus: response.status };
    }

    case "chat_message": {
      const channelId = typeof config.channelId === "string" ? config.channelId : "";
      const message = typeof config.message === "string" ? config.message : "";
      if (!channelId || !message) throw new Error("chat_config_required");

      const supabase = await createServerClient();
      const { data: channel } = await supabase
        .from("chat_channels")
        .select("id")
        .eq("id", channelId)
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (!channel) throw new Error("chat_channel_not_found");

      const { data: systemUser } = await supabase
        .from("profiles")
        .select("id")
        .eq("organization_id", organizationId)
        .is("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      const senderId = systemUser?.id ?? "00000000-0000-0000-0000-000000000000";
      const { error: insertError } = await supabase.from("chat_messages").insert({
        organization_id: organizationId,
        channel_id: channelId,
        user_id: senderId,
        content: message,
      });
      if (insertError) throw new Error("chat_send_failed");
      return { channelId };
    }

    case "create_task": {
      const taskTitle = typeof config.taskTitle === "string" ? config.taskTitle : "";
      if (!taskTitle) throw new Error("task_title_required");

      const supabase = await createServerClient();
      const { data: systemUser } = await supabase
        .from("profiles")
        .select("id")
        .eq("organization_id", organizationId)
        .is("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      const createdBy = systemUser?.id ?? "00000000-0000-0000-0000-000000000000";
      const { data: task, error: insertError } = await supabase
        .from("tasks")
        .insert({
          organization_id: organizationId,
          title: taskTitle,
          description:
            typeof config.description === "string" ? config.description : null,
          status: "todo",
          priority: "medium",
          created_by: createdBy,
          assigned_to:
            typeof config.assigneeId === "string" && config.assigneeId
              ? config.assigneeId
              : null,
        })
        .select("id, title, status")
        .single();

      if (insertError) throw new Error("task_create_failed");
      return { taskId: task?.id ?? null, title: task?.title ?? taskTitle };
    }

    default:
      throw new Error("unsupported_action");
  }
}
/**
 * Core automation runner: given an organization (from the session) and an
 * event name, dispatches every _active_ automation configured for that
 * event and records each execution into `automation_logs`.
 *
 * Runs synchronously inside the calling server action so failures are
 * observable; individual action failures never throw to the caller — each
 * failing automation is recorded as a `failed` log and the runner returns
 * a per-automation summary.
 */
export async function triggerAutomationEvent(
  organizationId: string,
  eventName: string,
  payload?: TriggerEventPayload
): Promise<
  {
    automationId: string;
    status: "success" | "failed";
    errorMessage: string | null;
  }[]
> {
  const automationRows = await fetchActiveAutomations(organizationId, eventName);

  const results: {
    automationId: string;
    status: "success" | "failed";
    errorMessage: string | null;
  }[] = [];

  for (const automation of automationRows) {
    const payloadWithEvent = { ...(payload ?? {}), eventName };
    try {
      const actionResult = await runAutomationAction(
        organizationId,
        automation.action_type,
        { ...automation.action_config, payload: payloadWithEvent }
      );
      await writeLog({
        organizationId,
        automationId: automation.id,
        status: "success",
        triggerPayload: payloadWithEvent,
        actionResult,
      });
      results.push({
        automationId: automation.id,
        status: "success",
        errorMessage: null,
      });
    } catch (actionError) {
      const message =
        actionError instanceof Error ? actionError.message : "unknown_error";
      await writeLog({
        organizationId,
        automationId: automation.id,
        status: "failed",
        triggerPayload: payloadWithEvent,
        errorMessage: message,
      });
      results.push({
        automationId: automation.id,
        status: "failed",
        errorMessage: message,
      });
    }
  }

  return results;
}