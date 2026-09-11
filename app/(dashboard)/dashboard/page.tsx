import { redirect } from "next/navigation";
import Link from "next/link";
import {
  CalendarDays,
  Users,
  Building2,
  ArrowRight,
  Clock,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { getCurrentUserContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/rbac";
import { createServerClient } from "@/lib/supabase/server";
import { getTimeTrackingData } from "@/lib/actions/time-tracking";
import { Badge } from "@/components/ui/badge";
import { QuickClockButton } from "./quick-clock-button";
import { ModulesGrid } from "@/components/modules-grid";

export const dynamic = "force-dynamic";

// ────────────────────────────────────────────────────────────
// Pure display helpers (server-side, zero deps)
// ────────────────────────────────────────────────────────────

/** Highest-priority role for a user's assignment list. */
function getHighestRole(
  roles: { name: string; key: string }[]
): { label: string; variant: "default" | "secondary" | "outline" } {
  if (roles.length === 0) return { label: "Member", variant: "outline" };
  const priority: Record<string, number> = {
    owner: 0,
    admin: 1,
    manager: 2,
    employee: 3,
  };
  const highest = [...roles].sort(
    (a, b) => (priority[a.key] ?? 99) - (priority[b.key] ?? 99)
  )[0];
  return {
    label: highest.name,
    variant: highest.key === "owner" ? "default" : "secondary",
  };
}

function formatFullDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatEventTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatEventDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

// ────────────────────────────────────────────────────────────
// Presentational building blocks (pure server components)
// ────────────────────────────────────────────────────────────

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: number;
  hint: string;
}

function MetricCard({ icon: Icon, label, value, hint }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{label}</h3>
      </div>
      <p className="text-3xl font-bold tracking-tight tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

interface SectionCardProps {
  icon: LucideIcon;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

function SectionCard({
  icon: Icon,
  title,
  action,
  children,
  className = "",
}: SectionCardProps) {
  return (
    <div
      className={`rounded-xl border border-border bg-card p-6 shadow-sm ${className}`}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const userContext = await getCurrentUserContext();
  if (!userContext) redirect("/login");
  if (!userContext.organization) redirect("/onboarding");

  const { profile, organization, permissions, roles } = userContext;
  const organizationId = organization.id;

  const supabase = await createServerClient();

  // Permission flags
  const canViewTime = hasPermission("time_tracking.view_self", permissions);
  const canViewCalendar = hasPermission("calendar.view", permissions);
  const canViewEmployees = hasPermission("employees.view", permissions);
  const canViewDepartments = hasPermission("departments.view", permissions);
  const canViewTeamTime = hasPermission("time_tracking.view_team", permissions);

  const showMetrics = canViewEmployees || canViewDepartments || canViewTeamTime;

  // ── Parallel data fetching (single round, zero layout shift) ──
  const [
    timeData,
    eventsResult,
    employeeCountResult,
    departmentCountResult,
    clockedInCountResult,
    modulesResult,
    departmentResult,
  ] = await Promise.all([
    // Personal time tracking summary
    canViewTime ? getTimeTrackingData() : Promise.resolve(null),

    // Upcoming calendar events (next 5, not yet ended)
    canViewCalendar
      ? supabase
          .from("calendar_events")
          .select("id, title, starts_at, ends_at, all_day, location")
          .eq("organization_id", organizationId)
          .gte("ends_at", new Date().toISOString())
          .order("starts_at", { ascending: true })
          .limit(5)
      : Promise.resolve({ data: null }),

    // Admin / manager metrics
    canViewEmployees
      ? supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .eq("is_active", true)
      : Promise.resolve({ count: 0 }),

    canViewDepartments
      ? supabase
          .from("departments")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId)
      : Promise.resolve({ count: 0 }),

    canViewTeamTime
      ? supabase
          .from("time_entries")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .is("clocked_out_at", null)
      : Promise.resolve({ count: 0 }),

    // Organization modules (for the showcase grid)
    supabase
      .from("organization_modules")
      .select("module_key, module_name, is_enabled")
      .eq("organization_id", organizationId),

    // User's department name for the personalized header
    profile.department_id
      ? supabase
          .from("departments")
          .select("name")
          .eq("id", profile.department_id)
          .single()
      : Promise.resolve({ data: null }),
  ]);

  const upcomingEvents = eventsResult.data ?? [];
  const orgModulesData = modulesResult.data ?? [];
  const departmentName = departmentResult.data?.name ?? null;
  const roleBadge = getHighestRole(roles);
  const now = new Date();

  return (
    <div className="p-8">
      {/* ── Personalized header ──────────────────────────────── */}
      <div className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Welcome back
              {profile.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {organization.name}
              </span>
              <span className="text-border">·</span>
              {departmentName ? (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" />
                  {departmentName}
                </span>
              ) : (
                <span>No department assigned</span>
              )}
              <span className="text-border">·</span>
              <Badge variant={roleBadge.variant} className="text-xs font-medium">
                {roleBadge.label}
              </Badge>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{formatFullDate(now)}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ── Quick status & time tracking ───────────────────── */}
        {canViewTime && timeData ? (
          <SectionCard icon={Clock} title="Time Tracking">
            <QuickClockButton
              activeEntry={timeData.activeEntry}
              todayTotalSeconds={timeData.todayTotalSeconds}
              serverNowIso={timeData.serverNowIso}
              canManageSelf={timeData.canManageSelf}
            />
          </SectionCard>
        ) : null}

        {/* ── Upcoming events widget ─────────────────────────── */}
        {canViewCalendar ? (
          <SectionCard
            icon={CalendarDays}
            title="Upcoming Events"
            className="lg:col-span-2"
            action={
              <Link
                href="/calendar"
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                View calendar
                <ArrowRight className="h-3 w-3" />
              </Link>
            }
          >
            {upcomingEvents.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-8 text-center">
                <p className="text-sm font-medium">No upcoming events</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Your upcoming events will appear here.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {upcomingEvents.map((event) => {
                  const eventDate = new Date(event.starts_at);
                  const isToday =
                    eventDate.toDateString() === now.toDateString();
                  return (
                    <li
                      key={event.id}
                      className="flex items-center gap-3 rounded-md border border-border/60 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {event.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {isToday
                            ? "Today"
                            : formatEventDate(event.starts_at)}{" "}
                          at {formatEventTime(event.starts_at)}
                          {event.location && (
                            <span className="ml-1.5">· {event.location}</span>
                          )}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>
        ) : null}
      </div>

      {/* ── Admin / manager metric overview ──────────────────── */}
      {showMetrics && (
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {canViewEmployees && (
            <MetricCard
              icon={Users}
              label="Employees"
              value={employeeCountResult.count ?? 0}
              hint="Active team members"
            />
          )}
          {canViewDepartments && (
            <MetricCard
              icon={Building2}
              label="Departments"
              value={departmentCountResult.count ?? 0}
              hint="Active departments"
            />
          )}
          {canViewTeamTime && (
            <MetricCard
              icon={Clock}
              label="Clocked In"
              value={clockedInCountResult.count ?? 0}
              hint="Currently working"
            />
          )}
        </div>
      )}

      {/* ── Modules showcase ─────────────────────────────────── */}
      <div className="mt-8">
        <SectionCard
          icon={Sparkles}
          title="Modules"
          action={
            <Link
              href="/modules"
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Explore apps
              <ArrowRight className="h-3 w-3" />
            </Link>
          }
        >
          <ModulesGrid activeModules={orgModulesData} compact />
        </SectionCard>
      </div>
    </div>
  );
}
