import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/rbac";
import { getCalendarEvents } from "@/lib/actions/calendar";
import { createServerClient } from "@/lib/supabase/server";
import { CalendarView } from "./calendar-view";
import type { EmployeeOption } from "./event-dialog";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const userContext = await getCurrentUserContext();
  if (!userContext) redirect("/login");
  if (!userContext.organization) redirect("/onboarding");

  if (!hasPermission("calendar.view", userContext.permissions)) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You don&apos;t have permission to view the calendar.
          </p>
        </div>
      </div>
    );
  }

  const organizationId = userContext.organization.id;
  const supabase = await createServerClient();

  // Fetch active employees in this organization for the assignment dropdown.
  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  const employees: EmployeeOption[] = (profileRows ?? []).map((p) => ({
    id: p.id,
    fullName: p.full_name ?? null,
    email: p.email ?? null,
  }));

  // Initial window: current month padded one week on each side so multi-day
  // events at the boundaries are fetched.
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const start = new Date(startOfMonth);
  start.setDate(start.getDate() - 7);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const end = new Date(endOfMonth);
  end.setDate(end.getDate() + 7);

  const initialEvents = await getCalendarEvents(
    start.toISOString(),
    end.toISOString()
  );

  return (
    <div className="p-8">
      <CalendarView
        initialEvents={initialEvents ?? []}
        employees={employees}
        permissions={userContext.permissions}
        todayIso={now.toISOString()}
      />
    </div>
  );
}
