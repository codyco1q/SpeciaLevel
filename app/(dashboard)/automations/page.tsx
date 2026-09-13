import { redirect } from "next/navigation";

import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUserContext } from "@/lib/auth/session";
import { getAutomations } from "@/lib/actions/automations";
import { createServerClient } from "@/lib/supabase/server";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { AutomationsView } from "./automations-view";
import type {
  AutomationChannelOption,
  AutomationMemberOption,
} from "./automation-dialog";

export const dynamic = "force-dynamic";

/**
 * Automations module. The page gate mirrors the permission catalog:
 * users without `automations.view` see an explanatory card instead of the
 * app (the sidebar already excludes the nav item for them).
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

  const organizationId = userContext.organization.id;
  const supabase = await createServerClient();

  // Chat channels for the chat_message action picker + list summaries.
  const { data: channelRows } = await supabase
    .from("chat_channels")
    .select("id, name")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true });

  const channels: AutomationChannelOption[] = (channelRows ?? []).map(
    (channel) => ({ id: channel.id, name: channel.name })
  );

  // Active members for the create_task action's optional assignee.
  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  const members: AutomationMemberOption[] = (profileRows ?? []).map(
    (profile) => ({
      id: profile.id,
      fullName: profile.full_name ?? null,
      email: profile.email ?? null,
    })
  );

  const initialAutomations = await getAutomations();

  return (
    <div className="p-8">
      <AutomationsView
        initialAutomations={initialAutomations ?? []}
        channels={channels}
        members={members}
        canManage={hasPermission("automations.manage", userContext.permissions)}
        platform={platform}
        locale={locale}
      />
    </div>
  );
}