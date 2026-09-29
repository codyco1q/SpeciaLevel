import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUserContext } from "@/lib/auth/session";
import { getEmailTemplates } from "@/lib/actions/marketing";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { EmailTemplatesView } from "./email-templates-view";

export const dynamic = "force-dynamic";

export default async function EmailTemplatesPage() {
  const userContext = await getCurrentUserContext();
  if (!userContext) redirect("/login");
  if (!userContext.organization) redirect("/onboarding");

  const { platform } = await getDictionary();
  const locale = await getLocale();

  if (!hasPermission("marketing.view", userContext.permissions)) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-2xl font-bold tracking-tight">Email Templates</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You do not have permission to view marketing email templates.
          </p>
        </div>
      </div>
    );
  }

  const templates = await getEmailTemplates();

  return (
    <div className="p-8">
      <EmailTemplatesView
        initialTemplates={templates}
        canManage={hasPermission("marketing.manage", userContext.permissions)}
        platform={platform}
        locale={locale}
      />
    </div>
  );
}
