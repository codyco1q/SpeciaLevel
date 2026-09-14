import { redirect } from "next/navigation";

import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUserContext } from "@/lib/auth/session";
import {
  getCalls,
  getContacts,
  getSmsMessages,
  getTelecomMetrics,
  type TelecomMetrics,
} from "@/lib/actions/telecom";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { TelecomView } from "./telecom-view";

export const dynamic = "force-dynamic";

const EMPTY_METRICS: TelecomMetrics = {
  totalCalls: 0,
  totalMinutes: 0,
  missedCalls: 0,
  missedCallRate: 0,
  totalSms: 0,
};

/**
 * Telecommunications module. The page gate mirrors the permission
 * catalog: users without `telecom.view` see an explanatory card instead
 * of the app (the sidebar already excludes the nav item for them).
 */
export default async function TelecomPage() {
  const userContext = await getCurrentUserContext();
  if (!userContext) redirect("/login");
  if (!userContext.organization) redirect("/onboarding");

  const { platform } = await getDictionary();
  const locale = await getLocale();
  const t = platform.telecom;

  if (!hasPermission("telecom.view", userContext.permissions)) {
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

  const [calls, sms, metrics, contacts] = await Promise.all([
    getCalls(),
    getSmsMessages(),
    getTelecomMetrics(),
    getContacts(),
  ]);

  return (
    <div className="p-8">
      <TelecomView
        initialCalls={calls ?? []}
        initialSms={sms ?? []}
        initialMetrics={metrics ?? EMPTY_METRICS}
        initialContacts={contacts ?? []}
        canManage={hasPermission("telecom.manage", userContext.permissions)}
        platform={platform}
        locale={locale}
      />
    </div>
  );
}