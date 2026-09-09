import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const userContext = await getCurrentUserContext();
  if (!userContext) redirect("/login");
  if (!userContext.organization) redirect("/onboarding");

  if (
    !hasPermission("settings.view", userContext.permissions) &&
    !hasPermission("settings.manage", userContext.permissions)
  ) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You don&apos;t have permission to view settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Organization settings — coming in a future milestone.
      </p>
    </div>
  );
}
