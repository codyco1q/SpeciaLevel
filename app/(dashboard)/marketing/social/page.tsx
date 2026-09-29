import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUserContext } from "@/lib/auth/session";
import {
  getSocialPosts,
  getSocialPlannerStatus,
} from "@/lib/actions/marketing";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { SocialPlannerView } from "./social-planner-view";

export const dynamic = "force-dynamic";

export default async function SocialPlannerPage() {
  const userContext = await getCurrentUserContext();
  if (!userContext) redirect("/login");
  if (!userContext.organization) redirect("/onboarding");

  const { platform } = await getDictionary();
  const locale = await getLocale();

  if (!hasPermission("marketing.view", userContext.permissions)) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-2xl font-bold tracking-tight">Social Planner</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You do not have permission to view marketing social planner.
          </p>
        </div>
      </div>
    );
  }

  const [posts, status] = await Promise.all([
    getSocialPosts(),
    getSocialPlannerStatus(),
  ]);

  return (
    <div className="p-8">
      <SocialPlannerView
        initialPosts={posts}
        isSubscribed={status.isSubscribed}
        canManage={hasPermission("marketing.manage", userContext.permissions)}
        platform={platform}
        locale={locale}
      />
    </div>
  );
}
