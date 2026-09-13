import { redirect } from "next/navigation";

import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUserContext } from "@/lib/auth/session";
import { getTasks } from "@/lib/actions/tasks";
import { createServerClient } from "@/lib/supabase/server";
import { TasksView } from "./tasks-view";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import type { TaskMemberOption } from "./task-dialog";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const userContext = await getCurrentUserContext();
  if (!userContext) redirect("/login");
  if (!userContext.organization) redirect("/onboarding");

  const { platform } = await getDictionary();
  const locale = await getLocale();
  const t = platform.tasks;

  if (!hasPermission("tasks.view", userContext.permissions)) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t.noPermissionBody}</p>
        </div>
      </div>
    );
  }

  const organizationId = userContext.organization.id;
  const supabase = await createServerClient();

  // Active members in this organization for the assignment dropdown.
  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  const members: TaskMemberOption[] = (profileRows ?? []).map((profile) => ({
    id: profile.id,
    fullName: profile.full_name ?? null,
    email: profile.email ?? null,
  }));

  const initialTasks = await getTasks();

  // Attachments: internal members holding tasks.view may upload; a Client
  // role holds tasks.view too, so it is excluded explicitly here.
  const isClientRole = userContext.roles.some((role) => role.key === "client");
  const canUpload = hasPermission("tasks.view", userContext.permissions) && !isClientRole;

  return (
    <div className="p-8">
      <TasksView
        initialTasks={initialTasks ?? []}
        members={members}
        canManage={hasPermission("tasks.manage", userContext.permissions)}
        canUpload={canUpload}
        currentUserId={userContext.user.id}
        organizationId={organizationId}
        todayIso={new Date().toISOString()}
        platform={platform}
        locale={locale}
      />
    </div>
  );
}