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

export async function loadMessagingData(requestedChannelId?: string | null) {
  const userContext = await getCurrentUserContext();
  if (!userContext) redirect("/login");
  if (!userContext.organization) redirect("/onboarding");

  const { platform } = await getDictionary();
  const locale = await getLocale();

  const canViewChat = hasPermission("chat.view", userContext.permissions);
  const canViewTelecom = hasPermission("telecom.view", userContext.permissions);
  const canViewCrm = hasPermission("crm.view", userContext.permissions);

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
    requestedChannelId && channels?.some((c) => c.id === requestedChannelId)
      ? requestedChannelId
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

  return {
    userContext,
    platform,
    locale,
    canViewChat,
    canViewTelecom,
    canViewCrm,
    channels: channels ?? [],
    initialMessages,
    targetChannelId,
    currentUser,
    orgMembers,
    departments,
    externalThreads: externalThreads ?? [],
    phoneNumbers: phoneNumbers ?? [],
    carrierSettings,
  };
}
