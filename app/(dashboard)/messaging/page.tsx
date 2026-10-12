import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import {
  getChannels,
  getMessages,
  type ChatPerson,
} from "@/lib/actions/chat";
import { getExternalThreads } from "@/lib/actions/messaging";
import {
  getPhoneNumbers,
  getCarrierSettings,
} from "@/lib/actions/phone-numbers";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { MessagingView } from "./messaging-view";

export const dynamic = "force-dynamic";

interface MessagingPageProps {
  searchParams?: Promise<{ tab?: string; channel?: string }>;
}

export default async function MessagingPage({ searchParams }: MessagingPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const userContext = await getCurrentUserContext();
  if (!userContext) redirect("/login");
  if (!userContext.organization) redirect("/onboarding");

  const { platform } = await getDictionary();
  const locale = await getLocale();
  const t = platform.messaging;

  const canViewChat = hasPermission("chat.view", userContext.permissions);
  const canViewTelecom = hasPermission("telecom.view", userContext.permissions);
  const canViewCrm = hasPermission("crm.view", userContext.permissions);

  if (!canViewChat && !canViewTelecom && !canViewCrm) {
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

  // Load chat and external threads data in parallel
  const [
    channels,
    externalThreads,
    phoneNumbers,
    carrierSettings,
    supabase,
  ] = await Promise.all([
    getChannels(),
    getExternalThreads(),
    getPhoneNumbers(),
    getCarrierSettings(),
    createServerClient(),
  ]);

  const targetChannelId =
    params?.channel && channels?.some((c) => c.id === params.channel)
      ? params.channel
      : (channels?.[0]?.id ?? null);

  const initialMessages = targetChannelId
    ? (await getMessages(targetChannelId)) ?? []
    : [];

  const currentUser: ChatPerson = {
    id: userContext.user.id,
    fullName: userContext.profile.full_name ?? null,
    email: userContext.user.email,
    avatarUrl: userContext.profile.avatar_url ?? null,
  };

  const [{ data: profileRows }, { data: departmentRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url")
      .eq("organization_id", userContext.organization.id)
      .order("full_name", { ascending: true }),
    supabase
      .from("departments")
      .select("id, name")
      .eq("organization_id", userContext.organization.id)
      .order("name", { ascending: true }),
  ]);

  const orgMembers: ChatPerson[] = (
    (profileRows as unknown as { id: string; full_name: string | null; email: string | null; avatar_url: string | null }[]) ?? []
  ).map((p) => ({
    id: p.id,
    fullName: p.full_name,
    email: p.email,
    avatarUrl: p.avatar_url,
  }));

  const departments: { id: string; name: string }[] = (
    (departmentRows as unknown as { id: string; name: string }[]) ?? []
  ).map((d) => ({
    id: d.id,
    name: d.name,
  }));

  const initialTab = params?.tab || (params?.channel ? "internal" : "external");

  return (
    <div className="p-6 md:p-8">
      <MessagingView
        channels={channels ?? []}
        initialMessages={initialMessages}
        activeChannelId={targetChannelId}
        canManageChat={hasPermission("chat.manage", userContext.permissions)}
        currentUser={currentUser}
        orgMembers={orgMembers}
        departments={departments}
        initialThreads={externalThreads ?? []}
        phoneNumbers={phoneNumbers ?? []}
        carrierSettings={carrierSettings}
        initialTab={initialTab}
        organizationId={userContext.organization.id}
        platform={platform}
        locale={locale}
      />
    </div>
  );
}
