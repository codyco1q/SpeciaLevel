import { redirect, notFound } from "next/navigation";
import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUserContext } from "@/lib/auth/session";
import {
  getWorkflowById,
  getAutomationConfigOptions,
  getWorkflowLogs,
} from "@/lib/actions/automations";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { WorkflowStudioPage } from "./workflow-studio-page";

export const dynamic = "force-dynamic";

interface WorkflowPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function WorkflowRoutePage({ params }: WorkflowPageProps) {
  const { id } = await params;
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
          <p className="mt-2 text-sm text-muted-foreground">{t.noPermissionBody}</p>
        </div>
      </div>
    );
  }

  const isNew = id === "new";
  const [workflow, configOptions, logs] = await Promise.all([
    isNew ? Promise.resolve(null) : getWorkflowById(id),
    getAutomationConfigOptions(),
    isNew ? Promise.resolve([]) : getWorkflowLogs(id, 50),
  ]);

  if (!isNew && !workflow) {
    notFound();
  }

  return (
    <WorkflowStudioPage
      workflow={workflow}
      configOptions={configOptions}
      initialLogs={logs}
      canManage={hasPermission("automations.manage", userContext.permissions)}
      platform={platform}
      locale={locale}
    />
  );
}