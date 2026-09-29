"use client";

import { useState } from "react";
import { MessageSquare, Users, MessagesSquare } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChatView } from "@/app/(dashboard)/chat/chat-view";
import { ExternalInboxView } from "./external-inbox-view";
import type { ChatChannelRow, ChatMessageRow, ChatPerson } from "@/lib/actions/chat";
import type { ExternalThreadItem } from "@/lib/actions/messaging";
import type { PhoneNumberWithAgent } from "@/lib/actions/phone-numbers";
import type { PhoneCarrierSettings } from "@/types/database";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

interface MessagingViewProps {
  // Internal chat props
  channels: ChatChannelRow[];
  initialMessages: ChatMessageRow[];
  activeChannelId: string | null;
  canManageChat: boolean;
  currentUser: ChatPerson;
  orgMembers: ChatPerson[];
  // External inbox props
  initialThreads: ExternalThreadItem[];
  phoneNumbers: PhoneNumberWithAgent[];
  carrierSettings: PhoneCarrierSettings | null;
  // Shared
  organizationId: string;
  platform: Dictionary["platform"];
  locale: Locale;
}

export function MessagingView({
  channels,
  initialMessages,
  activeChannelId,
  canManageChat,
  currentUser,
  orgMembers,
  initialThreads,
  phoneNumbers,
  carrierSettings,
  organizationId,
  platform,
  locale,
}: MessagingViewProps) {
  const [activeTab, setActiveTab] = useState<string>("external");
  const t = platform.messaging;

  return (
    <div className="flex flex-col gap-4">
      {/* Header & Unified Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t.subtitle}
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
          <TabsList className="grid grid-cols-2 w-[340px]">
            <TabsTrigger value="external" className="gap-2 text-xs">
              <MessagesSquare className="h-3.5 w-3.5" />
              <span>{t.tabs.external}</span>
            </TabsTrigger>
            <TabsTrigger value="internal" className="gap-2 text-xs">
              <Users className="h-3.5 w-3.5" />
              <span>{t.tabs.internal}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* External Conversations Content */}
      {activeTab === "external" && (
        <div>
          <ExternalInboxView
            initialThreads={initialThreads}
            phoneNumbers={phoneNumbers}
            carrierSettings={carrierSettings}
            organizationId={organizationId}
            platform={platform}
            locale={locale}
          />
        </div>
      )}

      {/* Internal Channels Content */}
      {activeTab === "internal" && (
        <div className="min-h-[600px]">
          <ChatView
            channels={channels}
            initialMessages={initialMessages}
            activeChannelId={activeChannelId}
            canManage={canManageChat}
            currentUser={currentUser}
            orgMembers={orgMembers}
            organizationId={organizationId}
            platform={platform}
            locale={locale}
          />
        </div>
      )}
    </div>
  );
}
