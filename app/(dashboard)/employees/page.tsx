import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/rbac";
import { EmployeeDirectory } from "./employee-directory";

export const dynamic = "force-dynamic";

export interface EmployeeRow {
  id: string;
  fullName: string;
  email: string;
  jobTitle: string | null;
  departmentId: string | null;
  departmentName: string | null;
  roleId: string | null;
  roleNames: string[];
  status: string;
  createdAt: string;
}

export default async function EmployeesPage() {
  const userContext = await getCurrentUserContext();

  if (!userContext) redirect("/login");

  const organization = userContext.organization;
  if (!organization) redirect("/onboarding");

  if (!hasPermission("employees.view", userContext.permissions)) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-2xl font-bold tracking-tight">Employees</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You don&apos;t have permission to view employees.
          </p>
        </div>
      </div>
    );
  }

  const canCreate = hasPermission("employees.create", userContext.permissions);
  const canUpdate = hasPermission("employees.update", userContext.permissions);
  const canDelete = hasPermission("employees.delete", userContext.permissions);

  const supabase = await createServerClient();

  // Departments for the filter + form select.
  const { data: departments } = await supabase
    .from("departments")
    .select("id, name")
    .eq("organization_id", organization.id)
    .order("name", { ascending: true });

  // Roles for the filter + form select (non-system roles first, then system).
  const { data: roles } = await supabase
    .from("roles")
    .select("id, name, key, is_system")
    .eq("organization_id", organization.id)
    .order("is_system", { ascending: true })
    .order("name", { ascending: true });

  // Employees = profiles in this org, with their role mapping embedded.
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select(
      `
        id,
        full_name,
        email,
        job_title,
        department_id,
        status,
        created_at,
        department:departments(name),
        roles:user_roles(role_id, roles(name))
      `
    )
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false });

  if (profilesError || !profiles) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-2xl font-bold tracking-tight">Employees</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Could not load employees. Please try again.
          </p>
        </div>
      </div>
    );
  }

  const rows: EmployeeRow[] = (profiles ?? []).map((profile) => {
    const roleBindings = (profile.roles ?? []) as {
      role_id: string;
      roles?: { name?: string } | { name?: string }[] | null;
    }[];

    return {
      id: profile.id,
      fullName: profile.full_name ?? "Unnamed",
      email: profile.email ?? "",
      jobTitle: profile.job_title,
      departmentId: profile.department_id,
      departmentName: (() => {
        const dep = profile.department as
          | { name?: string }
          | { name?: string }[]
          | null;
        const name = Array.isArray(dep) ? dep[0]?.name : dep?.name;
        return name ?? null;
      })(),
      roleId: roleBindings[0]?.role_id ?? null,
      roleNames: roleBindings
        .map((ur) => {
          const role = ur.roles;
          const name = Array.isArray(role) ? role[0]?.name : role?.name;
          return name;
        })
        .filter((name): name is string => typeof name === "string"),
      status: profile.status,
      createdAt: profile.created_at,
    };
  });

  return (
    <div className="p-8">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Employees</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage the people in your organization.
        </p>
      </div>

      <EmployeeDirectory
        employees={rows}
        departments={(departments ?? []).map((d) => ({
          id: d.id,
          name: d.name,
        }))}
        roles={(roles ?? []).map((r) => ({
          id: r.id,
          name: r.name,
          isSystem: r.is_system,
        }))}
        canCreate={canCreate}
        canUpdate={canUpdate}
        canDelete={canDelete}
      />
    </div>
  );
}
