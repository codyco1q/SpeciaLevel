import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUserContext } from "@/lib/auth/session";
import { getContacts, getContactTags } from "@/lib/actions/contacts";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { ContactsView } from "@/components/contacts/contacts-view";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const userContext = await getCurrentUserContext();
  if (!userContext) redirect("/login");
  if (!userContext.organization) redirect("/onboarding");

  const { platform } = await getDictionary();
  const lang = await getLocale();

  if (!hasPermission("crm.view", userContext.permissions)) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-2xl font-bold tracking-tight">
            {platform.contacts?.title ?? "Contacts"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {platform.crm.noPermissionBody}
          </p>
        </div>
      </div>
    );
  }

  const canManage = hasPermission("crm.manage", userContext.permissions);
  const [contacts, tagCounts] = await Promise.all([
    getContacts(),
    getContactTags(),
  ]);

  return (
    <div className="p-4 sm:p-8">
      <ContactsView
        initialContacts={contacts ?? []}
        initialTags={tagCounts.map((t) => t.tag)}
        canManage={canManage}
        platform={platform}
        lang={lang}
      />
    </div>
  );
}
