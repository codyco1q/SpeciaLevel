"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import {
  calendarEventSchemaWithRange,
  bookingProfileInputSchema,
  publicAppointmentInputSchema,
  DEFAULT_WEEKLY_AVAILABILITY,
  type CalendarActionState,
  type CalendarEventInput,
  type BookingProfileRow,
  type BookingProfileInput,
  type AppointmentRow,
  type PublicBookingProfile,
  type PublicAppointmentInput,
  type DayOfWeek,
} from "@/lib/validations/calendar";
import { z } from "zod";
import { dispatchNotification } from "@/lib/services/notifications";

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

// ============================================================
// Appointment Scheduler Server Actions
// ============================================================

function toBookingProfileRow(row: any): BookingProfileRow {
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    slug: row.slug,
    title: row.title,
    description: row.description ?? null,
    durationMinutes: Number(row.duration_minutes ?? 30),
    bufferBeforeMinutes: Number(row.buffer_before_minutes ?? 0),
    bufferAfterMinutes: Number(row.buffer_after_minutes ?? 10),
    isActive: Boolean(row.is_active),
    weeklyAvailability: row.weekly_availability ?? DEFAULT_WEEKLY_AVAILABILITY,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toAppointmentRow(row: any): AppointmentRow {
  return {
    id: row.id,
    organizationId: row.organization_id,
    bookingProfileId: row.booking_profile_id,
    hostUserId: row.host_user_id,
    clientName: row.client_name,
    clientEmail: row.client_email,
    clientPhone: row.client_phone ?? null,
    notes: row.notes ?? null,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    contactId: row.contact_id ?? null,
    dealId: row.deal_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    host: row.host
      ? {
          id: row.host.id,
          fullName: row.host.full_name ?? null,
          email: row.host.email ?? null,
          avatarUrl: row.host.avatar_url ?? null,
        }
      : undefined,
    contact: row.contact
      ? {
          id: row.contact.id,
          name: row.contact.name,
          email: row.contact.email,
          phone: row.contact.phone ?? null,
          company: row.contact.company ?? null,
        }
      : null,
    deal: row.deal
      ? {
          id: row.deal.id,
          title: row.deal.title,
          value: Number(row.deal.value ?? 0),
          currency: row.deal.currency ?? "USD",
          stage: row.deal.stage,
        }
      : null,
  };
}

export async function getMyBookingProfile(): Promise<BookingProfileRow | null> {
  const userContext = await getCurrentUserContext();
  if (!userContext || !userContext.organization) return null;

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("calendar_booking_profiles")
    .select("*")
    .eq("organization_id", userContext.organization.id)
    .eq("user_id", userContext.user.id)
    .maybeSingle();

  if (error) {
    console.error("[calendar] getMyBookingProfile error:", error.message);
    return null;
  }

  if (data) {
    return toBookingProfileRow(data);
  }

  const emailPrefix =
    userContext.user.email?.split("@")[0]?.toLowerCase().replace(/[^a-z0-9]/g, "-") ||
    "member";
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const baseSlug = `${emailPrefix}-${randomSuffix}`;

  const { data: created, error: createError } = await supabase
    .from("calendar_booking_profiles")
    .insert({
      organization_id: userContext.organization.id,
      user_id: userContext.user.id,
      slug: baseSlug,
      title: "30 Min Consultation",
      description:
        "Quick 30-minute introductory meeting to discuss project requirements.",
      duration_minutes: 30,
      buffer_before_minutes: 0,
      buffer_after_minutes: 10,
      is_active: true,
      weekly_availability: DEFAULT_WEEKLY_AVAILABILITY,
    })
    .select()
    .single();

  if (createError) {
    console.error(
      "[calendar] create default booking profile error:",
      createError.message
    );
    return null;
  }

  return toBookingProfileRow(created);
}

export async function updateMyBookingProfile(
  payload: BookingProfileInput
): Promise<
  | { status: "success"; data: BookingProfileRow }
  | { status: "error"; error: string; fieldErrors?: Record<string, string[]> }
> {
  const userContext = await getCurrentUserContext();
  if (!userContext || !userContext.organization) {
    return { status: "error", error: "Unauthorized" };
  }

  const parsed = bookingProfileInputSchema.safeParse(payload);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return { status: "error", error: "Validation failed", fieldErrors };
  }

  const supabase = await createServerClient();
  const orgId = userContext.organization.id;
  const userId = userContext.user.id;

  const { data: existingSlug } = await supabase
    .from("calendar_booking_profiles")
    .select("id")
    .eq("organization_id", orgId)
    .eq("slug", parsed.data.slug)
    .neq("user_id", userId)
    .maybeSingle();

  if (existingSlug) {
    return {
      status: "error",
      error: "This booking link slug is already in use by another team member.",
      fieldErrors: { slug: ["This slug is already in use."] },
    };
  }

  const { data: updated, error } = await supabase
    .from("calendar_booking_profiles")
    .upsert(
      {
        organization_id: orgId,
        user_id: userId,
        slug: parsed.data.slug,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        duration_minutes: parsed.data.durationMinutes,
        buffer_before_minutes: parsed.data.bufferBeforeMinutes,
        buffer_after_minutes: parsed.data.bufferAfterMinutes,
        is_active: parsed.data.isActive,
        weekly_availability: parsed.data.weeklyAvailability,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,user_id" }
    )
    .select()
    .single();

  if (error) {
    console.error("[calendar] updateMyBookingProfile error:", error.message);
    return { status: "error", error: error.message };
  }

  revalidatePath("/calendar");
  revalidatePath(`/book/${parsed.data.slug}`);
  return { status: "success", data: toBookingProfileRow(updated) };
}

export async function getAppointments(
  startDate?: string,
  endDate?: string
): Promise<AppointmentRow[]> {
  const userContext = await getCurrentUserContext();
  if (!userContext || !userContext.organization) return [];
  if (!userContext.permissions.includes("calendar.view")) return [];

  const supabase = await createServerClient();
  let query = supabase
    .from("calendar_appointments")
    .select(
      `
      id,
      organization_id,
      booking_profile_id,
      host_user_id,
      client_name,
      client_email,
      client_phone,
      notes,
      start_time,
      end_time,
      status,
      contact_id,
      deal_id,
      created_at,
      updated_at,
      host:profiles!calendar_appointments_host_user_id_fkey(id, full_name, email, avatar_url),
      contact:crm_contacts(id, name, email, phone, company),
      deal:crm_deals(id, title, value, currency, stage)
    `
    )
    .eq("organization_id", userContext.organization.id)
    .order("start_time", { ascending: true });

  if (startDate) {
    query = query.gte("start_time", startDate);
  }
  if (endDate) {
    query = query.lte("start_time", endDate);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[calendar] getAppointments error:", error.message);
    return [];
  }

  return (data ?? []).map(toAppointmentRow);
}

export async function cancelAppointment(
  appointmentId: string,
  reason?: string
): Promise<{ status: "success" } | { status: "error"; error: string }> {
  const userContext = await getCurrentUserContext();
  if (!userContext || !userContext.organization) {
    return { status: "error", error: "Unauthorized" };
  }
  if (!userContext.permissions.includes("calendar.manage")) {
    return { status: "error", error: "Permission denied." };
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("calendar_appointments")
    .update({
      status: "cancelled",
      notes: reason ? `Cancelled: ${reason}` : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", appointmentId)
    .eq("organization_id", userContext.organization.id);

  if (error) {
    console.error("[calendar] cancelAppointment error:", error.message);
    return { status: "error", error: error.message };
  }

  revalidatePath("/calendar");
  return { status: "success" };
}

export async function getPublicBookingProfileBySlug(
  slug: string,
  orgSlug?: string
): Promise<PublicBookingProfile | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("get_public_booking_profile", {
    p_profile_slug: slug,
    p_org_slug: orgSlug || null,
  });

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    slug: data.slug,
    title: data.title,
    description: data.description ?? null,
    durationMinutes: Number(data.duration_minutes ?? 30),
    bufferBeforeMinutes: Number(data.buffer_before_minutes ?? 0),
    bufferAfterMinutes: Number(data.buffer_after_minutes ?? 10),
    weeklyAvailability: data.weekly_availability ?? DEFAULT_WEEKLY_AVAILABILITY,
    hostName: data.host_name ?? "Host",
    hostAvatar: data.host_avatar ?? null,
    hostEmail: data.host_email ?? "",
    orgName: data.org_name ?? "Organization",
    orgSlug: data.org_slug ?? "",
    existingAppointments: data.existing_appointments ?? [],
  };
}

export interface TimeSlotOption {
  time: string; // "09:00", "09:30"
  startIso: string;
  endIso: string;
  available: boolean;
}

export async function getPublicBookingSlots(
  profileSlug: string,
  dateStr: string, // YYYY-MM-DD
  orgSlug?: string
): Promise<{ profile: PublicBookingProfile | null; slots: TimeSlotOption[]; error?: string }> {
  const profile = await getPublicBookingProfileBySlug(profileSlug, orgSlug);
  if (!profile) {
    return { profile: null, slots: [], error: "Booking profile not found" };
  }

  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);

  const targetDate = new Date(year, month, day);
  const daysMap: DayOfWeek[] = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const dayName = daysMap[targetDate.getDay()];
  const dayWindows = profile.weeklyAvailability[dayName] || [];

  const slots: TimeSlotOption[] = [];
  const duration = profile.durationMinutes;
  const bufferAfter = profile.bufferAfterMinutes;
  const existingAppts = profile.existingAppointments || [];

  const now = new Date();

  for (const window of dayWindows) {
    const [startH, startM] = window.start.split(":").map(Number);
    const [endH, endM] = window.end.split(":").map(Number);

    let currentMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    while (currentMinutes + duration <= endMinutes) {
      const slotHour = Math.floor(currentMinutes / 60);
      const slotMin = currentMinutes % 60;
      const timeLabel = `${String(slotHour).padStart(2, "0")}:${String(slotMin).padStart(2, "0")}`;

      const slotStart = new Date(year, month, day, slotHour, slotMin, 0, 0);
      const slotEnd = new Date(slotStart.getTime() + duration * 60 * 1000);

      // Check if in the past (allow 10 minute leeway)
      const isPast = slotStart.getTime() < now.getTime() + 10 * 60 * 1000;

      // Check overlap with existing confirmed appointments
      const hasOverlap = existingAppts.some((appt) => {
        const apptStart = new Date(appt.start_time).getTime();
        const apptEnd = new Date(appt.end_time).getTime();
        return slotStart.getTime() < apptEnd && slotEnd.getTime() > apptStart;
      });

      slots.push({
        time: timeLabel,
        startIso: slotStart.toISOString(),
        endIso: slotEnd.toISOString(),
        available: !isPast && !hasOverlap,
      });

      currentMinutes += duration + bufferAfter;
    }
  }

  return { profile, slots };
}

export async function bookPublicAppointment(
  input: PublicAppointmentInput
): Promise<
  | { status: "success"; data: any }
  | { status: "error"; error: string; fieldErrors?: Record<string, string[]> }
> {
  const parsed = publicAppointmentInputSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return { status: "error", error: "Validation failed", fieldErrors };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("book_public_appointment", {
    p_booking_profile_id: parsed.data.bookingProfileId,
    p_client_name: parsed.data.clientName,
    p_client_email: parsed.data.clientEmail,
    p_client_phone: parsed.data.clientPhone || null,
    p_notes: parsed.data.notes || null,
    p_start_time: parsed.data.startTime,
  });

  if (error) {
    console.error("[calendar] bookPublicAppointment error:", error.message);
    return { status: "error", error: error.message };
  }

  if (!data?.success) {
    return {
      status: "error",
      error:
        data?.error ||
        "Could not book appointment. Slot might no longer be available.",
    };
  }

  // Dispatch automated notification to the host team member
  try {
    const orgId = data.organization_id;
    const hostUserId = data.host_user_id;
    if (orgId && hostUserId) {
      await dispatchNotification({
        orgId,
        userId: hostUserId,
        title: "New Appointment Booked",
        message: `${data.client_name} booked ${data.title}`,
        type: "booking",
        link: `/calendar?appointmentId=${data.appointment_id}`,
      });
    }
  } catch (err) {
    console.error("[calendar] Failed to dispatch appointment notification:", err);
  }

  revalidatePath("/calendar");
  return { status: "success", data };
}


