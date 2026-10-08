import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/rbac";
import { getTimeTrackingData } from "@/lib/actions/time-tracking";
import { TimeTracker } from "./time-tracker";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";

export const dynamic = "force-dynamic";

export default async function TimeTrackingPage() {
  const userContext = await getCurrentUserContext();
  if (!userContext) redirect("/login");

  const organization = userContext.organization;
  if (!organization) redirect("/onboarding");

  const { platform } = await getDictionary();
  const locale = await getLocale();
  const t = platform.time;

  if (!hasPermission("time_tracking.view_self", userContext.permissions)) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-2xl font-bold tracking-tight">{t.noPermissionTitle}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t.noPermissionBody}</p>
        </div>
      </div>
    );
  }

  const data = await getTimeTrackingData();

  if (!data) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t.loadError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      <TimeTracker
        initialData={data}
        locale={locale}
        platform={platform}
      />
    </div>
  );
}


