"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Hash, LoaderCircle, MessageSquare, Plus, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createBrowserClient } from "@/lib/supabase/client";
import {
  getMessages,
  sendMessage,
  type ChatChannelRow,
  type ChatMessageRow,
  type ChatPerson,
} from "@/lib/actions/chat";
import { cn } from "@/lib/utils";
import { ChannelDialog } from "./channel-dialog";
import {
  formatMessageDateTitle,
  formatMessageTime,
  getInitials,
} from "./chat-meta";

/** Raw `chat_messages` row broadcast by Supabase Realtime. */
interface RealtimeMessageRow {
  id: string;
  organization_id: string;
  channel_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface ChatViewProps {
  channels: ChatChannelRow[];
  initialMessages: ChatMessageRow[];
  /** Channel to open on first render (first channel, server-selected). */
  activeChannelId: string | null;
  canManage: boolean;
  /** The signed-in user, used for optimistic sends and "own message" styling. */
  currentUser: ChatPerson;
}

/**
 * Chat orchestrator: channel sidebar, realtime message feed, and composer.
 *
 *  - New messages arrive two ways: the `sendMessage` server action returns
 *    the persisted row (optimistic replace), and Supabase Realtime pushes
 *    every INSERT to subscribers. A dedupe-by-id guard handles both.
 *  - Realtime is scoped by a `channel_id` filter AND by RLS (a client only
 *    receives events for rows its own organization can read), so tenants
 *    stay isolated.
 */
export function ChatView({
  channels,
  initialMessages,
  activeChannelId: initialActiveChannelId,
  canManage,
  currentUser,
}: ChatViewProps) {
  const [channelList, setChannelList] = useState<ChatChannelRow[]>(channels);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(
    initialActiveChannelId
  );
  const [messages, setMessages] = useState<ChatMessageRow[]>(initialMessages);
  const [composer, setComposer] = useState("");
  const [sendPending, setSendPending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const feedRef = useRef<HTMLDivElement>(null);

  // Sender-name cache so realtime messages render names without refetching
  // profiles for senders we've already seen.
  const personCache = useRef<Map<string, ChatPerson>>(new Map());

  useEffect(() => {
    personCache.current.set(currentUser.id, currentUser);
    for (const message of initialMessages) {
      personCache.current.set(message.userId, message.user);
    }
  }, [initialMessages, currentUser]);

  const activeChannel = useMemo(
    () => channelList.find((c) => c.id === activeChannelId) ?? null,
    [channelList, activeChannelId]
  );

  // Keep the feed pinned to the newest message whenever the channel changes
  // or a message arrives.
  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;
    feed.scrollTop = feed.scrollHeight;
  }, [messages, activeChannelId, feedLoading]);

  /** Fills in a real profile object for a realtime message's sender. */
  const refreshPerson = useCallback(async (userId: string) => {
    const supabase = createBrowserClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", userId)
      .maybeSingle();

    const person: ChatPerson = {
      id: userId,
      fullName: data?.full_name ?? null,
      email: data?.email ?? null,
    };
    personCache.current.set(userId, person);
    setMessages((prev) =>
      prev.map((m) => (m.userId === userId ? { ...m, user: person } : m))
    );
  }, []);

  const handleRealtimeMessage = useCallback(
    (row: RealtimeMessageRow) => {
      const cached = personCache.current.get(row.user_id);
      const base: ChatMessageRow = {
        id: row.id,
        channelId: row.channel_id,
        userId: row.user_id,
        content: row.content,
        createdAt: row.created_at,
        user: cached ?? { id: row.user_id, fullName: null, email: null },
      };

      setMessages((prev) =>
        prev.some((m) => m.id === base.id) ? prev : [...prev, base]
      );

      if (!cached) {
        void refreshPerson(row.user_id);
      }
    },
    [refreshPerson]
  );

  // Live listener: append INSERT events for the active channel.
  useEffect(() => {
    if (!activeChannelId) return;

    const supabase = createBrowserClient();
    const subscription = supabase
      .channel(`chat-messages-${activeChannelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `channel_id=eq.${activeChannelId}`,
        },
        (payload) => {
          handleRealtimeMessage(payload.new as RealtimeMessageRow);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(subscription);
    };
  }, [activeChannelId, handleRealtimeMessage]);

  async function handleSelectChannel(channelId: string) {
    if (channelId === activeChannelId) return;
    setActiveChannelId(channelId);
    setSendError(null);
    setFeedLoading(true);
    const result = await getMessages(channelId);
    setMessages(result ?? []);
    setFeedLoading(false);
  }

  async function handleSend() {
    if (!activeChannelId || sendPending) return;

    const content = composer.trim();
    if (!content) return;

    // Optimistic send: append a local copy immediately, then swap it for
    // the persisted row (realtime will also echo it — deduped by id).
    const optimisticId = `optimistic-${Date.now()}`;
    const optimistic: ChatMessageRow = {
      id: optimisticId,
      channelId: activeChannelId,
      userId: currentUser.id,
      content,
      createdAt: new Date().toISOString(),
      user: currentUser,
    };

    setComposer("");
    setSendError(null);
    setSendPending(true);
    setMessages((prev) => [...prev, optimistic]);

    const result = await sendMessage(activeChannelId, content);

    if (result.status === "error") {
      setSendError(
        result.error ?? "Could not send the message. Please try again."
      );
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setComposer(content);
      setSendPending(false);
      return;
    }

    setMessages((prev) =>
      prev.map((m) => (m.id === optimisticId ? result.message : m))
    );
    setSendPending(false);
  }

  function handleChannelCreated(channel: ChatChannelRow) {
    setChannelList((prev) => [...prev, channel]);
    setActiveChannelId(channel.id);
    setMessages([]);
  }

  function handleFormSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void handleSend();
  }

  function handleComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void handleSend();
    }
  }

  return (
    <div className="flex h-full bg-background">
      {/* Channel sidebar */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Channels</h2>
          </div>
          {canManage && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setCreateOpen(true)}
              aria-label="Create channel"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>

        {channelList.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center">
            <p className="text-sm text-muted-foreground">No channels yet.</p>
            {canManage && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="h-4 w-4" /> Create a channel
              </Button>
            )}
          </div>
        ) : (
          <ScrollArea className="min-h-0 flex-1">
            <nav className="space-y-0.5 p-2">
              {channelList.map((channel) => {
                const isActive = channel.id === activeChannelId;
                return (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => void handleSelectChannel(channel.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Hash className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{channel.name}</span>
                    {channel.isPrivate && (
                      <Badge
                        variant="outline"
                        className="ml-auto px-1.5 py-0 text-[10px]"
                      >
                        Private
                      </Badge>
                    )}
                  </button>
                );
              })}
            </nav>
          </ScrollArea>
        )}
      </aside>

      {/* Main feed */}
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <Hash className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <h1 className="text-sm font-semibold">
              {activeChannel ? activeChannel.name : "Chat"}
            </h1>
            {activeChannel?.description && (
              <p className="truncate text-xs text-muted-foreground">
                {activeChannel.description}
              </p>
            )}
          </div>
        </div>

        <div
          ref={feedRef}
          className="min-h-0 flex-1 overflow-y-auto px-5 py-4"
        >
          {feedLoading ? (
            <div className="flex h-full items-center justify-center">
              <LoaderCircle className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <Hash className="h-8 w-8 text-muted-foreground/40" />
              <p className="mt-2 text-sm font-medium">
                {activeChannel ? `#${activeChannel.name}` : "Chat"}
              </p>
              <p className="text-sm text-muted-foreground">
                No messages yet — say hi!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isOwn={message.userId === currentUser.id}
                />
              ))}
            </div>
          )}
        </div>
{/* Composer */}
        <div className="border-t border-border p-3">
          <form onSubmit={handleFormSubmit} className="grid gap-2">
            <Textarea
              value={composer}
              onChange={(event) => setComposer(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder={
                activeChannel
                  ? `Message #${activeChannel.name}`
                  : "Select a channel to start chatting"
              }
              rows={2}
              maxLength={2000}
              disabled={!activeChannel || sendPending}
            />
            {sendError && (
              <p role="alert" className="text-sm text-destructive">
                {sendError}
              </p>
            )}
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Shift + Enter for a new line
              </p>
              <Button
                type="submit"
                size="sm"
                disabled={!activeChannel || !composer.trim() || sendPending}
              >
                {sendPending ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send
              </Button>
            </div>
          </form>
        </div>
      </section>

      <ChannelDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleChannelCreated}
      />
    </div>
  );
}

interface MessageBubbleProps {
  message: ChatMessageRow;
  isOwn: boolean;
}

/** Single chat message: avatar, sender name + time, and the content bubble. */
function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  const senderName =
    message.user.fullName ?? message.user.email ?? "Team member";
  const initials = getInitials(senderName);

  return (
    <div className={cn("flex items-start gap-3", isOwn && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          isOwn ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        )}
        aria-hidden="true"
      >
        {initials}
      </div>
      <div className={cn("min-w-0 max-w-[75%]", isOwn && "text-right")}>
        <div className={cn("flex items-baseline gap-2", isOwn && "justify-end")}>
          <span className="text-sm font-semibold">{senderName}</span>
          <time
            className="text-xs text-muted-foreground"
            dateTime={message.createdAt}
            title={formatMessageDateTitle(message.createdAt)}
          >
            {formatMessageTime(message.createdAt)}
          </time>
        </div>
        <p
          className={cn(
            "mt-1 inline-block rounded-lg border px-3 py-2 text-sm whitespace-pre-wrap break-words text-left",
            isOwn ? "border-transparent bg-primary/10" : "border-border bg-card"
          )}
        >
          {message.content}
        </p>
      </div>
    </div>
  );
}