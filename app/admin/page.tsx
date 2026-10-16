import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/admin";
import { getSuperAdminDashboardData } from "@/lib/actions/super-admin";
import { SuperAdminView } from "./super-admin-view";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getAdminSession();
  if (!session.isAuthenticated) {
    redirect("/admin/login");
  }

  const data = await getSuperAdminDashboardData();

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      <SuperAdminView
        initialMetrics={data.metrics}
        initialTenants={data.tenants}
        initialLogs={data.recentLogs}
      />
    </div>
  );
}
