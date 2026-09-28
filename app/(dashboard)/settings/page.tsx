import { redirect } from "next/navigation";

import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUserContext } from "@/lib/auth/session";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { SettingsClient } from "./settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const userContext = await getCurrentUserContext();
  if (!userContext) redirect("/login");
  if (!userContext.organization) redirect("/onboarding");

  const { platform } = await getDictionary();
  const locale = await getLocale();
  const t = platform.settings;

  const isOwnerOrAdmin = userContext.roles.some(
    (role) => role.key === "owner" || role.key === "admin"
  );
  const canView =
    isOwnerOrAdmin ||
    hasPermission("settings.view", userContext.permissions) ||
    hasPermission("settings.manage", userContext.permissions) ||
    hasPermission("organization.manage", userContext.permissions);

  const canManage =
    isOwnerOrAdmin ||
    hasPermission("settings.manage", userContext.permissions) ||
    hasPermission("organization.manage", userContext.permissions);

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

  const organization = userContext.organization;

  return (
    <div className="p-8">
      <SettingsClient
        organization={organization}
        profile={{
          fullName: userContext.profile.full_name,
          jobTitle: userContext.profile.job_title,
        }}
        userEmail={userContext.user.email}
        canManage={canManage}
        platform={platform}
        locale={locale}
      />
    </div>
  );
}

