"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
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
  userId?: string;
  userName?: string;
  userEmail?: string;
  departmentName?: string | null;
  roleName?: string | null;
  clockedInAt: string;
  clockedOutAt: string | null;
  durationSeconds: number | null;
  status: "active" | "completed";
  notes?: string | null;
}

export interface TeamMemberRow {
  userId: string;
  fullName: string;
  departmentName: string | null;
  clockedInAt: string;
}

export interface DayBreakdown {
  date: string;
  dayOfWeek: number; // 0 = Mon, 6 = Sun
  dayLabel: string;
  totalSeconds: number;
  isToday: boolean;
  entriesCount: number;
}

export interface WeekBreakdown {
  weekNumber: number;
  weekLabel: string;
  startDate: string;
  endDate: string;
  totalSeconds: number;
  isCurrentWeek: boolean;
  entriesCount: number;
}

export interface PersonalStats {
  todaySeconds: number;
  weekSeconds: number;
  monthSeconds: number;
  allTimeSeconds: number;
  weekDays: DayBreakdown[];
  monthWeeks: WeekBreakdown[];
  todayEntries: TimeEntryRow[];
  weekEntries: TimeEntryRow[];
  monthEntries: TimeEntryRow[];
  totalSessionsThisMonth: number;
  averageDailySecondsThisWeek: number;
}

export interface TeamMemberSummary {
  userId: string;
  fullName: string;
  email: string;
  departmentName: string | null;
  roleName: string | null;
  isClockedIn: boolean;
  activeClockedInAt: string | null;
  activeSeconds: number | null;
  todaySeconds: number;
  weekSeconds: number;
  monthSeconds: number;
  totalEntriesCount: number;
  lastActiveAt: string | null;
}

export interface DepartmentSummary {
  departmentId: string | null;
  departmentName: string;
  activeMembersCount: number;
  totalMembersCount: number;
  todaySeconds: number;
  weekSeconds: number;
  monthSeconds: number;
}

export interface TeamInsights {
  teamTodaySeconds: number;
  teamWeekSeconds: number;
  teamMonthSeconds: number;
  currentlyClockedInCount: number;
  totalEmployeesCount: number;
  members: TeamMemberSummary[];
  departments: DepartmentSummary[];
  allTeamEntries: TimeEntryRow[];
}

export interface TimeTrackingData {
  canManageSelf: boolean;
  canViewTeam: boolean;
  canManageTeam: boolean;
  activeEntry: ActiveTimeEntry | null;
  /** Seconds accumulated today (00:00 UTC to now). */
  todayTotalSeconds: number;
  /** Seconds accumulated this week (Monday 00:00 UTC to now). */
  weekTotalSeconds: number;
  /** Seconds accumulated this month (1st 00:00 UTC to now). */
  monthTotalSeconds: number;
  serverNowIso: string;
  personalStats: PersonalStats;
  recentEntries: TimeEntryRow[];
  /** Null unless the caller holds `time_tracking.view_team`. */
  teamNow: TeamMemberRow[] | null;
  /** Full insights for managers, admins, and owners. */
  teamInsights: TeamInsights | null;
}

type AuthResult =
  | { ok: true; organizationId: string; userId: string; permissions: string[] }
  | { ok: false; error: ClockActionState };

async function authorizeTimeTracking(
  permission:
    | "time_tracking.view_self"
    | "time_tracking.manage_self"
    | "time_tracking.view_team"
    | "time_tracking.manage_team"
): Promise<AuthResult> {
  const userContext = await getCurrentUserContext();
  const dict = await getDictionary();
  const err = dict.platform.time.errors;

  if (!userContext) {
    return {
      ok: false,
      error: { status: "error", error: err.signedIn },
    };
  }

  const organizationId = userContext.organization?.id;

  if (!organizationId) {
    return {
      ok: false,
      error: {
        status: "error",
        error: err.setupOrganization,
      },
    };
  }

  if (!userContext.permissions.includes(permission)) {
    return {
      ok: false,
      error: {
        status: "error",
        error: err.noPermission,
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

  const dict = await getDictionary();
  const err = dict.platform.time.errors;

  const supabase = await createServerClient();

  const { entry, error: lookupError } = await findOpenEntry(
    supabase,
    auth.userId,
    auth.organizationId
  );

  if (lookupError) {
    return {
      status: "error",
      error: err.checkStatusFailed,
    };
  }

  if (entry) {
    return {
      status: "error",
      error: err.alreadyClockedIn,
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
        error: err.alreadyClockedIn,
      };
    }
    return {
      status: "error",
      error: err.clockInFailed,
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

  const dict = await getDictionary();
  const err = dict.platform.time.errors;

  const supabase = await createServerClient();

  const { entry, error: lookupError } = await findOpenEntry(
    supabase,
    auth.userId,
    auth.organizationId
  );

  if (lookupError) {
    return {
      status: "error",
      error: err.checkStatusFailed,
    };
  }

  if (!entry) {
    return {
      status: "error",
      error: err.notClockedIn,
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
      error: err.clockOutFailed,
    };
  }

  revalidatePath("/time");
  revalidatePath("/dashboard");
  return { status: "success" };
}

/** Start of the current UTC day (00:00:00 UTC). */
function startOfTodayUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Start of the current UTC week (Monday 00:00:00 UTC). */
function startOfWeekUtc(now: Date): Date {
  const today = startOfTodayUtc(now);
  const day = today.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const offset = (day + 6) % 7; // Mon = 0, Sun = 6
  const weekStart = new Date(today);
  weekStart.setUTCDate(today.getUTCDate() - offset);
  return weekStart;
}

/** Start of the current UTC month (1st of month 00:00:00 UTC). */
function startOfMonthUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Compute overlap of entries with a given time window [windowStart, windowEnd]. */
function calculateSecondsInWindow(
  entries: {
    clocked_in_at: string;
    clocked_out_at: string | null;
    duration_seconds?: number | null;
  }[],
  windowStart: Date,
  windowEnd: Date,
  now: Date
): number {
  let total = 0;
  const wStartMs = windowStart.getTime();
  const wEndMs = windowEnd.getTime();

  for (const entry of entries) {
    const startMs = new Date(entry.clocked_in_at).getTime();
    if (Number.isNaN(startMs)) continue;
    const endMs = entry.clocked_out_at
      ? new Date(entry.clocked_out_at).getTime()
      : now.getTime();
    if (Number.isNaN(endMs)) continue;

    const effStart = Math.max(startMs, wStartMs);
    const effEnd = Math.min(endMs, wEndMs);

    if (effEnd > effStart) {
      total += Math.floor((effEnd - effStart) / 1000);
    }
  }

  return total;
}

/**
 * Admin action: force clock out an open entry for any team member.
 */
export async function adminClockOutUser(targetUserId: string): Promise<ClockActionState> {
  const auth = await authorizeTimeTracking("time_tracking.view_team");
  if (!auth.ok) return auth.error;

  const dict = await getDictionary();
  const err = dict.platform.time.errors;
  const supabase = await createServerClient();

  const { entry, error: lookupError } = await findOpenEntry(
    supabase,
    targetUserId,
    auth.organizationId
  );

  if (lookupError || !entry) {
    return {
      status: "error",
      error: err.notClockedIn,
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
    .eq("organization_id", auth.organizationId);

  if (error) {
    return {
      status: "error",
      error: err.clockOutFailed,
    };
  }

  revalidatePath("/time");
  revalidatePath("/dashboard");
  return { status: "success" };
}

/**
 * Admin action: create a manual past time entry.
 */
export async function adminAddManualEntry(data: {
  userId: string;
  clockedInAt: string;
  clockedOutAt: string;
  notes?: string;
}): Promise<ClockActionState> {
  const auth = await authorizeTimeTracking("time_tracking.manage_team");
  if (!auth.ok) return auth.error;

  const dict = await getDictionary();
  const err = dict.platform.time.errors;

  const inDate = new Date(data.clockedInAt);
  const outDate = new Date(data.clockedOutAt);

  if (
    Number.isNaN(inDate.getTime()) ||
    Number.isNaN(outDate.getTime()) ||
    outDate <= inDate
  ) {
    return {
      status: "error",
      error: err.invalidTimeRange,
    };
  }

  const durationSeconds = Math.max(
    0,
    Math.floor((outDate.getTime() - inDate.getTime()) / 1000)
  );

  const supabase = await createServerClient();

  const { error } = await supabase.from("time_entries").insert({
    organization_id: auth.organizationId,
    user_id: data.userId,
    clocked_in_at: inDate.toISOString(),
    clocked_out_at: outDate.toISOString(),
    duration_seconds: durationSeconds,
    status: "completed",
    notes: data.notes?.trim() || null,
  });

  if (error) {
    return {
      status: "error",
      error: err.manualEntryFailed,
    };
  }

  revalidatePath("/time");
  revalidatePath("/dashboard");
  return { status: "success" };
}

/**
 * Admin action: delete a time entry.
 */
export async function adminDeleteEntry(entryId: string): Promise<ClockActionState> {
  const auth = await authorizeTimeTracking("time_tracking.manage_team");
  if (!auth.ok) return auth.error;

  const dict = await getDictionary();
  const err = dict.platform.time.errors;
  const supabase = await createServerClient();

  const { error } = await supabase
    .from("time_entries")
    .delete()
    .eq("id", entryId)
    .eq("organization_id", auth.organizationId);

  if (error) {
    return {
      status: "error",
      error: err.deleteFailed,
    };
  }

  revalidatePath("/time");
  revalidatePath("/dashboard");
  return { status: "success" };
}

export const deleteTimeEntry = adminDeleteEntry;

/**
 * Comprehensive Time Tracking Data Loader.
 * Computes exact daily, weekly (auto-refreshing), and monthly totals.
 * Emits full insights for Admins/Owners/Managers and scoped metrics for Employees.
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
  const canManageSelf = userContext.permissions.includes("time_tracking.manage_self");
  const canViewTeam = userContext.permissions.includes("time_tracking.view_team");
  const canManageTeam = userContext.permissions.includes("time_tracking.manage_team");

  const supabase = await createServerClient();
  const now = new Date();
  const dayStart = startOfTodayUtc(now);
  const weekStart = startOfWeekUtc(now);
  const monthStart = startOfMonthUtc(now);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  // 1. Fetch personal entries
  const { data: entries, error: entriesError } = await supabase
    .from("time_entries")
    .select("id, clocked_in_at, clocked_out_at, duration_seconds, status, notes")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .order("clocked_in_at", { ascending: false })
    .limit(100);

  if (entriesError || !entries) {
    return null;
  }

  const rows: TimeEntryRow[] = entries.map((e) => ({
    id: e.id as string,
    clockedInAt: e.clocked_in_at as string,
    clockedOutAt: (e.clocked_out_at ?? null) as string | null,
    durationSeconds: (e.duration_seconds ?? null) as number | null,
    status: (e.status ?? "completed") as "active" | "completed",
    notes: (e.notes ?? null) as string | null,
  }));

  const activeEntry: ActiveTimeEntry | null =
    rows.length > 0 && rows[0].status === "active"
      ? { id: rows[0].id, clockedInAt: rows[0].clockedInAt }
      : null;

  // Compute personal Day, Week, Month totals
  const todayTotalSeconds = calculateSecondsInWindow(entries, dayStart, dayEnd, now);
  const weekTotalSeconds = calculateSecondsInWindow(entries, weekStart, weekEnd, now);
  const monthTotalSeconds = calculateSecondsInWindow(entries, monthStart, nextMonthStart, now);

  let allTimeSeconds = 0;
  for (const row of rows) {
    if (row.status === "completed") {
      allTimeSeconds += row.durationSeconds ?? 0;
    } else {
      const cIn = new Date(row.clockedInAt);
      if (!Number.isNaN(cIn.getTime())) {
        allTimeSeconds += Math.max(0, Math.floor((now.getTime() - cIn.getTime()) / 1000));
      }
    }
  }

  // Build 7-day breakdown for the current week (Monday through Sunday)
  const weekDayLabels = [
    "weekDayMon",
    "weekDayTue",
    "weekDayWed",
    "weekDayThu",
    "weekDayFri",
    "weekDaySat",
    "weekDaySun",
  ];

  const weekDays: DayBreakdown[] = Array.from({ length: 7 }, (_, i) => {
    const dStart = new Date(weekStart.getTime() + i * 24 * 60 * 60 * 1000);
    const dEnd = new Date(dStart.getTime() + 24 * 60 * 60 * 1000);
    const totalSecs = calculateSecondsInWindow(entries, dStart, dEnd, now);
    const dateStr = dStart.toISOString().split("T")[0];
    const isToday = dStart.getTime() === dayStart.getTime();

    const entriesCount = entries.filter((e) => {
      const st = new Date(e.clocked_in_at).getTime();
      return st >= dStart.getTime() && st < dEnd.getTime();
    }).length;

    return {
      date: dateStr,
      dayOfWeek: i,
      dayLabel: weekDayLabels[i],
      totalSeconds: totalSecs,
      isToday,
      entriesCount,
    };
  });

  // Build week-by-week breakdown for the current month
  const monthWeeks: WeekBreakdown[] = [];
  let curWeekStart = new Date(monthStart);
  let weekNum = 1;

  while (curWeekStart < nextMonthStart) {
    const curWeekEnd = new Date(
      Math.min(
        curWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000,
        nextMonthStart.getTime()
      )
    );

    const totalSecs = calculateSecondsInWindow(entries, curWeekStart, curWeekEnd, now);
    const isCurrentWeek = now >= curWeekStart && now < curWeekEnd;
    const entriesCount = entries.filter((e) => {
      const st = new Date(e.clocked_in_at).getTime();
      return st >= curWeekStart.getTime() && st < curWeekEnd.getTime();
    }).length;

    monthWeeks.push({
      weekNumber: weekNum,
      weekLabel: `Week ${weekNum}`,
      startDate: curWeekStart.toISOString().split("T")[0],
      endDate: new Date(curWeekEnd.getTime() - 1000).toISOString().split("T")[0],
      totalSeconds: totalSecs,
      isCurrentWeek,
      entriesCount,
    });

    curWeekStart = new Date(curWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    weekNum++;
  }

  // Filter scoped entries
  const todayEntries = rows.filter((r) => {
    const st = new Date(r.clockedInAt).getTime();
    return st >= dayStart.getTime() && st < dayEnd.getTime();
  });

  const weekEntries = rows.filter((r) => {
    const st = new Date(r.clockedInAt).getTime();
    return st >= weekStart.getTime() && st < weekEnd.getTime();
  });

  const monthEntries = rows.filter((r) => {
    const st = new Date(r.clockedInAt).getTime();
    return st >= monthStart.getTime() && st < nextMonthStart.getTime();
  });

  const daysWithHours = weekDays.filter((d) => d.totalSeconds > 0).length;
  const averageDailySecondsThisWeek =
    daysWithHours > 0 ? Math.round(weekTotalSeconds / daysWithHours) : 0;

  const personalStats: PersonalStats = {
    todaySeconds: todayTotalSeconds,
    weekSeconds: weekTotalSeconds,
    monthSeconds: monthTotalSeconds,
    allTimeSeconds,
    weekDays,
    monthWeeks,
    todayEntries,
    weekEntries,
    monthEntries,
    totalSessionsThisMonth: monthEntries.length,
    averageDailySecondsThisWeek,
  };

  // 2. Team attendance & Full Insights (when canViewTeam is true)
  let teamNow: TeamMemberRow[] | null = null;
  let teamInsights: TeamInsights | null = null;

  if (canViewTeam) {
    const { data: profileRows } = await supabase
      .from("profiles")
      .select(`
        id,
        full_name,
        email,
        job_title,
        department_id,
        is_active,
        department:departments(name),
        roles:user_roles(role_id, roles(name, key))
      `)
      .eq("organization_id", organizationId)
      .order("full_name", { ascending: true });

    const { data: teamEntriesData } = await supabase
      .from("time_entries")
      .select("id, user_id, clocked_in_at, clocked_out_at, duration_seconds, status, notes")
      .eq("organization_id", organizationId)
      .or(`clocked_in_at.gte.${monthStart.toISOString()},clocked_out_at.is.null`)
      .order("clocked_in_at", { ascending: false });

    const { data: orgAuditEntries } = await supabase
      .from("time_entries")
      .select("id, user_id, clocked_in_at, clocked_out_at, duration_seconds, status, notes")
      .eq("organization_id", organizationId)
      .order("clocked_in_at", { ascending: false })
      .limit(200);

    const profiles = profileRows ?? [];
    const teamEntries = teamEntriesData ?? [];
    const auditEntries = orgAuditEntries ?? [];

    const profileMap = new Map<
      string,
      {
        fullName: string;
        email: string;
        departmentName: string | null;
        roleName: string | null;
      }
    >();

    for (const p of profiles) {
      const dep = p.department as { name?: string } | { name?: string }[] | null;
      const depName = (Array.isArray(dep) ? dep[0]?.name : dep?.name) ?? null;
      const userRoles = (p.roles ?? []) as { roles?: { name?: string } | { name?: string }[] }[];
      const roleObj = userRoles[0]?.roles;
      const roleName = (Array.isArray(roleObj) ? roleObj[0]?.name : roleObj?.name) ?? "Employee";

      profileMap.set(p.id, {
        fullName: p.full_name ?? "Unnamed",
        email: p.email ?? "",
        departmentName: depName,
        roleName,
      });
    }

    const openEntries = teamEntries.filter((e) => e.clocked_out_at === null);
    teamNow = openEntries.map((e) => {
      const info = profileMap.get(e.user_id);
      return {
        userId: e.user_id,
        fullName: info?.fullName ?? "Unnamed",
        departmentName: info?.departmentName ?? null,
        clockedInAt: e.clocked_in_at,
      };
    });

    let teamTodaySecs = 0;
    let teamWeekSecs = 0;
    let teamMonthSecs = 0;

    const members: TeamMemberSummary[] = profiles.map((p) => {
      const info = profileMap.get(p.id)!;
      const userEntries = teamEntries.filter((e) => e.user_id === p.id);
      const userOpenEntry = userEntries.find((e) => e.clocked_out_at === null);
      const isClockedIn = !!userOpenEntry;
      const activeClockedInAt = userOpenEntry ? userOpenEntry.clocked_in_at : null;
      const activeSecs = activeClockedInAt
        ? Math.max(0, Math.floor((now.getTime() - new Date(activeClockedInAt).getTime()) / 1000))
        : null;

      const memToday = calculateSecondsInWindow(userEntries, dayStart, dayEnd, now);
      const memWeek = calculateSecondsInWindow(userEntries, weekStart, weekEnd, now);
      const memMonth = calculateSecondsInWindow(userEntries, monthStart, nextMonthStart, now);

      teamTodaySecs += memToday;
      teamWeekSecs += memWeek;
      teamMonthSecs += memMonth;

      const lastEntry = userEntries[0];

      return {
        userId: p.id,
        fullName: info.fullName,
        email: info.email,
        departmentName: info.departmentName,
        roleName: info.roleName,
        isClockedIn,
        activeClockedInAt,
        activeSeconds: activeSecs,
        todaySeconds: memToday,
        weekSeconds: memWeek,
        monthSeconds: memMonth,
        totalEntriesCount: userEntries.length,
        lastActiveAt: lastEntry ? lastEntry.clocked_in_at : null,
      };
    });

    const deptMap = new Map<
      string,
      {
        departmentName: string;
        activeMembers: number;
        totalMembers: number;
        todaySecs: number;
        weekSecs: number;
        monthSecs: number;
      }
    >();

    for (const m of members) {
      const key = m.departmentName || "General / Unassigned";
      const existing = deptMap.get(key) || {
        departmentName: key,
        activeMembers: 0,
        totalMembers: 0,
        todaySecs: 0,
        weekSecs: 0,
        monthSecs: 0,
      };

      existing.totalMembers += 1;
      if (m.isClockedIn) existing.activeMembers += 1;
      existing.todaySecs += m.todaySeconds;
      existing.weekSecs += m.weekSeconds;
      existing.monthSecs += m.monthSeconds;

      deptMap.set(key, existing);
    }

    const departments: DepartmentSummary[] = Array.from(deptMap.entries()).map(
      ([, d]) => ({
        departmentId: null,
        departmentName: d.departmentName,
        activeMembersCount: d.activeMembers,
        totalMembersCount: d.totalMembers,
        todaySeconds: d.todaySecs,
        weekSeconds: d.weekSecs,
        monthSeconds: d.monthSecs,
      })
    );

    const allTeamEntries: TimeEntryRow[] = auditEntries.map((e) => {
      const info = profileMap.get(e.user_id);
      return {
        id: e.id,
        userId: e.user_id,
        userName: info?.fullName ?? "Unnamed",
        userEmail: info?.email ?? "",
        departmentName: info?.departmentName ?? null,
        roleName: info?.roleName ?? null,
        clockedInAt: e.clocked_in_at,
        clockedOutAt: e.clocked_out_at,
        durationSeconds: e.duration_seconds,
        status: (e.status ?? "completed") as "active" | "completed",
        notes: e.notes,
      };
    });

    teamInsights = {
      teamTodaySeconds: teamTodaySecs,
      teamWeekSeconds: teamWeekSecs,
      teamMonthSeconds: teamMonthSecs,
      currentlyClockedInCount: openEntries.length,
      totalEmployeesCount: profiles.length,
      members,
      departments,
      allTeamEntries,
    };
  }

  return {
    canManageSelf,
    canViewTeam,
    canManageTeam,
    activeEntry,
    todayTotalSeconds,
    weekTotalSeconds,
    monthTotalSeconds,
    serverNowIso: now.toISOString(),
    personalStats,
    recentEntries: rows,
    teamNow,
    teamInsights,
  };
}
