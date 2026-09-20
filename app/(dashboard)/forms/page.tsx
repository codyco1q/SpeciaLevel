import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/rbac";
import { getForms } from "@/lib/actions/forms";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { FormsView } from "./forms-view";
import { ShieldAlert } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lead Forms - SpeciaLevel",
  description: "Build custom inbound lead capture forms and embed them anywhere.",
};

export default async function FormsPage() {
  const userContext = await getCurrentUserContext();
  if (!userContext) {
    redirect("/login");
  }
  if (!userContext.organization) {
    redirect("/onboarding");
  }

  const { platform } = await getDictionary();
  const locale = await getLocale();
  const formsDictionary = platform.forms;

  if (!hasPermission("forms.view", userContext.permissions)) {
    return (
      <div className="flex h-96 flex-col items-center justify-center rounded-2xl border border-dashed border-border p-8 text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          <ShieldAlert className="size-6" />
        </div>
        <h2 className="text-lg font-bold tracking-tight">{formsDictionary.title}</h2>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          {formsDictionary.noPermissionBody}
        </p>
      </div>
    );
  }

  const forms = (await getForms()) ?? [];
  const canManage = hasPermission("forms.manage", userContext.permissions);

  return (
    <div className="p-6 md:p-8">
      <FormsView
        initialForms={forms}
        canManage={canManage}
        locale={locale}
        dictionary={formsDictionary}
      />
    </div>
  );
}
