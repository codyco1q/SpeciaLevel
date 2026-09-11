import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { ModulesGrid } from "@/components/modules-grid";

export const dynamic = "force-dynamic";

/**
 * Dedicated "Modules & Apps" page. Lists every module in the platform:
 * shipped modules (enabled by the organization) plus future modules
 * rendered as "Coming Soon", so the product feels modular and ready for
 * expansion.
 */
export default async function ModulesPage() {
  const userContext = await getCurrentUserContext();
  if (!userContext) redirect("/login");
  if (!userContext.organization) redirect("/onboarding");

  const supabase = await createServerClient();

  const { data: modules } = await supabase
    .from("organization_modules")
    .select("module_key, module_name, is_enabled")
    .eq("organization_id", userContext.organization.id);

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-bold tracking-tight">
            Modules &amp; Apps
          </h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Explore the modules available for your organization. New modules
          are added as the platform grows.
        </p>
      </div>

      <ModulesGrid activeModules={modules ?? []} />
    </div>
  );
}