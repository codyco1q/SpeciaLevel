import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/auth/rbac";
import { MessagingView } from "./messaging-view";
import { loadMessagingData } from "./messaging-loader";

export const dynamic = "force-dynamic";

interface MessagingPageProps {
  searchParams?: Promise<{ tab?: string; channel?: string }>;
}

export default async function MessagingPage({ searchParams }: MessagingPageProps) {
  const params = searchParams ? await searchParams : undefined;

  // Direct internal tab or channel links redirect to dedicated sub-route
  if (params?.tab === "internal" || params?.channel) {
    if (params.channel) {
      redirect(`/messaging/internal/${encodeURIComponent(params.channel)}`);
    }
    redirect("/messaging/internal");
  }

  const data = await loadMessagingData();

  if (!data.canViewChat && !data.canViewTelecom && !data.canViewCrm) {
    const t = data.platform.messaging;
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

  return (
    <div className="p-6 md:p-8">
      <MessagingView
        channels={data.channels}
        initialMessages={data.initialMessages}
        activeChannelId={data.targetChannelId}
        canManageChat={hasPermission("chat.manage", data.userContext.permissions)}
        currentUser={data.currentUser}
        orgMembers={data.orgMembers}
        departments={data.departments}
        initialThreads={data.externalThreads}
        phoneNumbers={data.phoneNumbers}
        carrierSettings={data.carrierSettings}
        initialTab="external"
        organizationId={data.userContext.organization!.id}
        platform={data.platform}
        locale={data.locale}
      />
    </div>
  );
}
