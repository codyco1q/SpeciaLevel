import { redirect } from "next/navigation";

import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUserContext } from "@/lib/auth/session";
import { getInvoices } from "@/lib/actions/invoicing";
import { createServerClient } from "@/lib/supabase/server";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { InvoicingView } from "./invoicing-view";
import type { InvoiceContactOption } from "./create-invoice-dialog";

export const dynamic = "force-dynamic";

export default async function InvoicingPage() {
  const userContext = await getCurrentUserContext();
  if (!userContext) redirect("/login");
  if (!userContext.organization) redirect("/onboarding");

  const dict = await getDictionary();
  const { platform } = dict;
  const locale = await getLocale();
  const t = platform.invoicing;

  if (!hasPermission("invoicing.view", userContext.permissions)) {
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

  const canManage = hasPermission("invoicing.manage", userContext.permissions);
  const organizationId = userContext.organization.id;
  const supabase = await createServerClient();

  // Organization contacts (from the CRM module) for the create-invoice
  // client selector. Only needed when the caller can actually create.
  const { data: contactRows } = canManage
    ? await supabase
        .from("crm_contacts")
        .select("id, name, email, company")
        .eq("organization_id", organizationId)
        .order("name", { ascending: true })
    : { data: [] };

  const contacts: InvoiceContactOption[] = (contactRows ?? []).map(
    (contact) => ({
      id: contact.id,
      name: contact.name,
      email: contact.email,
      company: contact.company ?? null,
    })
  );

  const initialList = await getInvoices();

  return (
    <div className="p-8">
      <InvoicingView
        initialInvoices={initialList?.invoices ?? []}
        initialSummary={
          initialList?.summary ?? {
            totalInvoiced: 0,
            totalPaid: 0,
            totalOutstanding: 0,
            invoiceCount: 0,
            paidCount: 0,
            openCount: 0,
            overdueCount: 0,
          }
        }
        contacts={contacts}
        canManage={canManage}
        platform={platform}
        locale={locale}
      />
    </div>
  );
}