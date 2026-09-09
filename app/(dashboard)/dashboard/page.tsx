import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const userContext = await getCurrentUserContext();

  if (!userContext) redirect("/login");
  if (!userContext.organization) redirect("/onboarding");

  const { profile, organization, permissions } = userContext;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome back{profile.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {organization?.name ?? "Your organization"} — UpLevel dashboard
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {hasPermission("calendar.view", permissions) && (
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-sm font-semibold">Calendar</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              View your team&apos;s schedule and events.
            </p>
          </div>
        )}
        {hasPermission("time.view", permissions) && (
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-sm font-semibold">Time Tracking</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Clock in / clock out and review your hours.
            </p>
          </div>
        )}
        {hasPermission("employees.view", permissions) && (
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-sm font-semibold">Employees</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your team members.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
