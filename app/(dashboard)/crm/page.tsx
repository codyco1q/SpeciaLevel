import { redirect } from "next/navigation";

import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUserContext } from "@/lib/auth/session";
import { getDeals, getMarketingLeads, getPipelines } from "@/lib/actions/crm";
import { createServerClient } from "@/lib/supabase/server";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { CrmView } from "./crm-view";
import type { CrmMemberOption } from "./deal-dialog";

export const dynamic = "force-dynamic";

export default async function CrmPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; pipelineId?: string; dealId?: string; new?: string }>;
}) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const initialTab = resolvedParams?.tab;
  const initialPipelineId = resolvedParams?.pipelineId;

  const userContext = await getCurrentUserContext();
  if (!userContext) redirect("/login");
  if (!userContext.organization) redirect("/onboarding");

  const dict = await getDictionary();
  const { platform } = dict;
  const locale = await getLocale();
  const t = platform.crm;

  if (!hasPermission("crm.view", userContext.permissions)) {
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

  const canManage = hasPermission("crm.manage", userContext.permissions);
  const organizationId = userContext.organization.id;
  const supabase = await createServerClient();

  // Active members in this organization for the assignment dropdown.
  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  const members: CrmMemberOption[] = (profileRows ?? []).map((profile) => ({
    id: profile.id,
    fullName: profile.full_name ?? null,
    email: profile.email ?? null,
  }));

  const pipelines = await getPipelines();
  const activePipeline =
    pipelines.find((p) => p.id === initialPipelineId) || pipelines[0];

  const initialDeals = await getDeals(activePipeline?.id);
  const initialLeads = canManage ? (await getMarketingLeads()) ?? [] : [];

  return (
    <div className="p-8">
      <CrmView
        initialPipelines={pipelines}
        initialDeals={initialDeals ?? []}
        initialLeads={initialLeads}
        members={members}
        canManage={canManage}
        platform={platform}
        locale={locale}
        packageLabels={dict.contact.form.packageOptions}
        initialTab={initialTab}
        initialPipelineId={activePipeline?.id}
      />
    </div>
  );
}
