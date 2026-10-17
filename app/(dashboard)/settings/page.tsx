import { redirect } from "next/navigation";

import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUserContext } from "@/lib/auth/session";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { SettingsClient } from "./settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage(props: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const initialTab = searchParams?.tab;

  const userContext = await getCurrentUserContext();
  if (!userContext) redirect("/login");
  if (!userContext.organization) redirect("/onboarding");

  const { platform } = await getDictionary();
  const locale = await getLocale();
  const t = platform.settings;

  const isOwnerOrAdmin = userContext.roles.some(
    (role) => role.key === "owner" || role.key === "admin"
  );
  const canViewOrgSettings =
    isOwnerOrAdmin ||
    hasPermission("settings.view", userContext.permissions) ||
    hasPermission("settings.manage", userContext.permissions) ||
    hasPermission("organization.manage", userContext.permissions);

  const canManage =
    isOwnerOrAdmin ||
    hasPermission("settings.manage", userContext.permissions) ||
    hasPermission("organization.manage", userContext.permissions);

  const organization = userContext.organization;

  return (
    <div className="p-8">
      <SettingsClient
        organization={organization}
        profile={{
          fullName: userContext.profile.full_name,
          jobTitle: userContext.profile.job_title,
          avatarUrl: userContext.profile.avatar_url,
          timezone: userContext.profile.timezone,
        }}
        userEmail={userContext.user.email}
        canManage={canManage}
        canViewOrgSettings={canViewOrgSettings}
        initialTab={initialTab}
        platform={platform}
        locale={locale}
      />
    </div>
  );
}

