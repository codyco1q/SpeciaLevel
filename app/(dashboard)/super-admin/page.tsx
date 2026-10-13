import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { checkIsSuperAdmin, getSuperAdminDashboardData } from "@/lib/actions/super-admin";
import { SuperAdminView } from "./super-admin-view";
import { ShieldAlert } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SuperAdminPage() {
  const userContext = await getCurrentUserContext();
  if (!userContext) {
    redirect("/login");
  }

  const { isSuperAdmin } = await checkIsSuperAdmin();

  if (!isSuperAdmin) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center space-y-4">
          <div className="size-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <ShieldAlert className="size-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Super Admin Access Restricted
            </h1>
            <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
              This area is strictly restricted to platform owners and multi-tenant administrators. If you believe this is an error, please contact your systems team.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const data = await getSuperAdminDashboardData();

  return (
    <SuperAdminView
      initialMetrics={data.metrics}
      initialTenants={data.tenants}
      initialLogs={data.recentLogs}
    />
  );
}
