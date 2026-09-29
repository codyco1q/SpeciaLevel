import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUserContext } from "@/lib/auth/session";
import {
  getWorkflows,
  getAutomationConfigOptions,
  getWorkflowLogs,
} from "@/lib/actions/automations";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { AutomationsView } from "./automations-view";

export const dynamic = "force-dynamic";

/**
 * Visual Automations Workflow Engine Page.
 */
export default async function AutomationsPage() {
  const userContext = await getCurrentUserContext();
  if (!userContext) redirect("/login");
  if (!userContext.organization) redirect("/onboarding");

  const { platform } = await getDictionary();
  const locale = await getLocale();
  const t = platform.automations;

  if (!hasPermission("automations.view", userContext.permissions)) {
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

  const [workflows, configOptions, logs] = await Promise.all([
    getWorkflows(),
    getAutomationConfigOptions(),
    getWorkflowLogs(undefined, 50),
  ]);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <AutomationsView
        initialWorkflows={workflows}
        configOptions={configOptions}
        initialLogs={logs}
        canManage={hasPermission("automations.manage", userContext.permissions)}
        platform={platform}
        locale={locale}
      />
    </div>
  );
}
