"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import {
  TELECOM_DIRECTIONS,
  createCallLogInputSchema,
  createSmsInputSchema,
  type TelecomCallStatus,
  type TelecomDirection,
  type TelecomSmsStatus,
} from "@/lib/validations/telecom";

/**
 * Telecommunications server actions.
 *
 * Security model:
 *  - `organization_id` and `agent_id` are NEVER read from the payload —
 *    they come exclusively from `getCurrentUserContext()`, so a caller
 *    can only touch rows inside their own organization, as themselves.
 *  - Viewing requires `telecom.view`; logging calls / sending SMS
 *    requires `telecom.manage` (the catalog permissions seeded by the
 *    00019 migration). The RLS policies additionally scope every query
 *    to `current_organization_id()`, so a user who somehow reaches a
 *    query with the permission still can only ever see their own
 *    tenant's rows.
 *  - Input is re-validated with Zod server-side (schemas shared with
 *    the client forms).
 */

/** CRM contact option used by the call/SMS contact selectors. */
export interface TelecomContactOption {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

/** Public row shape for a telecom call (with contact + agent joins). */
export interface TelecomCallRow {
  id: string;
  direction: TelecomDirection;
  status: TelecomCallStatus;
  fromNumber: string;
  toNumber: string;
  durationSeconds: number;
  recordingUrl: string | null;
  summary: string | null;
  createdAt: string;
  contact: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
  } | null;
  agent: {
    id: string;
    fullName: string | null;
    email: string | null;
  } | null;
}

/** Public row shape for an SMS message (with contact join). */
export interface TelecomSmsRow {
  id: string;
  direction: TelecomDirection;
  fromNumber: string;
  toNumber: string;
  body: string;
  status: TelecomSmsStatus;
  createdAt: string;
  contact: {
    id: string;
    name: string;
    phone: string | null;
  } | null;
}

/** Raw PostgREST join shape for a telecom_calls row. */
interface TelecomCallJoinRow {
  id: string;
  direction: string;
  status: string;
  from_number: string;
  to_number: string;
  duration_seconds: number;
  recording_url: string | null;
  summary: string | null;
  created_at: string;
  contact:
    | { id: string; name: string; phone: string | null; email: string | null }
    | {
        id: string;
        name: string;
        phone: string | null;
        email: string | null;
      }[]
    | null;
  agent:
    | { id: string; full_name: string | null; email: string | null }
    | { id: string; full_name: string | null; email: string | null }[]
    | null;
}

/** Raw PostgREST join shape for a telecom_sms row. */
interface TelecomSmsJoinRow {
  id: string;
  direction: string;
  from_number: string;
  to_number: string;
  body: string;
  status: string;
  created_at: string;
  contact:
    | { id: string; name: string; phone: string | null }
    | { id: string; name: string; phone: string | null }[]
    | null;
}

const TELECOM_CALL_SELECT = `
  id,
  direction,
  status,
  from_number,
  to_number,
  duration_seconds,
  recording_url,
  summary,
  created_at,
  contact:crm_contacts(id, name, phone, email),
  agent:profiles!fk_telecom_calls_agent(id, full_name, email)
`;

const TELECOM_SMS_SELECT = `
  id,
  direction,
  from_number,
  to_number,
  body,
  status,
  created_at,
  contact:crm_contacts(id, name, phone)
`;

function toTelecomCallRow(row: TelecomCallJoinRow): TelecomCallRow {
  const contact = Array.isArray(row.contact) ? row.contact[0] : row.contact;
  const agent = Array.isArray(row.agent) ? row.agent[0] : row.agent;
  return {
    id: row.id,
    direction: row.direction as TelecomDirection,
    status: row.status as TelecomCallStatus,
    fromNumber: row.from_number,
    toNumber: row.to_number,
    durationSeconds: Number(row.duration_seconds ?? 0),
    recordingUrl: row.recording_url,
    summary: row.summary,
    createdAt: row.created_at,
    contact: contact
      ? {
          id: contact.id,
          name: contact.name,
          phone: contact.phone,
          email: contact.email,
        }
      : null,
    agent: agent
      ? {
          id: agent.id,
          fullName: agent.full_name,
          email: agent.email,
        }
      : null,
  };
}

function toTelecomSmsRow(row: TelecomSmsJoinRow): TelecomSmsRow {
  const contact = Array.isArray(row.contact) ? row.contact[0] : row.contact;
  return {
    id: row.id,
    direction: row.direction as TelecomDirection,
    fromNumber: row.from_number,
    toNumber: row.to_number,
    body: row.body,
    status: row.status as TelecomSmsStatus,
    createdAt: row.created_at,
    contact: contact
      ? {
          id: contact.id,
          name: contact.name,
          phone: contact.phone,
        }
      : null,
  };
}

type TelecomAuthResult =
  | { ok: true; organizationId: string; userId: string }
  | { ok: false; error: string };

async function requireTelecomPermission(
  permission: "telecom.view" | "telecom.manage"
): Promise<TelecomAuthResult> {
  const userContext = await getCurrentUserContext();
  const dict = await getDictionary();
  const err = dict.platform.telecom.errors;

  if (!userContext) {
    return { ok: false, error: err.signedIn };
  }

  if (!hasPermission(permission, userContext.permissions)) {
    return {
      ok: false,
      error:
        permission === "telecom.manage"
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

/**
 * Lists CRM contacts for the call/SMS selectors. Requires
 * `telecom.view` (contacts are org-scoped rows, so RLS keeps the
 * result tenant-isolated without requiring CRM permissions).
 */
export async function getContacts(): Promise<TelecomContactOption[] | null> {
  const auth = await requireTelecomPermission("telecom.view");
  if (!auth.ok) return null;

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("crm_contacts")
    .select("id, name, phone, email")
    .eq("organization_id", auth.organizationId)
    .order("name", { ascending: true });

  if (error) {
    console.error("[telecom] contacts failed:", error.message);
    return null;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
  }));
}
/**
 * Lists calls for the current organization, newest-first, optionally
 * filtered by direction. Requires `telecom.view`.
 */
export async function getCalls(
  direction?: "all" | TelecomDirection
): Promise<TelecomCallRow[] | null> {
  const auth = await requireTelecomPermission("telecom.view");
  if (!auth.ok) return null;

  const supabase = await createServerClient();

  let query = supabase
    .from("telecom_calls")
    .select(TELECOM_CALL_SELECT)
    .eq("organization_id", auth.organizationId)
    .order("created_at", { ascending: false });

  if (
    direction &&
    direction !== "all" &&
    (TELECOM_DIRECTIONS as readonly string[]).includes(direction)
  ) {
    query = query.eq("direction", direction);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[telecom] calls list failed:", error.message);
    return null;
  }

  return (data ?? []).map(
    (row) => toTelecomCallRow(row as unknown as TelecomCallJoinRow)
  );
}

export type LogCallResult =
  | { status: "success"; call: TelecomCallRow }
  | { status: "error"; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Logs a call record in the current organization. Requires
 * `telecom.manage`. All fields are re-validated server-side via the
 * shared Zod schema; `organization_id` and `agent_id` always come from
 * the session (agent_id is the acting user).
 */
export async function logCall(data: unknown): Promise<LogCallResult> {
  const auth = await requireTelecomPermission("telecom.manage");
  if (!auth.ok) return { status: "error", error: auth.error };

  const dict = await getDictionary();
  const errors = dict.platform.telecom.errors;

  const parsed = createCallLogInputSchema(errors).safeParse(data);
  if (!parsed.success) {
    return {
      status: "error",
      error: errors.highlightFields,
      fieldErrors: parseFieldErrors(parsed.error.issues),
    };
  }

  const {
    contactId,
    direction,
    status,
    fromNumber,
    toNumber,
    durationSeconds,
    recordingUrl,
    summary,
  } = parsed.data;

  const supabase = await createServerClient();
  const { data: inserted, error } = await supabase
    .from("telecom_calls")
    .insert({
      organization_id: auth.organizationId,
      contact_id: contactId || null,
      direction,
      status,
      from_number: fromNumber,
      to_number: toNumber,
      duration_seconds: durationSeconds,
      recording_url: recordingUrl || null,
      summary: summary || null,
      agent_id: auth.userId,
    })
    .select(TELECOM_CALL_SELECT)
    .single();

  if (error) {
    console.error("[telecom] log call failed:", error.message);
    return { status: "error", error: errors.createFailed };
  }

  revalidatePath("/telecom");
  return {
    status: "success",
    call: toTelecomCallRow(inserted as unknown as TelecomCallJoinRow),
  };
}
/**
 * Lists SMS messages for the current organization, newest-first,
 * optionally scoped to one contact. Requires `telecom.view`.
 */
export async function getSmsMessages(
  contactId?: string
): Promise<TelecomSmsRow[] | null> {
  const auth = await requireTelecomPermission("telecom.view");
  if (!auth.ok) return null;

  const supabase = await createServerClient();

  let query = supabase
    .from("telecom_sms")
    .select(TELECOM_SMS_SELECT)
    .eq("organization_id", auth.organizationId)
    .order("created_at", { ascending: false });

  if (contactId) {
    query = query.eq("contact_id", contactId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[telecom] sms list failed:", error.message);
    return null;
  }

  return (data ?? []).map(
    (row) => toTelecomSmsRow(row as unknown as TelecomSmsJoinRow)
  );
}

export type SendSmsResult =
  | { status: "success"; sms: TelecomSmsRow }
  | { status: "error"; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Sends an outbound SMS (or logs an inbound one) in the current
 * organization. Requires `telecom.manage`.
 *
 * Outbound dispatch is currently stubbed: the carrier hand-off is not
 * wired to a provider yet, so the message is recorded with status
 * 'sent' exactly as if the hand-off succeeded. The insert row still
 * goes through the full Zod validation and tenant scoping.
 */
export async function sendSms(data: unknown): Promise<SendSmsResult> {
  const auth = await requireTelecomPermission("telecom.manage");
  if (!auth.ok) return { status: "error", error: auth.error };

  const dict = await getDictionary();
  const errors = dict.platform.telecom.errors;

  const parsed = createSmsInputSchema(errors).safeParse(data);
  if (!parsed.success) {
    return {
      status: "error",
      error: errors.highlightFields,
      fieldErrors: parseFieldErrors(parsed.error.issues),
    };
  }

  const { contactId, direction, fromNumber, toNumber, body } = parsed.data;

  // Stub: outbound SMS is recorded as sent; inbound as received. A real
  // carrier integration would dispatch here and update the status later.
  console.info(
    `[telecom] scheduling ${direction} SMS to ${toNumber} (dispatch stub)`
  );

  const supabase = await createServerClient();
  const { data: inserted, error } = await supabase
    .from("telecom_sms")
    .insert({
      organization_id: auth.organizationId,
      contact_id: contactId || null,
      direction,
      from_number: fromNumber,
      to_number: toNumber,
      body,
      status: direction === "outbound" ? "sent" : "received",
    })
    .select(TELECOM_SMS_SELECT)
    .single();

  if (error) {
    console.error("[telecom] send sms failed:", error.message);
    return { status: "error", error: errors.sendFailed };
  }

  revalidatePath("/telecom");
  return {
    status: "success",
    sms: toTelecomSmsRow(inserted as unknown as TelecomSmsJoinRow),
  };
}

/** Aggregates computed from the org's call + SMS tables. */
export interface TelecomMetrics {
  /** Total call records. */
  totalCalls: number;
  /** Total completed-call duration rounded to whole minutes. */
  totalMinutes: number;
  /** Calls left unanswered (status 'missed'). */
  missedCalls: number;
  /** Missed calls as a percentage of all calls (1 decimal place). */
  missedCallRate: number;
  /** Total SMS messages (sent + received). */
  totalSms: number;
}

/**
 * Computes the telecom KPIs (total calls, minutes logged, missed-call
 * rate, total SMS) for the current organization. Requires
 * `telecom.view`. The aggregation is small (single org) and computed in
 * the server action so the client never needs raw rows for the cards.
 */
export async function getTelecomMetrics(): Promise<TelecomMetrics | null> {
  const auth = await requireTelecomPermission("telecom.view");
  if (!auth.ok) return null;

  const supabase = await createServerClient();
  const [callsResult, smsResult] = await Promise.all([
    supabase
      .from("telecom_calls")
      .select("status, duration_seconds")
      .eq("organization_id", auth.organizationId),
    supabase
      .from("telecom_sms")
      .select("id")
      .eq("organization_id", auth.organizationId),
  ]);

  if (callsResult.error || smsResult.error) {
    console.error(
      "[telecom] metrics failed:",
      callsResult.error?.message ?? smsResult.error?.message
    );
    return null;
  }

  const callRows = callsResult.data ?? [];
  const totalDurationSeconds = callRows.reduce(
    (sum, row) => sum + Number(row.duration_seconds ?? 0),
    0
  );
  const missedCalls = callRows.filter(
    (row) => row.status === "missed"
  ).length;

  return {
    totalCalls: callRows.length,
    totalMinutes: Math.round(totalDurationSeconds / 60),
    missedCalls,
    missedCallRate:
      callRows.length > 0
        ? Math.round((missedCalls / callRows.length) * 1000) / 10
        : 0,
    totalSms: (smsResult.data ?? []).length,
  };
}