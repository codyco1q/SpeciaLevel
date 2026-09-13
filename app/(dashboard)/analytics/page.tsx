import { redirect } from "next/navigation";

import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUserContext } from "@/lib/auth/session";
import { getAnalyticsSummary } from "@/lib/actions/analytics";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { AnalyticsView } from "./analytics-view";

export const dynamic = "force-dynamic";

/**
 * Analytics & Business Intelligence module. The page gate mirrors the
 * permission catalog: users without `analytics.view` see an explanatory
 * card instead of the app (the sidebar already excludes the nav item).
 * The default 30-day summary is fetched server-side so the first paint is
 * instant; the range switcher in the client view re-fetches via the
 * `getAnalyticsSummary` server action.
 */
export default async function AnalyticsPage() {
  const userContext = await getCurrentUserContext();
  if (!userContext) redirect("/login");
  if (!userContext.organization) redirect("/onboarding");

  const { platform } = await getDictionary();
  const locale = await getLocale();
  const t = platform.analytics;

  if (!hasPermission("analytics.view", userContext.permissions)) {
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

  const initialResult = await getAnalyticsSummary(30);

  return (
    <div className="p-8">
      <AnalyticsView
        initialSummary={initialResult.ok ? initialResult.summary : null}
        initialError={initialResult.ok ? null : initialResult.error}
        platform={platform}
        locale={locale}
      />
    </div>
  );
}