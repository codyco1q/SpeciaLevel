import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/rbac";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { EmployeeDirectory } from "./employee-directory";

export const dynamic = "force-dynamic";

export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";

export interface EmployeeInvitationRow {
  id: string;
  email: string;
  roleName: string;
  departmentName: string | null;
  contactName: string | null;
  invitedByName: string | null;
  status: InvitationStatus;
  token: string;
  createdAt: string;
  expiresAt: string;
}

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

interface InvitationJoin {
  id: string;
  email: string;
  status: string;
  token: string;
  created_at: string;
  expires_at: string;
  role?: { name?: string } | { name?: string }[] | null;
  department?: { name?: string } | { name?: string }[] | null;
  contact?: { name?: string } | { name?: string }[] | null;
  invited_by_profile?:
    | { full_name?: string }
    | { full_name?: string }[]
    | null;
}

function pickJoinedValue(value: unknown, key: string): string | null {
  if (!value) return null;
  const row = Array.isArray(value) ? value[0] : value;
  if (row && typeof row === "object" && key in row) {
    const field = (row as Record<string, unknown>)[key];
    return typeof field === "string" ? field : null;
  }
  return null;
}


export default async function EmployeesPage() {
  const userContext = await getCurrentUserContext();

  if (!userContext) redirect("/login");

  const organization = userContext.organization;
  if (!organization) redirect("/onboarding");

  const { platform } = await getDictionary();
  const locale = await getLocale();

  const isOwnerOrAdmin = userContext.roles.some(
    (role) => role.key === "owner" || role.key === "admin"
  );
  const canView =
    isOwnerOrAdmin ||
    hasPermission("employees.view", userContext.permissions) ||
    hasPermission("employees.manage", userContext.permissions);

  if (!canView) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-2xl font-bold tracking-tight">
            {platform.employees?.title || "Employees"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {platform.employees?.noPermissionBody ||
              "You don't have permission to view employees."}
          </p>
        </div>
      </div>
    );
  }

  const canCreate =
    isOwnerOrAdmin ||
    hasPermission("employees.create", userContext.permissions) ||
    hasPermission("employees.manage", userContext.permissions) ||
    hasPermission("users.invite", userContext.permissions) ||
    hasPermission("settings.manage", userContext.permissions);

  const canUpdate =
    isOwnerOrAdmin ||
    hasPermission("employees.update", userContext.permissions) ||
    hasPermission("employees.manage", userContext.permissions);

  const canDelete =
    isOwnerOrAdmin ||
    hasPermission("employees.delete", userContext.permissions) ||
    hasPermission("employees.manage", userContext.permissions);

  const supabase = await createServerClient();


  const [
    departmentsResult,
    rolesResult,
    profilesResult,
    invitesResult,
    contactsResult,
  ] = await Promise.all([
    supabase
      .from("departments")
      .select("id, name")
      .eq("organization_id", organization.id)
      .order("name", { ascending: true }),
    supabase
      .from("roles")
      .select("id, name, key, is_system")
      .eq("organization_id", organization.id)
      .order("is_system", { ascending: true })
      .order("name", { ascending: true }),
    supabase
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
      .order("created_at", { ascending: false }),
    supabase
      .from("organization_invitations")
      .select(
        `id, email, status, token, created_at, expires_at,
         role:roles!fk_organization_invitations_role(name),
         department:departments!fk_organization_invitations_department(name),
         contact:crm_contacts!fk_organization_invitations_contact(name),
         invited_by_profile:profiles!fk_organization_invitations_invited_by(full_name)`
      )
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("crm_contacts")
      .select("id, name, email, company")
      .eq("organization_id", organization.id)
      .order("name", { ascending: true }),
  ]);

  const profiles = profilesResult.data ?? [];

  const employeeRows: EmployeeRow[] = profiles.map((profile) => {
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

  const invitationRows: EmployeeInvitationRow[] = (
    (invitesResult.data ?? []) as InvitationJoin[]
  ).map((invitation): EmployeeInvitationRow => {
    const stored = (invitation.status ?? "pending") as InvitationStatus;
    const status =
      stored === "pending" && new Date(invitation.expires_at) <= new Date()
        ? "expired"
        : stored;

    return {
      id: invitation.id,
      email: invitation.email,
      roleName: pickJoinedValue(invitation.role, "name") ?? "—",
      departmentName: pickJoinedValue(invitation.department, "name"),
      contactName: pickJoinedValue(invitation.contact, "name"),
      invitedByName: pickJoinedValue(
        invitation.invited_by_profile,
        "full_name"
      ),
      status,
      token: invitation.token,
      createdAt: invitation.created_at,
      expiresAt: invitation.expires_at,
    };
  });

  return (
    <div className="p-8">
      <EmployeeDirectory
        employees={employeeRows}
        invitations={invitationRows}
        departments={(departmentsResult.data ?? []).map((d) => ({
          id: d.id,
          name: d.name,
        }))}
        roles={(rolesResult.data ?? []).map((r) => ({
          id: r.id,
          name: r.name,
          key: r.key,
          isSystem: r.is_system,
        }))}
        contacts={(contactsResult.data ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          email: c.email,
          company: c.company ?? null,
        }))}
        canCreate={canCreate}
        canUpdate={canUpdate}
        canDelete={canDelete}
        platform={platform}
        locale={locale}
      />
    </div>
  );
}
