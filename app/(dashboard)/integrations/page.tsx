import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/rbac";
import { getIntegrations } from "@/lib/actions/integrations";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { IntegrationsView } from "./integrations-view";

export default async function IntegrationsPage() {
  const userContext = await getCurrentUserContext();

  if (!userContext?.user) {
    redirect("/login");
  }

  const { platform } = await getDictionary();
  const locale = await getLocale();

  const canView =
    hasPermission("settings.view", userContext.permissions) ||
    hasPermission("settings.manage", userContext.permissions) ||
    hasPermission("organization.manage", userContext.permissions);

  if (!canView) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-xs">
          <h2 className="text-lg font-semibold text-foreground">
            Access Restricted
          </h2>
          <p className="mt-2 text-xs text-muted-foreground">
            You do not have permission to view or manage integrations for this workspace.
          </p>
        </div>
      </div>
    );
  }

  const canManage =
    hasPermission("settings.manage", userContext.permissions) ||
    hasPermission("organization.manage", userContext.permissions);

  const initialItems = await getIntegrations();

  return (
    <IntegrationsView
      initialItems={initialItems}
      canManage={canManage}
      platform={platform}
      locale={locale}
    />
  );
}
