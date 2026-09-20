"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  FileText,
  Hash,
  LoaderCircle,
  MessageSquare,
  Paperclip,
  Plus,
  Send,
  Settings,
  X,
} from "lucide-react";
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
import {
  createAttachmentRecord,
  getMessageAttachments,
  type AttachmentRow,
} from "@/lib/actions/attachments";
import { MAX_ATTACHMENT_BYTES } from "@/lib/validations/attachments";
import { formatFileSize, newUuid, sanitizeFileName } from "@/lib/utils/files";
import { cn } from "@/lib/utils";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";
import { ChannelDialog } from "./channel-dialog";
import { ChannelSettingsDialog } from "./channel-settings-dialog";
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
  /** Active members in the workspace for channel member management. */
  orgMembers: ChatPerson[];
  /** Caller's organization, used to scope attachment upload paths. */
  organizationId: string;
  /** Localized copy + formatters for the current render. */
  platform: Dictionary["platform"];
  locale: Locale;
}

/** A file queued in the composer, pending upload once the message sends. */
interface PendingFile {
  id: string;
  file: File;
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
  orgMembers,
  organizationId,
  platform,
  locale,
}: ChatViewProps) {
  const t = platform.chat;
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [attachmentMap, setAttachmentMap] = useState<
    Record<string, AttachmentRow[]>
  >({});

  const feedRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    const files = pendingFiles;
    const content = composer.trim() || (files.length > 0 ? t.fileOnlyBody : "");
    if (!content && files.length === 0) return;

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
    setPendingFiles([]);
    setSendError(null);
    setSendPending(true);
    setMessages((prev) => [...prev, optimistic]);

    const result = await sendMessage(activeChannelId, content);

    if (result.status === "error") {
      setSendError(result.error ?? t.errors.sendFailed);
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setComposer(content);
      setPendingFiles(files);
      setSendPending(false);
      return;
    }

    const persisted = result.message;
    setMessages((prev) =>
      prev.map((m) => (m.id === optimisticId ? persisted : m))
    );

    // Upload any queued files and link them to the persisted message. A
    // failure here never unsends the message — it only surfaces an error.
    if (files.length > 0) {
      const supabase = createBrowserClient();
      const uploads: AttachmentRow[] = [];
      let uploadError: string | null = null;

      for (const pending of files) {
        const storagePath = `${organizationId}/chat/${activeChannelId}/${pending.id}-${sanitizeFileName(pending.file.name)}`;
        const { error: objectError } = await supabase.storage
          .from("project_assets")
          .upload(storagePath, pending.file, {
            cacheControl: "3600",
            contentType: pending.file.type || "application/octet-stream",
            upsert: false,
          });

        if (objectError) {
          console.error("[chat] attachment upload failed:", objectError.message);
          uploadError = platform.attachments.errors.uploadFailed;
          break;
        }

        const record = await createAttachmentRecord({
          id: pending.id,
          messageId: persisted.id,
          fileName: pending.file.name,
          fileSize: pending.file.size,
          fileType: pending.file.type || "application/octet-stream",
          storagePath,
          isClientVisible: true,
        });

        if (record.status === "error") {
          // Object stored but metadata row failed — drop the orphan.
          await supabase.storage.from("project_assets").remove([storagePath]);
          uploadError = record.error;
          break;
        }
        const saved = record.attachment;
        if (saved) uploads.push(saved);
      }

      if (uploadError) {
        setSendError(uploadError);
      } else if (uploads.length > 0) {
        setAttachmentMap((prev) => ({
          ...prev,
          [persisted.id]: [...(prev[persisted.id] ?? []), ...uploads],
        }));
      }
    }

    setSendPending(false);
  }

  function handleChannelCreated(channel: ChatChannelRow) {
    setChannelList((prev) => [...prev, channel]);
    setActiveChannelId(channel.id);
    setMessages([]);
  }

  function handleChannelUpdated(updated: ChatChannelRow) {
    setChannelList((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
    );
  }

  function handleChannelDeleted(deletedId: string) {
    setChannelList((prev) => {
      const filtered = prev.filter((c) => c.id !== deletedId);
      if (activeChannelId === deletedId) {
        const nextId = filtered[0]?.id ?? null;
        setActiveChannelId(nextId);
        if (nextId) {
          void getMessages(nextId).then((res) => setMessages(res ?? []));
        } else {
          setMessages([]);
        }
      }
      return filtered;
    });
  }

  /** Eagerly loads a message's attachments once (chat bubbles fetch on mount). */
  const requestAttachments = useCallback(
    async (messageId: string) => {
      if (attachmentMap[messageId] !== undefined) return;
      const result = await getMessageAttachments(messageId);
      if (result.status === "success") {
        setAttachmentMap((prev) =>
          prev[messageId] === undefined
            ? { ...prev, [messageId]: result.attachments }
            : prev
        );
      }
    },
    [attachmentMap]
  );

  function handleFilesChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    const accepted: PendingFile[] = [];
    for (const file of files) {
      if (file.size === 0 || file.size > MAX_ATTACHMENT_BYTES) {
        setSendError(t.attachmentSizeError);
        continue;
      }
      accepted.push({ id: newUuid(), file });
    }
    if (accepted.length > 0) {
      setSendError(null);
      setPendingFiles((prev) => [...prev, ...accepted]);
    }
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
            <h2 className="text-sm font-semibold">{t.channels}</h2>
          </div>
          {canManage && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setCreateOpen(true)}
              aria-label={t.createChannelAria}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>

        {channelList.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center">
            <p className="text-sm text-muted-foreground">{t.noChannelsYet}</p>
            {canManage && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="h-4 w-4" /> {t.createChannel}
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
                        {t.private}
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
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <Hash className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold truncate">
                  {activeChannel ? activeChannel.name : t.title}
                </h1>
                {activeChannel?.isPrivate && (
                  <Badge
                    variant="outline"
                    className="px-1.5 py-0 text-[10px]"
                  >
                    {t.private}
                  </Badge>
                )}
              </div>
              {activeChannel?.description && (
                <p className="truncate text-xs text-muted-foreground">
                  {activeChannel.description}
                </p>
              )}
            </div>
          </div>
          {activeChannel &&
            (canManage || activeChannel.createdBy === currentUser.id) && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                onClick={() => setSettingsOpen(true)}
                title={t.settings?.channelSettings ?? "Channel Settings"}
                aria-label={t.settings?.channelSettings ?? "Channel Settings"}
              >
                <Settings className="h-4 w-4" />
              </Button>
            )}
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
                {activeChannel ? `#${activeChannel.name}` : t.title}
              </p>
              <p className="text-sm text-muted-foreground">
                {t.noMessagesYet}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isOwn={message.userId === currentUser.id}
                  attachments={attachmentMap[message.id]}
                  onRequestAttachments={requestAttachments}
                  platform={platform}
                  locale={locale}
                />
              ))}
            </div>
          )}
        </div>
{/* Composer */}
        <div className="border-t border-border p-3">
          <form onSubmit={handleFormSubmit} className="grid gap-2">
            {pendingFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {pendingFiles.map((pending) => (
                  <span
                    key={pending.id}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs"
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="max-w-[160px] truncate">{pending.file.name}</span>
                    <span className="text-muted-foreground">
                      {formatFileSize(pending.file.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setPendingFiles((prev) =>
                          prev.filter((p) => p.id !== pending.id)
                        )
                      }
                      disabled={sendPending}
                      aria-label={platform.attachments.remove}
                      className="rounded p-0.5 text-muted-foreground transition-colors hover:text-destructive disabled:pointer-events-none"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-end gap-1.5">
              <Textarea
                value={composer}
                onChange={(event) => setComposer(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder={
                  activeChannel
                    ? t.messagePlaceholder.replace("{channel}", activeChannel.name)
                    : t.selectChannelPlaceholder
                }
                rows={2}
                maxLength={2000}
                disabled={!activeChannel || sendPending}
                className="min-h-0 flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={!activeChannel || sendPending}
                aria-label={t.attachFileAria}
                title={t.attachFile}
                className="shrink-0"
              >
                <Paperclip className="h-4 w-4 rtl:rotate-180" />
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFilesChosen}
              />
            </div>
            {sendError && (
              <p role="alert" className="text-sm text-destructive">
                {sendError}
              </p>
            )}
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {t.shiftEnterHint}
              </p>
              <Button
                type="submit"
                size="sm"
                disabled={
                  !activeChannel ||
                  (!composer.trim() && pendingFiles.length === 0) ||
                  sendPending
                }
              >
                {sendPending ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 rtl:rotate-180" />
                )}
                {t.send}
              </Button>
            </div>
          </form>
        </div>
      </section>

      <ChannelDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleChannelCreated}
        platform={platform}
      />

      <ChannelSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        channel={activeChannel}
        canManage={canManage}
        currentUserId={currentUser.id}
        orgMembers={orgMembers}
        onUpdated={handleChannelUpdated}
        onDeleted={handleChannelDeleted}
        platform={platform}
      />
    </div>
  );
}

interface MessageBubbleProps {
  message: ChatMessageRow;
  isOwn: boolean;
  attachments?: AttachmentRow[];
  onRequestAttachments?: (messageId: string) => void;
  /** Localized copy + formatters for the current render. */
  platform: Dictionary["platform"];
  locale: Locale;
}

/** Single chat message: avatar, sender name + time, content bubble, and attachment cards. */
function MessageBubble({
  message,
  isOwn,
  attachments,
  onRequestAttachments,
  platform,
  locale,
}: MessageBubbleProps) {
  const t = platform.chat;
  const senderName =
    message.user.fullName ?? message.user.email ?? t.teamMember;
  const initials = getInitials(senderName);

  // Eagerly fetch attachments the first time this bubble mounts (not yet loaded).
  useEffect(() => {
    if (attachments === undefined && onRequestAttachments) {
      onRequestAttachments(message.id);
    }
  }, [attachments, message.id, onRequestAttachments]);

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
            title={formatMessageDateTitle(message.createdAt, locale)}
          >
            {formatMessageTime(message.createdAt, locale)}
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

        {attachments && attachments.length > 0 && (
          <div className={cn("mt-1.5 flex flex-col gap-1.5", isOwn && "items-end")}>
            {attachments.map((attachment) => (
              <a
                key={attachment.id}
                href={attachment.downloadUrl ?? undefined}
                download={attachment.fileName}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  "inline-flex max-w-[240px] items-center gap-2 rounded-md border px-2.5 py-2 text-left text-xs transition-colors hover:bg-muted",
                  isOwn ? "border-transparent bg-primary/10" : "border-border bg-card"
                )}
              >
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{attachment.fileName}</span>
                  <span className="block text-[10px] text-muted-foreground">
                    {formatFileSize(attachment.fileSize)}
                  </span>
                </span>
                <Download className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}