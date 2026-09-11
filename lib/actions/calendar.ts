"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import {
  calendarEventSchemaWithRange,
  type CalendarActionState,
  type CalendarEventInput,
} from "@/lib/validations/calendar";
import { z } from "zod";

/**
 * Calendar server actions.
 *
 * Security model:
 *  - `organization_id` and `user_id` are NEVER read from the payload — they
 *    come exclusively from `getCurrentUserContext()`, so a caller can only
 *    touch rows inside their own organization.
 *  - Viewing requires `calendar.view`; mutating requires the matching
 *    `calendar.create` / `calendar.edit` / `calendar.delete` permission.
 *  - Updates and deletes additionally verify the event belongs to the
 *    caller's organization in the same statement (RLS backstops this, but
 *    we never rely on frontend-only checks).
 *  - Input is re-validated with Zod server-side (schema shared with the
 *    client form), including the `end > start` refinement.
 */

export interface CalendarPerson {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
}

export interface CalendarEventRow {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  location: string | null;
  createdBy: CalendarPerson;
  assignedTo: CalendarPerson | null;
}

/** Raw joined row shape coming back from PostgREST. */
interface CalendarEventJoinRow {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  location: string | null;
  user_id: string;
  assigned_user_id: string | null;
  created_by: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  }[];
  assigned_to: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  }[] | null;
}

type AuthResult =
  | { ok: true; organizationId: string; currentUserId: string }
  | { ok: false; error: CalendarActionState };

/**
 * Verifies the session, the caller's organization, and that the caller
 * holds the given permission.
 */
async function authorizeCalendar(
  permission: "calendar.create" | "calendar.edit" | "calendar.delete"
): Promise<AuthResult> {
  const userContext = await getCurrentUserContext();

  if (!userContext) {
    return {
      ok: false,
      error: { status: "error", error: "You must be signed in to do this." },
    };
  }

  if (!userContext.permissions.includes(permission)) {
    return {
      ok: false,
      error: {
        status: "error",
        error: "You don't have permission to perform this action.",
      },
    };
  }

  const organizationId = userContext.organization?.id;

  if (!organizationId) {
    return {
      ok: false,
      error: {
        status: "error",
        error: "No organization found for your account.",
      },
    };
  }

  return {
    ok: true,
    organizationId,
    currentUserId: userContext.user.id,
  };
}

function parseFieldErrors(
  issues: z.ZodIssue[]
): CalendarActionState["fieldErrors"] {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string") {
      (fieldErrors[key] ??= []).push(issue.message);
    }
  }
  return fieldErrors;
}

function toEventRow(row: CalendarEventJoinRow): CalendarEventRow {
  const creator = Array.isArray(row.created_by)
    ? row.created_by[0]
    : (row.created_by as unknown as CalendarEventJoinRow["created_by"][number]);
  const assigneeRows = Array.isArray(row.assigned_to)
    ? row.assigned_to
    : row.assigned_to
      ? [row.assigned_to as unknown as CalendarEventJoinRow["created_by"][number]]
      : null;

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    allDay: row.all_day,
    location: row.location,
    createdBy: {
      id: row.user_id,
      fullName: creator?.full_name ?? null,
      avatarUrl: creator?.avatar_url ?? null,
    },
    assignedTo: assigneeRows?.[0]
      ? {
          id: assigneeRows[0].id,
          fullName: assigneeRows[0].full_name ?? null,
          avatarUrl: assigneeRows[0].avatar_url ?? null,
        }
      : null,
  };
}

/**
 * Retrieves calendar events strictly scoped to the active organization whose
 * events overlap the given window [startDate, endDate) (ISO strings).
 */
export async function getCalendarEvents(
  startDate: string,
  endDate: string
): Promise<CalendarEventRow[] | null> {
  const userContext = await getCurrentUserContext();

  if (!userContext || !userContext.permissions.includes("calendar.view")) {
    return null;
  }

  const organizationId = userContext.organization?.id;
  if (!organizationId) {
    return null;
  }

  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("calendar_events")
    .select(
      `
        id,
        title,
        description,
        starts_at,
        ends_at,
        all_day,
        location,
        user_id,
        assigned_user_id,
        created_by:profiles!calendar_events_user_id_fkey(id, full_name, avatar_url),
        assigned_to:profiles!calendar_events_assigned_user_id_fkey(id, full_name, avatar_url)
      `
    )
    .eq("organization_id", organizationId)
    // Overlap predicate: ends >= windowStart AND starts <= windowEnd.
    .gte("ends_at", startDate)
    .lte("starts_at", endDate)
    .order("starts_at", { ascending: true });

  if (error || !data) {
    console.error("[calendar] fetch failed:", error?.message ?? "no rows");
    return null;
  }

  return (data as unknown as CalendarEventJoinRow[]).map(toEventRow);
}

/**
 * Creates a new calendar event. Requires `calendar.create`.
 * `user_id` (creator) and `organization_id` come from the session.
 */
export async function createEvent(
  formData: CalendarEventInput
): Promise<CalendarActionState> {
  const auth = await authorizeCalendar("calendar.create");

  if (!auth.ok) {
    return auth.error;
  }

  const parsed = calendarEventSchemaWithRange.safeParse(formData);

  if (!parsed.success) {
    return {
      status: "error",
      error: "Please fix the highlighted fields.",
      fieldErrors: parseFieldErrors(parsed.error.issues),
    };
  }

  const { title, description, startsAt, endsAt, location, assignedUserId } =
    parsed.data;

  const supabase = await createServerClient();

  const { error } = await supabase.from("calendar_events").insert({
    organization_id: auth.organizationId,
    user_id: auth.currentUserId,
    title,
    description: description || null,
    starts_at: new Date(startsAt).toISOString(),
    ends_at: new Date(endsAt).toISOString(),
    location: location || null,
    assigned_user_id: assignedUserId || null,
  });

  if (error) {
    console.error("[calendar] create failed:", error.message);
    return {
      status: "error",
      error: "Could not create the event. Please try again.",
    };
  }

  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  return { status: "success" };
}

/**
 * Updates an existing calendar event. Requires `calendar.edit`. The event
 * must belong to the caller's organization (checked in the same statement).
 */
export async function updateEvent(
  eventId: string,
  formData: CalendarEventInput
): Promise<CalendarActionState> {
  const auth = await authorizeCalendar("calendar.edit");

  if (!auth.ok) {
    return auth.error;
  }

  if (!eventId) {
    return { status: "error", error: "Missing event ID." };
  }

  const parsed = calendarEventSchemaWithRange.safeParse(formData);

  if (!parsed.success) {
    return {
      status: "error",
      error: "Please fix the highlighted fields.",
      fieldErrors: parseFieldErrors(parsed.error.issues),
    };
  }

  const { title, description, startsAt, endsAt, location, assignedUserId } =
    parsed.data;

  const supabase = await createServerClient();

  const { data: updated, error } = await supabase
    .from("calendar_events")
    .update({
      title,
      description: description || null,
      starts_at: new Date(startsAt).toISOString(),
      ends_at: new Date(endsAt).toISOString(),
      location: location || null,
      assigned_user_id: assignedUserId || null,
    })
    .eq("id", eventId)
    .eq("organization_id", auth.organizationId)
    .select("id");

  if (error) {
    console.error("[calendar] update failed:", error.message);
    return {
      status: "error",
      error: "Could not update the event. Please try again.",
    };
  }

  if (!updated || updated.length === 0) {
    return {
      status: "error",
      error: "Event not found, or you don't have access to it.",
    };
  }

  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  return { status: "success" };
}

/**
 * Deletes a calendar event. Requires `calendar.delete`. The event must
 * belong to the caller's organization.
 */
export async function deleteEvent(
  eventId: string
): Promise<CalendarActionState> {
  const auth = await authorizeCalendar("calendar.delete");

  if (!auth.ok) {
    return auth.error;
  }

  if (!eventId) {
    return { status: "error", error: "Missing event ID." };
  }

  const supabase = await createServerClient();

  const { data: deleted, error } = await supabase
    .from("calendar_events")
    .delete()
    .eq("id", eventId)
    .eq("organization_id", auth.organizationId)
    .select("id");

  if (error) {
    console.error("[calendar] delete failed:", error.message);
    return {
      status: "error",
      error: "Could not delete the event. Please try again.",
    };
  }

  if (!deleted || deleted.length === 0) {
    return {
      status: "error",
      error: "Event not found, or you don't have access to it.",
    };
  }

  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  return { status: "success" };
}