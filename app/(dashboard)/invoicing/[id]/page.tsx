import { redirect } from "next/navigation";

import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUserContext } from "@/lib/auth/session";
import { getInvoiceById } from "@/lib/actions/invoicing";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { InvoiceDetailDocument } from "./invoice-detail-document";

export const dynamic = "force-dynamic";

/**
 * Dedicated printable invoice page at /invoicing/[id].
 *
 * Access control:
 *  - Gated by `invoicing.view` like the rest of the module.
 *  - Data fetching goes through getInvoiceById(), whose query is
 *    org-scoped server-side AND protected by RLS — internal users see
 *    any invoice in their org, while Client-role users only get the
 *    invoice whose contact_id matches their linked CRM contact.
 *  - `invoicing.manage` additionally unlocks the mark-paid action in
 *    the actions bar (internal roles only; Client never holds it).
 */
export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const userContext = await getCurrentUserContext();
  if (!userContext) redirect("/login");
  if (!userContext.organization) redirect("/onboarding");

  const { platform } = await getDictionary();
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

  // RLS decides what a Client caller can see here; a non-matching id or
  // an id from another org resolves to null and renders the not-found
  // state (no existence leak, no blind 404).
  const invoice = await getInvoiceById(id);
  const canManage = hasPermission(
    "invoicing.manage",
    userContext.permissions
  );

  return (
    <InvoiceDetailDocument
      invoice={invoice}
      canManage={canManage}
      organizationName={userContext.organization.name}
      platform={platform}
      locale={locale}
    />
  );
}