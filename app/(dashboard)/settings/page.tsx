import { redirect } from "next/navigation";

import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { SettingsClient } from "./settings-client";

export const dynamic = "force-dynamic";

export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";

export interface InvitationRow {
  id: string;
  email: string;
  roleName: string;
  departmentName: string | null;
  invitedByName: string | null;
  status: InvitationStatus;
  token: string;
  createdAt: string;
  expiresAt: string;
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
  invited_by_profile?:
    | { full_name?: string }
    | { full_name?: string }[]
    | null;
}

/**
 * PostgREST returns a to-one join as an object (or null) and a to-many
 * join as an array; normalize both to a nullable field value.
 */
function pickJoinedValue(value: unknown, key: string): string | null {
  if (!value) return null;
  const row = Array.isArray(value) ? value[0] : value;
  if (row && typeof row === "object" && key in row) {
    const field = (row as Record<string, unknown>)[key];
    return typeof field === "string" ? field : null;
  }
  return null;
}

export default async function SettingsPage() {
  const userContext = await getCurrentUserContext();
  if (!userContext) redirect("/login");
  if (!userContext.organization) redirect("/onboarding");

  const { platform } = await getDictionary();
  const locale = await getLocale();
  const t = platform.settings;

  const canView = hasPermission("settings.view", userContext.permissions);
  const canManage = hasPermission("settings.manage", userContext.permissions);

  if (!canView && !canManage) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t.noPermissionBody}
          </p>
        </div>
      </div>
    );
  }

  const supabase = await createServerClient();
  const organization = userContext.organization;

  const [rolesResult, departmentsResult, invitesResult] = await Promise.all([
    supabase
      .from("roles")
      .select("id, name, is_system")
      .eq("organization_id", organization.id)
      .order("is_system", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("departments")
      .select("id, name")
      .eq("organization_id", organization.id)
      .order("name", { ascending: true }),
    supabase
      .from("organization_invitations")
      .select(
        `id, email, status, token, created_at, expires_at,
         role:roles!fk_organization_invitations_role(name),
         department:departments!fk_organization_invitations_department(name),
         invited_by_profile:profiles!fk_organization_invitations_invited_by(full_name)`
      )
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false }),
  ]);

  const invitations: InvitationRow[] = (
    (invitesResult.data ?? []) as InvitationJoin[]
  ).map(
    (invitation): InvitationRow => {
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
        invitedByName: pickJoinedValue(
          invitation.invited_by_profile,
          "full_name"
        ),
        status,
        token: invitation.token,
        createdAt: invitation.created_at,
        expiresAt: invitation.expires_at,
      };
    }
  );

  return (
    <div className="p-8">
      <SettingsClient
        organization={{
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          timezone: organization.timezone,
        }}
        profile={{
          fullName: userContext.profile.full_name,
          jobTitle: userContext.profile.job_title,
        }}
        userEmail={userContext.user.email}
        roles={(rolesResult.data ?? []).map((role) => ({
          id: role.id,
          name: role.name,
          isSystem: role.is_system,
        }))}
        departments={(departmentsResult.data ?? []).map((department) => ({
          id: department.id,
          name: department.name,
        }))}
        invitations={invitations}
        canManage={canManage}
        platform={platform}
        locale={locale}
      />
    </div>
  );
}
