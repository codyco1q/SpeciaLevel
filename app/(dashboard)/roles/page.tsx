import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/rbac";
import { getRolesData } from "@/lib/actions/roles";
import { RolesManager } from "./roles-manager";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const userContext = await getCurrentUserContext();

  if (!userContext) redirect("/login");

  const organization = userContext.organization;
  if (!organization) redirect("/onboarding");

  const canView = hasPermission("roles.view", userContext.permissions);
  const canManage = hasPermission("roles.manage", userContext.permissions);

  if (!canView) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-2xl font-bold tracking-tight">
            Roles &amp; Permissions
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You don&apos;t have permission to view roles.
          </p>
        </div>
      </div>
    );
  }

  const result = await getRolesData();

  if (result.status === "error") {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-2xl font-bold tracking-tight">
            Roles &amp; Permissions
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{result.error}</p>
        </div>
      </div>
    );
  }

  const { roles, permissionCatalog } = result.data;

  return (
    <div className="p-8">
      <RolesManager
        roles={roles}
        permissionCatalog={permissionCatalog}
        canManage={canManage}
      />
    </div>
  );
}