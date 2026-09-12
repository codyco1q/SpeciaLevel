import { redirect } from "next/navigation";

import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUserContext } from "@/lib/auth/session";
import {
  getChannels,
  getMessages,
  type ChatPerson,
} from "@/lib/actions/chat";
import { ChatView } from "./chat-view";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const userContext = await getCurrentUserContext();
  if (!userContext) redirect("/login");
  if (!userContext.organization) redirect("/onboarding");

  if (!hasPermission("chat.view", userContext.permissions)) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-2xl font-bold tracking-tight">Chat</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You don&apos;t have permission to view chat.
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

  return (
    <ChatView
      channels={channels ?? []}
      initialMessages={initialMessages}
      activeChannelId={activeChannelId}
      canManage={hasPermission("chat.manage", userContext.permissions)}
      currentUser={currentUser}
    />
  );
}