import { redirect } from "next/navigation";

import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUserContext } from "@/lib/auth/session";
import { getContactById } from "@/lib/actions/crm-contacts";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { ContactProfileView } from "./contact-profile-view";

export const dynamic = "force-dynamic";

/**
 * Dedicated 360° contact profile page at /crm/contacts/[id].
 *
 * Access control mirrors the CRM module: viewing requires
 * `crm.view`; editing requires `crm.manage`. The data-fetching
 * action (`getContactById`) is itself org-scoped + RLS-enforced,
 * so a non-matching id or a cross-tenant id resolves to null and
 * renders the not-found state (no existence leak).
 */
export default async function ContactProfilePage({
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

  const contact = await getContactById(id);

  return (
    <div className="p-8">
      <ContactProfileView
        contact={contact}
        canManage={canManage}
        platform={platform}
        locale={locale}
      />
    </div>
  );
}