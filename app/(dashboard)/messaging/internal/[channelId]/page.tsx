import { hasPermission } from "@/lib/auth/rbac";
import { MessagingView } from "../../messaging-view";
import { loadMessagingData } from "../../messaging-loader";

export const dynamic = "force-dynamic";

interface InternalChannelPageProps {
  params: Promise<{ channelId: string }>;
}

export default async function InternalChannelPage({
  params,
}: InternalChannelPageProps) {
  const resolvedParams = await params;
  const channelId = decodeURIComponent(resolvedParams.channelId);

  const data = await loadMessagingData(channelId);

  if (!data.canViewChat) {
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
        initialTab="internal"
        organizationId={data.userContext.organization!.id}
        platform={data.platform}
        locale={data.locale}
      />
    </div>
  );
}
