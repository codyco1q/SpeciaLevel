"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import type { ClockActionState } from "@/lib/validations/time-tracking";

/**
 * Time tracking server actions (clock in / clock out / overview data).
 *
 * Security model:
 *  - `organization_id` and `user_id` are NEVER accepted as arguments —
 *    they come exclusively from `getCurrentUserContext()`, so a caller
 *    can only ever touch rows inside their own organization, as themselves.
 *  - `clockIn` / `clockOut` require `time_tracking.manage_self`.
 *  - Personal data requires `time_tracking.view_self`.
 *  - The team attendance list additionally requires
 *    `time_tracking.view_team` (otherwise `teamNow` is null).
 *  - Invalid states are rejected at the app layer AND enforced by the
 *    database (00005: status<=>clocked_out_at check + partial unique
 *    index allowing a single open entry per user).
 */

export interface ActiveTimeEntry {
  id: string;
  clockedInAt: string;
}

export interface TimeEntryRow {
  id: string;
  clockedInAt: string;
  clockedOutAt: string | null;
  durationSeconds: number | null;
  status: "active" | "completed";
}

export interface TeamMemberRow {
  userId: string;
  fullName: string;
  departmentName: string | null;
  clockedInAt: string;
}

export interface TimeTrackingData {
  canManageSelf: boolean;
  canViewTeam: boolean;
  activeEntry: ActiveTimeEntry | null;
  /** Seconds accumulated since 00:00 UTC today (completed + active part). */
  todayTotalSeconds: number;
  serverNowIso: string;
  recentEntries: TimeEntryRow[];
  /** Null unless the caller holds `time_tracking.view_team`. */
  teamNow: TeamMemberRow[] | null;
}

type AuthResult =
  | { ok: true; organizationId: string; userId: string }
  | { ok: false; error: ClockActionState };

async function authorizeTimeTracking(
  permission: "time_tracking.view_self" | "time_tracking.manage_self"
): Promise<AuthResult> {
  const userContext = await getCurrentUserContext();

  if (!userContext) {
    return {
      ok: false,
      error: { status: "error", error: "You must be signed in to do this." },
    };
  }

  const organizationId = userContext.organization?.id;

  if (!organizationId) {
    return {
      ok: false,
      error: {
        status: "error",
        error: "Set up your organization before tracking time.",
      },
    };
  }

  if (!userContext.permissions.includes(permission)) {
    return {
      ok: false,
      error: {
        status: "error",
        error: "You don't have permission to track time.",
      },
    };
  }

  return { ok: true, organizationId, userId: userContext.user.id };
}

/** Latest open entry (clocked_out_at IS NULL) for the caller, if any. */
async function findOpenEntry(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string,
  organizationId: string
) {
  const { data, error } = await supabase
    .from("time_entries")
    .select("id, clocked_in_at")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .is("clocked_out_at", null)
    .order("clocked_in_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { error };
  return { entry: (data ?? null) as { id: string; clocked_in_at: string } | null };
}

/**
 * Clock in: inserts an open entry stamped NOW().
 * Rejects when the caller already has an open entry.
 */
export async function clockIn(): Promise<ClockActionState> {
  const auth = await authorizeTimeTracking("time_tracking.manage_self");

  if (!auth.ok) {
    return auth.error;
  }

  const supabase = await createServerClient();

  const { entry, error: lookupError } = await findOpenEntry(
    supabase,
    auth.userId,
    auth.organizationId
  );

  if (lookupError) {
    return {
      status: "error",
      error: "Could not check your current status. Please try again.",
    };
  }

  if (entry) {
    return {
      status: "error",
      error: "You're already clocked in. Clock out before clocking in again.",
    };
  }

  const { error } = await supabase.from("time_entries").insert({
    organization_id: auth.organizationId,
    user_id: auth.userId,
    clocked_in_at: new Date().toISOString(),
    status: "active",
  });

  if (error) {
    // Partial unique index: exactly one open entry per user (race-proof).
    if (error.code === "23505") {
      return {
        status: "error",
        error: "You're already clocked in. Clock out before clocking in again.",
      };
    }
    return {
      status: "error",
      error: "Could not clock you in. Please try again.",
    };
  }

  revalidatePath("/time");
  revalidatePath("/dashboard");
  return { status: "success" };
}

/**
 * Clock out: closes the open entry, stamps clocked_out_at = NOW() and
 * stores the session duration in seconds.
 * Rejects when the caller has no open entry.
 */
export async function clockOut(): Promise<ClockActionState> {
  const auth = await authorizeTimeTracking("time_tracking.manage_self");

  if (!auth.ok) {
    return auth.error;
  }

  const supabase = await createServerClient();

  const { entry, error: lookupError } = await findOpenEntry(
    supabase,
    auth.userId,
    auth.organizationId
  );

  if (lookupError) {
    return {
      status: "error",
      error: "Could not check your current status. Please try again.",
    };
  }

  if (!entry) {
    return {
      status: "error",
      error: "You're not clocked in. Clock in before clocking out.",
    };
  }

  const now = new Date();
  const durationSeconds = Math.max(
    0,
    Math.floor(
      (now.getTime() - new Date(entry.clocked_in_at).getTime()) / 1000
    )
  );

  const { error } = await supabase
    .from("time_entries")
    .update({
      clocked_out_at: now.toISOString(),
      duration_seconds: durationSeconds,
      status: "completed",
    })
    .eq("id", entry.id)
    .eq("user_id", auth.userId)
    .eq("organization_id", auth.organizationId);

  if (error) {
    return {
      status: "error",
      error: "Could not clock you out. Please try again.",
    };
  }

  revalidatePath("/time");
  revalidatePath("/dashboard");
  return { status: "success" };
}

/** Start of the current UTC day (profiles carry no timezone yet). */
function startOfTodayUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Overview data for the /time page. Returns null when the caller may
 * not view time tracking at all (page renders the denied state).
 */
export async function getTimeTrackingData(): Promise<TimeTrackingData | null> {
  const userContext = await getCurrentUserContext();

  if (!userContext || !userContext.organization) {
    return null;
  }

  if (!userContext.permissions.includes("time_tracking.view_self")) {
    return null;
  }

  const organizationId = userContext.organization.id;
  const userId = userContext.user.id;
  const canManageSelf = userContext.permissions.includes(
    "time_tracking.manage_self"
  );
  const canViewTeam = userContext.permissions.includes(
    "time_tracking.view_team"
  );

  const supabase = await createServerClient();
  const now = new Date();
  const dayStart = startOfTodayUtc(now);

  // Personal entries (newest first; RLS scopes to the organization).
  const { data: entries, error: entriesError } = await supabase
    .from("time_entries")
    .select("id, clocked_in_at, clocked_out_at, duration_seconds, status")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .order("clocked_in_at", { ascending: false })
    .limit(30);

  if (entriesError || !entries) {
    return null;
  }

  const rows: TimeEntryRow[] = entries.map((e) => ({
    id: e.id as string,
    clockedInAt: e.clocked_in_at as string,
    clockedOutAt: (e.clocked_out_at ?? null) as string | null,
    durationSeconds: (e.duration_seconds ?? null) as number | null,
    status: (e.status ?? "completed") as "active" | "completed",
  }));

  const activeEntry: ActiveTimeEntry | null =
    rows.length > 0 && rows[0].status === "active"
      ? { id: rows[0].id, clockedInAt: rows[0].clockedInAt }
      : null;

  // Today's total: completed sessions started today + the active session's
  // share of today (clamped so a session started yesterday doesn't leak
  // yesterday's hours into today).
  let todayTotalSeconds = 0;
  for (const row of rows) {
    const clockedIn = new Date(row.clockedInAt);
    if (Number.isNaN(clockedIn.getTime()) || clockedIn < dayStart) {
      continue;
    }
    if (row.status === "completed") {
      todayTotalSeconds += row.durationSeconds ?? 0;
    } else {
      todayTotalSeconds += Math.max(
        0,
        Math.floor((now.getTime() - clockedIn.getTime()) / 1000)
      );
    }
  }

  // Team attendance: everyone currently clocked in (managers+).
  let teamNow: TeamMemberRow[] | null = null;
  if (canViewTeam) {
    const { data: openEntries } = await supabase
      .from("time_entries")
      .select(
        `
          user_id,
          clocked_in_at,
          profile:profiles!inner(full_name, department:departments(name))
        `
      )
      .eq("organization_id", organizationId)
      .is("clocked_out_at", null)
      .order("clocked_in_at", { ascending: true });

    teamNow = (
      (openEntries ?? []) as unknown as {
        user_id: string;
        clocked_in_at: string;
        profile: {
          full_name?: string | null;
          department?: { name?: string } | { name?: string }[] | null;
        } | null;
      }[]
    ).map((row) => {
      const dep = row.profile?.department;
      return {
        userId: row.user_id,
        fullName: row.profile?.full_name ?? "Unnamed",
        departmentName:
          (Array.isArray(dep) ? dep[0]?.name : dep?.name) ?? null,
        clockedInAt: row.clocked_in_at,
      };
    });
  }

  return {
    canManageSelf,
    canViewTeam,
    activeEntry,
    todayTotalSeconds,
    serverNowIso: now.toISOString(),
    recentEntries: rows,
    teamNow,
  };
}
