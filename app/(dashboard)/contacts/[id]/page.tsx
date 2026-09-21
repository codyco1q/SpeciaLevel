import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUserContext } from "@/lib/auth/session";
import { getContactById } from "@/lib/actions/contacts";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { ContactProfileView } from "@/components/contacts/contact-profile-view";

export const dynamic = "force-dynamic";

/**
 * Dedicated 360° contact profile page at /contacts/[id].
 *
 * Viewing requires `crm.view`; editing requires `crm.manage`.
 * RLS enforces organization scoping.
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
  const t = platform.contacts ?? platform.crm;

  if (!hasPermission("crm.view", userContext.permissions)) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {platform.crm.noPermissionBody}
          </p>
        </div>
      </div>
    );
  }

  const canManage = hasPermission("crm.manage", userContext.permissions);
  const contact = await getContactById(id);

  return (
    <div className="p-4 sm:p-8">
      <ContactProfileView
        contact={contact}
        canManage={canManage}
        platform={platform}
        locale={locale}
      />
    </div>
  );
}
