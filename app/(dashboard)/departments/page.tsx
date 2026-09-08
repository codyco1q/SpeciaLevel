import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/rbac";
import { DepartmentsTable } from "./departments-table";

export const dynamic = "force-dynamic";

export interface DepartmentWithCount {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  employeeCount: number;
}

export default async function DepartmentsPage() {
  const userContext = await getCurrentUserContext();

  if (!userContext) redirect("/login");

  const organization = userContext.organization;
  if (!organization) redirect("/onboarding");

  if (!hasPermission("departments.view", userContext.permissions)) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-2xl font-bold tracking-tight">Departments</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You don&apos;t have permission to view departments.
          </p>
        </div>
      </div>
    );
  }

  const canManage = hasPermission(
    "departments.manage",
    userContext.permissions
  );

  const supabase = await createServerClient();

  const { data: departments, error: departmentsError } = await supabase
    .from("departments")
    .select("id, name, description, created_at")
    .eq("organization_id", organization.id)
    .order("name", { ascending: true });

  if (departmentsError || !departments) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-2xl font-bold tracking-tight">Departments</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Could not load departments. Please try again.
          </p>
        </div>
      </div>
    );
  }

  // Employee counts per department (RLS scopes this to the active org).
  const { data: profileRows } = await supabase
    .from("profiles")
    .select("department_id")
    .eq("organization_id", organization.id)
    .not("department_id", "is", null);

  const counts = new Map<string, number>();
  for (const row of profileRows ?? []) {
    if (row.department_id) {
      counts.set(row.department_id, (counts.get(row.department_id) ?? 0) + 1);
    }
  }

  const rows: DepartmentWithCount[] = (departments ?? []).map((dept) => ({
    id: dept.id,
    name: dept.name,
    description: dept.description,
    created_at: dept.created_at,
    employeeCount: counts.get(dept.id) ?? 0,
  }));

  return (
    <div className="p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Departments</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Organize your company by team or function.
          </p>
        </div>
      </div>

      <DepartmentsTable departments={rows} canManage={canManage} />
    </div>
  );
}
