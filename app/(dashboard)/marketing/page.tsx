import { redirect } from "next/navigation";

import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUserContext } from "@/lib/auth/session";
import {
  getCampaigns,
  getMarketingMetrics,
  type MarketingMetrics,
} from "@/lib/actions/marketing";
import {
  getSocialPosts,
  getSocialPlannerStatus,
} from "@/lib/actions/marketing-social";
import { getEmailTemplates } from "@/lib/actions/marketing-emails";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { MarketingView } from "./marketing-view";

export const dynamic = "force-dynamic";

const EMPTY_METRICS: MarketingMetrics = {
  activeCampaigns: 0,
  allocatedBudget: 0,
  spendToDate: 0,
  totalCampaigns: 0,
  channels: [],
};

/**
 * Marketing module. The page gate mirrors the permission catalog:
 * users without `marketing.view` see an explanatory card instead of the
 * app (the sidebar already excludes the nav item for them).
 */
export default async function MarketingPage() {
  const userContext = await getCurrentUserContext();
  if (!userContext) redirect("/login");
  if (!userContext.organization) redirect("/onboarding");

  const { platform } = await getDictionary();
  const locale = await getLocale();
  const t = platform.marketing;

  if (!hasPermission("marketing.view", userContext.permissions)) {
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

  const [campaigns, metrics, socialPosts, socialStatus, emailTemplates] = await Promise.all([
    getCampaigns(),
    getMarketingMetrics(),
    getSocialPosts(),
    getSocialPlannerStatus(),
    getEmailTemplates(),
  ]);

  return (
    <div className="p-8">
      <MarketingView
        initialCampaigns={campaigns ?? []}
        initialMetrics={metrics ?? EMPTY_METRICS}
        initialSocialPosts={socialPosts ?? []}
        isSocialSubscribed={socialStatus.isSubscribed}
        initialEmailTemplates={emailTemplates ?? []}
        canManage={hasPermission("marketing.manage", userContext.permissions)}
        platform={platform}
        locale={locale}
      />
    </div>
  );
}
