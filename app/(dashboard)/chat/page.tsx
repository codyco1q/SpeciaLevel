import { redirect } from "next/navigation";

import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import {
  getChannels,
  getMessages,
  type ChatPerson,
} from "@/lib/actions/chat";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { ChatView } from "./chat-view";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const userContext = await getCurrentUserContext();
  if (!userContext) redirect("/login");
  if (!userContext.organization) redirect("/onboarding");

  const { platform } = await getDictionary();
  const locale = await getLocale();
  const t = platform.chat;

  if (!hasPermission("chat.view", userContext.permissions)) {
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

  // Load the channel list and prime the active channel with its recent
  // messages server-side; the client takes over from here (realtime + swaps).
  const channels = await getChannels();
  const activeChannelId = channels?.[0]?.id ?? null;
  const initialMessages = activeChannelId
    ? (await getMessages(activeChannelId)) ?? []
    : [];

  const currentUser: ChatPerson = {
    id: userContext.user.id,
    fullName: userContext.profile.full_name ?? null,
    email: userContext.user.email,
  };

  const supabase = await createServerClient();
  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("organization_id", userContext.organization.id)
    .order("full_name", { ascending: true });

  const orgMembers: ChatPerson[] = (profileRows ?? []).map((p) => ({
    id: p.id,
    fullName: p.full_name,
    email: p.email,
  }));

  return (
    <ChatView
      channels={channels ?? []}
      initialMessages={initialMessages}
      activeChannelId={activeChannelId}
      canManage={hasPermission("chat.manage", userContext.permissions)}
      currentUser={currentUser}
      orgMembers={orgMembers}
      organizationId={userContext.organization.id}
      platform={platform}
      locale={locale}
    />
  );
}
