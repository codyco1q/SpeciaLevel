"use client";

import { useState, useEffect, useTransition, useMemo, useRef } from "react";
import Link from "next/link";
import {
  MessageSquare,
  Search,
  Send,
  Phone,
  User,
  ExternalLink,
  Building,
  Check,
  CheckCheck,
  AlertCircle,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createBrowserClient } from "@/lib/supabase/client";
import {
  getContactSmsThread,
  sendExternalSms,
  type ExternalThreadItem,
  type SmsMessageRow,
} from "@/lib/actions/messaging";
import type { PhoneNumberWithAgent } from "@/lib/actions/phone-numbers";
import type { PhoneCarrierSettings } from "@/types/database";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";
import { cn } from "@/lib/utils";

interface ExternalInboxViewProps {
  initialThreads: ExternalThreadItem[];
  phoneNumbers: PhoneNumberWithAgent[];
  carrierSettings: PhoneCarrierSettings | null;
  organizationId: string;
  platform: Dictionary["platform"];
  locale: Locale;
}

export function ExternalInboxView({
  initialThreads,
  phoneNumbers,
  carrierSettings,
  organizationId,
  platform,
  locale,
}: ExternalInboxViewProps) {
  const t = platform.messaging.external;

  const [threads, setThreads] = useState<ExternalThreadItem[]>(initialThreads);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(
    initialThreads[0]?.contact?.id ?? null
  );
  const [messages, setMessages] = useState<SmsMessageRow[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [composerText, setComposerText] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, startSendTransition] = useTransition();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeNumbers = useMemo(
    () => phoneNumbers.filter((n) => n.status === "active"),
    [phoneNumbers]
  );
  const defaultFrom = activeNumbers[0]?.phone_number || "";
  const [selectedFromNumber, setSelectedFromNumber] = useState<string>(defaultFrom);

  const activeContact = useMemo(() => {
    return threads.find((th) => th.contact.id === selectedContactId)?.contact ?? null;
  }, [threads, selectedContactId]);

  const filteredThreads = useMemo(() => {
    if (!searchQuery.trim()) return threads;
    const q = searchQuery.toLowerCase();
    return threads.filter((th) => {
      const c = th.contact;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        (c.company && c.company.toLowerCase().includes(q))
      );
    });
  }, [threads, searchQuery]);


  useEffect(() => {
    if (!selectedContactId) {
      setMessages([]);
      return;
    }

    let isMounted = true;
    setLoadingMessages(true);
    setSendError(null);

    getContactSmsThread(selectedContactId)
      .then((data) => {
        if (isMounted) {
          setMessages(data);
          setLoadingMessages(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load SMS messages:", err);
        if (isMounted) setLoadingMessages(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedContactId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!organizationId) return;

    const supabase = createBrowserClient();
    const channel = supabase
      .channel(`telecom_sms_org_${organizationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "telecom_sms",
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          const newSms = payload.new as unknown as SmsMessageRow;
          if (!newSms) return;

          if (newSms.contact_id === selectedContactId) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newSms.id)) return prev;
              return [...prev, newSms];
            });
          }

          setThreads((prevThreads) => {
            return prevThreads.map((th) => {
              if (th.contact.id === newSms.contact_id) {
                return {
                  ...th,
                  lastMessage: {
                    id: newSms.id,
                    body: newSms.body,
                    direction: newSms.direction,
                    status: newSms.status,
                    created_at: newSms.created_at,
                  },
                };
              }
              return th;
            });
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, selectedContactId]);

  const handleSendMessage = () => {
    if (!selectedContactId || !composerText.trim() || !activeContact?.phone) return;

    setSendError(null);
    const body = composerText.trim();

    startSendTransition(async () => {
      const res = await sendExternalSms({
        contactId: selectedContactId,
        body,
        fromNumber: selectedFromNumber || defaultFrom,
      });

      if (res.status === "error") {
        setSendError(res.error ?? "Failed to dispatch SMS.");
      } else {
        setComposerText("");
        if (res.data) {
          const row = res.data as SmsMessageRow;
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, row];
          });
          setThreads((prev) =>
            prev.map((th) =>
              th.contact.id === selectedContactId
                ? {
                    ...th,
                    lastMessage: {
                      id: row.id,
                      body: row.body,
                      direction: row.direction,
                      status: row.status,
                      created_at: row.created_at,
                    },
                  }
                : th
            )
          );
        }
      }
    });
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
        hour: "numeric",
        minute: "numeric",
        hour12: true,
        month: "short",
        day: "numeric",
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 h-[calc(100vh-14rem)] border rounded-xl bg-card overflow-hidden shadow-sm">
      {/* LEFT PANE: Contact Threads List */}
      <div className="lg:col-span-4 border-e flex flex-col h-full bg-muted/20">
        <div className="p-3.5 border-b bg-card">
          <div className="relative">
            <Search className="absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="ps-9 h-9 text-xs bg-muted/50"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border/60">
          {filteredThreads.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-xs space-y-1">
              <MessageSquare className="h-8 w-8 mx-auto opacity-40 mb-2" />
              <p className="font-semibold">{t.noThreads}</p>
              <p className="text-[11px] opacity-80">{t.noThreadsHint}</p>
            </div>
          ) : (
            filteredThreads.map((item) => {
              const contact = item.contact;
              const isSelected = contact.id === selectedContactId;
              const lastMsg = item.lastMessage;
              const initials = contact.name
                ? contact.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()
                : "C";

              return (
                <button
                  key={contact.id}
                  onClick={() => setSelectedContactId(contact.id)}
                  type="button"
                  className={cn(
                    "w-full text-start p-3 transition-colors flex items-start gap-3 hover:bg-accent/50",
                    isSelected ? "bg-accent text-accent-foreground font-medium" : ""
                  )}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <p className="truncate text-xs font-semibold">{contact.name}</p>
                      {lastMsg && (
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {formatTimestamp(lastMsg.created_at)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      {contact.company && (
                        <span className="truncate max-w-[110px] inline-flex items-center gap-1">
                          <Building className="h-3 w-3 inline shrink-0" />
                          {contact.company}
                        </span>
                      )}
                      {contact.phone && !contact.company && (
                        <span className="truncate inline-flex items-center gap-1 font-mono text-[10px]">
                          <Phone className="h-2.5 w-2.5 inline shrink-0" />
                          {contact.phone}
                        </span>
                      )}
                    </div>

                    {lastMsg ? (
                      <p className="truncate text-[11px] text-muted-foreground/90 mt-1">
                        {lastMsg.direction === "outbound" ? (
                          <span className="text-primary font-medium">You: </span>
                        ) : null}
                        {lastMsg.body}
                      </p>
                    ) : (
                      <p className="text-[10px] italic text-muted-foreground/60 mt-1">
                        {t.startWithContact}
                      </p>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT PANE CONTAINER */}
      <div className="lg:col-span-8 flex flex-col h-full bg-card">
        {activeContact ? (
          <>
            {/* Contact Header */}
            <div className="p-3.5 border-b flex flex-wrap items-center justify-between gap-3 bg-muted/10">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                  {activeContact.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold truncate">{activeContact.name}</h2>
                    {activeContact.company && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {activeContact.company}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    {activeContact.phone ? (
                      <span className="font-mono text-[11px] flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {activeContact.phone}
                      </span>
                    ) : (
                      <span className="text-amber-500 font-medium text-[11px] flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {t.noPhone}
                      </span>
                    )}
                    {activeContact.title && (
                      <span className="truncate hidden sm:inline">{activeContact.title}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button asChild variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                  <Link href={`/contacts/${activeContact.id}`}>
                    <User className="h-3.5 w-3.5" />
                    <span>{t.viewProfile}</span>
                    <ExternalLink className="h-3 w-3 opacity-60" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/5">
              {loadingMessages ? (
                <div className="flex h-full items-center justify-center">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center p-8 text-muted-foreground space-y-2">
                  <MessageSquare className="h-10 w-10 opacity-30 text-primary" />
                  <p className="text-sm font-semibold text-foreground">
                    {t.newConversation}
                  </p>
                  <p className="text-xs max-w-sm">
                    {activeContact.phone ? t.selectPromptDesc : t.noPhoneHint}
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isOutbound = msg.direction === "outbound";
                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex flex-col max-w-[78%]",
                        isOutbound ? "ms-auto items-end" : "me-auto items-start"
                      )}
                    >
                      <div
                        className={cn(
                          "rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-sm",
                          isOutbound
                            ? "bg-primary text-primary-foreground rounded-br-xs"
                            : "bg-muted/80 text-foreground border border-border/80 rounded-bl-xs"
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                      </div>

                      <div
                        className={cn(
                          "flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground",
                          isOutbound ? "justify-end" : "justify-start"
                        )}
                      >
                        {isOutbound ? (
                          <ArrowUpRight className="h-3 w-3 text-primary shrink-0" />
                        ) : (
                          <ArrowDownLeft className="h-3 w-3 text-emerald-500 shrink-0" />
                        )}
                        <span className="font-mono">{msg.from_number}</span>
                        <span>•</span>
                        <span>{formatTimestamp(msg.created_at)}</span>
                        {isOutbound && (
                          <span className="inline-flex items-center gap-0.5 ms-1">
                            {msg.status === "delivered" ? (
                              <CheckCheck className="h-3 w-3 text-emerald-500" />
                            ) : msg.status === "sent" ? (
                              <Check className="h-3 w-3 text-primary" />
                            ) : (
                              <Clock className="h-3 w-3 text-muted-foreground" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
            <div className="p-3 border-t bg-card space-y-2">
              {sendError && (
                <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-2 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>{sendError}</span>
                </div>
              )}

              {!activeContact.phone ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{t.noPhoneHint}</span>
                  </div>
                  <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                    <Link href={`/contacts/${activeContact.id}`}>Edit Contact</Link>
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-[11px]">{t.fromNumber}:</span>
                      {activeNumbers.length > 0 ? (
                        <Select
                          value={selectedFromNumber}
                          onValueChange={setSelectedFromNumber}
                        >
                          <SelectTrigger className="h-7 text-xs font-mono w-[180px]">
                            <SelectValue placeholder="Select Sender..." />
                          </SelectTrigger>
                          <SelectContent>
                            {activeNumbers.map((num) => (
                              <SelectItem
                                key={num.id}
                                value={num.phone_number}
                                className="text-xs font-mono"
                              >
                                {num.friendly_name
                                  ? `${num.friendly_name} (${num.phone_number})`
                                  : num.phone_number}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground font-mono">
                          {defaultFrom || "+1 (Default Sender)"}
                        </Badge>
                      )}
                    </div>

                    <span className="text-[10px] text-muted-foreground font-mono">
                      {composerText.length}/1600 characters
                    </span>
                  </div>

                  <div className="flex items-end gap-2">
                    <Textarea
                      rows={2}
                      value={composerText}
                      onChange={(e) => setComposerText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder={t.typePlaceholder.replace("{name}", activeContact.name)}
                      className="resize-none text-xs leading-relaxed"
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={isSending || !composerText.trim()}
                      className="h-14 px-4 shrink-0 gap-1.5"
                    >
                      <Send className="h-4 w-4 rtl:rotate-180" />
                      <span className="hidden sm:inline">
                        {isSending ? t.sending : t.send}
                      </span>
                    </Button>
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground space-y-2">
            <MessageSquare className="h-12 w-12 opacity-20" />
            <h3 className="text-sm font-semibold text-foreground">{t.selectPrompt}</h3>
            <p className="text-xs max-w-sm">{t.selectPromptDesc}</p>
          </div>
        )}
      </div>
    </div>
  );
}
