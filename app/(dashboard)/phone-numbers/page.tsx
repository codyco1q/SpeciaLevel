import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import {
  getPhoneNumbers,
  getCarrierSettings,
} from "@/lib/actions/phone-numbers";
import {
  getCalls,
  getContacts,
  getSmsMessages,
  getTelecomMetrics,
  type TelecomMetrics,
} from "@/lib/actions/telecom";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { PhoneNumbersView } from "./phone-numbers-view";

export const dynamic = "force-dynamic";

const EMPTY_METRICS: TelecomMetrics = {
  totalCalls: 0,
  totalMinutes: 0,
  missedCalls: 0,
  missedCallRate: 0,
  totalSms: 0,
};

export default async function PhoneNumbersPage() {
  const userContext = await getCurrentUserContext();
  if (!userContext) redirect("/login");
  if (!userContext.organization) redirect("/onboarding");

  const { platform } = await getDictionary();
  const locale = await getLocale();
  const t = platform.phoneNumbers;

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

  const [
    phoneNumbers,
    carrierSettings,
    calls,
    sms,
    metrics,
    contacts,
    supabase,
  ] = await Promise.all([
    getPhoneNumbers(),
    getCarrierSettings(),
    getCalls(),
    getSmsMessages(),
    getTelecomMetrics(),
    getContacts(),
    createServerClient(),
  ]);

  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("organization_id", userContext.organization.id)
    .order("full_name", { ascending: true });

  const orgMembers = (
    (profileRows as unknown as { id: string; full_name: string | null; email: string | null }[]) ?? []
  ).map((p) => ({
    id: p.id,
    name: p.full_name || p.email || "Agent",
    email: p.email,
  }));

  return (
    <div className="p-6 md:p-8">
      <PhoneNumbersView
        phoneNumbers={phoneNumbers ?? []}
        carrierSettings={carrierSettings}
        initialCalls={calls ?? []}
        initialSms={sms ?? []}
        initialMetrics={metrics ?? EMPTY_METRICS}
        initialContacts={contacts ?? []}
        orgMembers={orgMembers}
        canManage={hasPermission("telecom.manage", userContext.permissions)}
        platform={platform}
        locale={locale}
      />
    </div>
  );
}
