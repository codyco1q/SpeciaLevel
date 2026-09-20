"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import {
  createChannelInputSchema,
  createUpdateChannelInputSchema,
  createMessageContentSchema,
  updateChannelMembersSchema,
  type CreateChannelState,
  type UpdateChannelState,
} from "@/lib/validations/chat";
import { getDictionary } from "@/lib/i18n/get-dictionary";

/**
 * Chat server actions.
 *
 * Security model:
 *  - `organization_id` and `user_id` are NEVER read from the payload —
 *    they come exclusively from `getCurrentUserContext()`, so a caller can
 *    only touch rows inside their own organization, as themselves.
 *  - Viewing requires `chat.view`; managing channels requires `chat.manage`
 *    or being the channel creator.
 *  - Outgoing messages verify the target channel belongs to the caller's
 *    organization in the same statement (RLS backstops this, but we never
 *    rely on frontend-only checks).
 *  - Input is re-validated with Zod server-side (schema shared with the
 *    client forms).
 */

export interface ChatPerson {
  id: string;
  fullName: string | null;
  email: string | null;
}

export interface ChatChannelRow {
  id: string;
  name: string;
  description: string | null;
  isPrivate: boolean;
  isArchived: boolean;
  isSystem: boolean;
  createdBy: string | null;
  createdAt: string;
}

export interface ChatMessageRow {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  createdAt: string;
  user: ChatPerson;
}

export interface ChannelMemberInfo {
  id: string;
  userId: string;
  channelId: string;
  role: "admin" | "member";
  createdAt: string;
  user: ChatPerson;
}

/** Raw `chat_messages` row with the sender joined in (PostgREST shape). */
interface ChatMessageJoinRow {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user:
    | { id: string; full_name: string | null; email: string | null }
    | { id: string; full_name: string | null; email: string | null }[]
    | null;
}

/** Raw channel row shape coming back from PostgREST. */
interface ChannelSelectRow {
  id: string;
  name: string;
  description: string | null;
  is_private: boolean;
  is_archived?: boolean | null;
  is_system?: boolean | null;
  created_by?: string | null;
  created_at: string;
}

interface ChannelMemberSelectRow {
  id: string;
  user_id: string;
  channel_id: string;
  role: string;
  created_at: string;
  user:
    | { id: string; full_name: string | null; email: string | null }
    | { id: string; full_name: string | null; email: string | null }[]
    | null;
}

type ChatAuthResult =
  | {
      ok: true;
      organizationId: string;
      userId: string;
      permissions: string[];
    }
  | { ok: false; error: string };

/**
 * Verifies the session, the caller's organization, and that the caller
 * holds the given chat permission.
 */
async function requireChatPermission(
  permission: "chat.view" | "chat.manage"
): Promise<ChatAuthResult> {
  const userContext = await getCurrentUserContext();
  const dict = await getDictionary();
  const err = dict.platform.chat.errors;

  if (!userContext) {
    return { ok: false, error: err.signedIn };
  }

  if (!hasPermission(permission, userContext.permissions)) {
    return {
      ok: false,
      error:
        permission === "chat.manage" ? err.noPermissionManage : err.noPermissionView,
    };
  }

  const organizationId = userContext.organization?.id;

  if (!organizationId) {
    return { ok: false, error: err.noOrg };
  }

  return {
    ok: true,
    organizationId,
    userId: userContext.user.id,
    permissions: userContext.permissions,
  };
}

function parseFieldErrors<T extends Record<string, unknown>>(
  issues: z.ZodIssue[]
): Partial<Record<keyof T, string[] | undefined>> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string") {
      (fieldErrors[key] ??= []).push(issue.message);
    }
  }
  return fieldErrors as Partial<Record<keyof T, string[] | undefined>>;
}

function toChannelRow(row: ChannelSelectRow): ChatChannelRow {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    isPrivate: row.is_private ?? false,
    isArchived: row.is_archived ?? false,
    isSystem: row.is_system ?? false,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at,
  };
}

function toChatMessageRow(row: ChatMessageJoinRow): ChatMessageRow {
  // PostgREST may return a single object or an array for a to-one join.
  const sender = Array.isArray(row.user) ? row.user[0] : row.user;

  return {
    id: row.id,
    channelId: row.channel_id,
    userId: row.user_id,
    content: row.content,
    createdAt: row.created_at,
    user: sender
      ? {
          id: sender.id,
          fullName: sender.full_name ?? null,
          email: sender.email ?? null,
        }
      : { id: row.user_id, fullName: null, email: null },
  };
}

/**
 * Retrieves all channels for the current organization (oldest first, so
 * the seeded #general channel always sits on top). Requires `chat.view`.
 */
export async function getChannels(): Promise<ChatChannelRow[] | null> {
  const userContext = await getCurrentUserContext();

  if (!userContext || !hasPermission("chat.view", userContext.permissions)) {
    return null;
  }

  const organizationId = userContext.organization?.id;
  if (!organizationId) {
    return null;
  }

  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("chat_channels")
    .select("id, name, description, is_private, is_archived, is_system, created_by, created_at")
    .eq("organization_id", organizationId)
    .eq("is_archived", false)
    .order("created_at", { ascending: true });

  if (error || !data) {
    console.error("[chat] channels fetch failed:", error?.message ?? "no rows");
    return null;
  }

  return (data as unknown as ChannelSelectRow[]).map(toChannelRow);
}

/**
 * Retrieves the most recent messages for a channel, oldest first.
 * Requires `chat.view` and that the channel belongs to the caller's
 * organization (checked in the same statement).
 */
export async function getMessages(
  channelId: string,
  limit = 200
): Promise<ChatMessageRow[] | null> {
  const userContext = await getCurrentUserContext();

  if (!userContext || !hasPermission("chat.view", userContext.permissions)) {
    return null;
  }

  const organizationId = userContext.organization?.id;
  if (!organizationId || !channelId) {
    return null;
  }

  const safeLimit = Math.min(Math.max(Math.floor(limit) || 200, 1), 500);

  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("chat_messages")
    .select(
      `
        id,
        channel_id,
        user_id,
        content,
        created_at,
        user:profiles!fk_chat_messages_user(id, full_name, email)
      `
    )
    .eq("organization_id", organizationId)
    .eq("channel_id", channelId)
    .order("created_at", { ascending: true })
    .limit(safeLimit);

  if (error || !data) {
    console.error("[chat] messages fetch failed:", error?.message ?? "no rows");
    return null;
  }

  return (data as unknown as ChatMessageJoinRow[]).map(toChatMessageRow);
}

export type SendMessageResult =
  | { status: "success"; message: ChatMessageRow }
  | { status: "error"; error: string };

/**
 * Inserts a message into the given channel. Requires `chat.view` — any
 * member who can see chat can participate. The message owner (`user_id`)
 * and `organization_id` come from the session; the target channel must
 * belong to the caller's organization.
 */
export async function sendMessage(
  channelId: string,
  content: string
): Promise<SendMessageResult> {
  const auth = await requireChatPermission("chat.view");
  if (!auth.ok) return { status: "error", error: auth.error };

  const dict = await getDictionary();
  const err = dict.platform.chat.errors;

  if (!channelId) {
    return { status: "error", error: err.missingChannel };
  }

  const parsed = createMessageContentSchema(err).safeParse(content);
  if (!parsed.success) {
    return {
      status: "error",
      error: parsed.error.issues[0]?.message ?? err.invalidMessage,
    };
  }

  const supabase = await createServerClient();

  // Verify the target channel belongs to the caller's organization.
  const { data: channel } = await supabase
    .from("chat_channels")
    .select("id")
    .eq("id", channelId)
    .eq("organization_id", auth.organizationId)
    .maybeSingle();

  if (!channel) {
    return {
      status: "error",
      error: err.channelNotFound,
    };
  }

  const { data: inserted, error } = await supabase
    .from("chat_messages")
    .insert({
      organization_id: auth.organizationId,
      channel_id: channelId,
      user_id: auth.userId,
      content: parsed.data,
    })
    .select(
      `
        id,
        channel_id,
        user_id,
        content,
        created_at,
        user:profiles!fk_chat_messages_user(id, full_name, email)
      `
    )
    .single();

  if (error) {
    console.error("[chat] send failed:", error.message);
    return {
      status: "error",
      error: err.sendFailed,
    };
  }

  return {
    status: "success",
    message: toChatMessageRow(inserted as unknown as ChatMessageJoinRow),
  };
}

export type CreateChannelResult =
  | { status: "success"; channel: ChatChannelRow }
  | {
      status: "error";
      error: string;
      fieldErrors?: CreateChannelState["fieldErrors"];
    };

/**
 * Creates a channel in the current organization. Requires `chat.manage`.
 * The creator (`created_by`) and `organization_id` come from the session.
 */
export async function createChannel(
  data: unknown
): Promise<CreateChannelResult> {
  const auth = await requireChatPermission("chat.manage");
  if (!auth.ok) return { status: "error", error: auth.error };

  const dict = await getDictionary();
  const err = dict.platform.chat.errors;

  const parsed = createChannelInputSchema(err).safeParse(data);
  if (!parsed.success) {
    return {
      status: "error",
      error: err.highlightFields,
      fieldErrors: parseFieldErrors(parsed.error.issues),
    };
  }

  const { name, description, isPrivate } = parsed.data;

  const supabase = await createServerClient();

  const { data: inserted, error } = await supabase
    .from("chat_channels")
    .insert({
      organization_id: auth.organizationId,
      name,
      description: description || null,
      is_private: isPrivate ?? false,
      created_by: auth.userId,
    })
    .select("id, name, description, is_private, is_archived, is_system, created_by, created_at")
    .single();

  if (error) {
    console.error("[chat] create channel failed:", error.message);

    // 23505 = unique violation on (organization_id, name) — friendlier error.
    if (error.code === "23505") {
      return {
        status: "error",
        error: err.channelExists,
      };
    }

    return {
      status: "error",
      error: err.createFailed,
    };
  }

  // If private, automatically add creator to channel members
  if (isPrivate) {
    await supabase.from("chat_channel_members").upsert(
      {
        organization_id: auth.organizationId,
        channel_id: inserted.id,
        user_id: auth.userId,
        role: "admin",
        added_by: auth.userId,
      },
      { onConflict: "channel_id,user_id" }
    );
  }

  revalidatePath("/chat");
  return {
    status: "success",
    channel: toChannelRow(inserted as unknown as ChannelSelectRow),
  };
}

export type UpdateChannelResult =
  | { status: "success"; channel: ChatChannelRow }
  | {
      status: "error";
      error: string;
      fieldErrors?: UpdateChannelState["fieldErrors"];
    };

/**
 * Updates an existing channel's name, description, or privacy.
 * Requires `chat.manage` or being the creator of the channel.
 */
export async function updateChannel(
  channelId: string,
  data: unknown
): Promise<UpdateChannelResult> {
  const auth = await requireChatPermission("chat.view");
  if (!auth.ok) return { status: "error", error: auth.error };

  const dict = await getDictionary();
  const err = dict.platform.chat.errors;

  if (!channelId) {
    return { status: "error", error: err.missingChannel };
  }

  const supabase = await createServerClient();

  // Verify channel exists in current org
  const { data: existing, error: fetchError } = await supabase
    .from("chat_channels")
    .select("id, name, description, is_private, is_archived, is_system, created_by")
    .eq("id", channelId)
    .eq("organization_id", auth.organizationId)
    .maybeSingle();

  if (fetchError || !existing) {
    return { status: "error", error: err.channelNotFound };
  }

  // Caller must have chat.manage OR be creator
  const canManage = hasPermission("chat.manage", auth.permissions);
  const isCreator = existing.created_by === auth.userId;
  if (!canManage && !isCreator) {
    return { status: "error", error: err.noPermissionManage };
  }

  const parsed = createUpdateChannelInputSchema(err).safeParse(data);
  if (!parsed.success) {
    return {
      status: "error",
      error: err.highlightFields,
      fieldErrors: parseFieldErrors(parsed.error.issues),
    };
  }

  const { name, description, isPrivate, isArchived } = parsed.data;

  // Protect system channels from being made private
  if (existing.is_system && isPrivate === true) {
    return {
      status: "error",
      error: dict.platform.chat.settings?.systemChannelNotice ?? "System channels cannot be made private.",
    };
  }

  const updatePayload: Record<string, unknown> = {};
  if (name !== undefined) updatePayload.name = name;
  if (description !== undefined) updatePayload.description = description || null;
  if (isPrivate !== undefined && !existing.is_system) updatePayload.is_private = isPrivate;
  if (isArchived !== undefined) updatePayload.is_archived = isArchived;

  const { data: updated, error: updateErr } = await supabase
    .from("chat_channels")
    .update(updatePayload)
    .eq("id", channelId)
    .eq("organization_id", auth.organizationId)
    .select("id, name, description, is_private, is_archived, is_system, created_by, created_at")
    .single();

  if (updateErr) {
    console.error("[chat] update channel failed:", updateErr.message);
    if (updateErr.code === "23505") {
      return { status: "error", error: err.channelExists };
    }
    return { status: "error", error: err.createFailed };
  }

  // If changing to private, ensure creator/caller is a member
  if (isPrivate === true) {
    await supabase.from("chat_channel_members").upsert(
      {
        organization_id: auth.organizationId,
        channel_id: channelId,
        user_id: auth.userId,
        role: "admin",
        added_by: auth.userId,
      },
      { onConflict: "channel_id,user_id" }
    );
  }

  revalidatePath("/chat");
  return {
    status: "success",
    channel: toChannelRow(updated as unknown as ChannelSelectRow),
  };
}

export type DeleteChannelResult =
  | { status: "success" }
  | { status: "error"; error: string };

/**
 * Deletes a channel and cascades its messages and attachments.
 * Requires `chat.manage` or being the creator.
 * Rejects if channel is system default (`is_system = true` or `#general`).
 */
export async function deleteChannel(
  channelId: string
): Promise<DeleteChannelResult> {
  const auth = await requireChatPermission("chat.view");
  if (!auth.ok) return { status: "error", error: auth.error };

  const dict = await getDictionary();
  const err = dict.platform.chat.errors;

  if (!channelId) {
    return { status: "error", error: err.missingChannel };
  }

  const supabase = await createServerClient();

  const { data: channel, error: fetchError } = await supabase
    .from("chat_channels")
    .select("id, name, is_system, created_by")
    .eq("id", channelId)
    .eq("organization_id", auth.organizationId)
    .maybeSingle();

  if (fetchError || !channel) {
    return { status: "error", error: err.channelNotFound };
  }

  if (
    channel.is_system ||
    channel.name === "general" ||
    channel.name === "client-project"
  ) {
    return {
      status: "error",
      error:
        dict.platform.chat.settings?.systemChannelCannotDelete ??
        "System channels cannot be deleted.",
    };
  }

  const canManage = hasPermission("chat.manage", auth.permissions);
  const isCreator = channel.created_by === auth.userId;
  if (!canManage && !isCreator) {
    return { status: "error", error: err.noPermissionManage };
  }

  const { error: deleteError } = await supabase
    .from("chat_channels")
    .delete()
    .eq("id", channelId)
    .eq("organization_id", auth.organizationId);

  if (deleteError) {
    console.error("[chat] delete channel failed:", deleteError.message);
    return { status: "error", error: err.createFailed };
  }

  revalidatePath("/chat");
  return { status: "success" };
}

export type GetChannelMembersResult =
  | { status: "success"; members: ChannelMemberInfo[] }
  | { status: "error"; error: string };

/**
 * Retrieves members of a specific channel.
 */
export async function getChannelMembers(
  channelId: string
): Promise<GetChannelMembersResult> {
  const auth = await requireChatPermission("chat.view");
  if (!auth.ok) return { status: "error", error: auth.error };

  const dict = await getDictionary();
  const err = dict.platform.chat.errors;

  if (!channelId) {
    return { status: "error", error: err.missingChannel };
  }

  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("chat_channel_members")
    .select(`
      id,
      user_id,
      channel_id,
      role,
      created_at,
      user:profiles!fk_chat_channel_members_user(id, full_name, email)
    `)
    .eq("organization_id", auth.organizationId)
    .eq("channel_id", channelId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[chat] fetch channel members failed:", error.message);
    return { status: "error", error: err.channelNotFound };
  }

  const members: ChannelMemberInfo[] = (
    (data ?? []) as unknown as ChannelMemberSelectRow[]
  ).map((row) => {
    const userObj = Array.isArray(row.user) ? row.user[0] : row.user;
    return {
      id: row.id,
      userId: row.user_id,
      channelId: row.channel_id,
      role: (row.role === "admin" ? "admin" : "member") as "admin" | "member",
      createdAt: row.created_at,
      user: userObj
        ? {
            id: userObj.id,
            fullName: userObj.full_name ?? null,
            email: userObj.email ?? null,
          }
        : { id: row.user_id, fullName: null, email: null },
    };
  });

  return { status: "success", members };
}



export type UpdateChannelMembersResult =
  | { status: "success" }
  | { status: "error"; error: string };

/**
 * Synchronizes the list of members for a private channel.
 * Requires `chat.manage` or being channel creator.
 */
export async function updateChannelMembers(
  channelId: string,
  memberUserIds: string[]
): Promise<UpdateChannelMembersResult> {
  const auth = await requireChatPermission("chat.view");
  if (!auth.ok) return { status: "error", error: auth.error };

  const dict = await getDictionary();
  const err = dict.platform.chat.errors;

  const parsed = updateChannelMembersSchema.safeParse({
    channelId,
    memberUserIds,
  });
  if (!parsed.success) {
    return { status: "error", error: err.highlightFields };
  }

  const supabase = await createServerClient();

  // Verify channel exists in current org
  const { data: channel, error: fetchError } = await supabase
    .from("chat_channels")
    .select("id, is_system, created_by")
    .eq("id", channelId)
    .eq("organization_id", auth.organizationId)
    .maybeSingle();

  if (fetchError || !channel) {
    return { status: "error", error: err.channelNotFound };
  }

  const canManage = hasPermission("chat.manage", auth.permissions);
  const isCreator = channel.created_by === auth.userId;
  if (!canManage && !isCreator) {
    return { status: "error", error: err.noPermissionManage };
  }

  // Fetch current members
  const { data: currentRows, error: memberFetchErr } = await supabase
    .from("chat_channel_members")
    .select("user_id")
    .eq("channel_id", channelId)
    .eq("organization_id", auth.organizationId);

  if (memberFetchErr) {
    console.error("[chat] member fetch failed:", memberFetchErr.message);
    return { status: "error", error: err.createFailed };
  }

  const currentIds = new Set((currentRows ?? []).map((r) => r.user_id));
  const targetIds = new Set(memberUserIds);

  // Always ensure channel creator stays in
  if (channel.created_by) {
    targetIds.add(channel.created_by);
  }

  const toRemove = Array.from(currentIds).filter((id) => !targetIds.has(id));
  const toAdd = Array.from(targetIds).filter((id) => !currentIds.has(id));

  if (toRemove.length > 0) {
    const { error: removeErr } = await supabase
      .from("chat_channel_members")
      .delete()
      .eq("channel_id", channelId)
      .eq("organization_id", auth.organizationId)
      .in("user_id", toRemove);

    if (removeErr) {
      console.error("[chat] remove members failed:", removeErr.message);
      return { status: "error", error: err.createFailed };
    }
  }

  if (toAdd.length > 0) {
    const rowsToInsert = toAdd.map((userId) => ({
      organization_id: auth.organizationId,
      channel_id: channelId,
      user_id: userId,
      role: (userId === channel.created_by ? "admin" : "member") as
        | "admin"
        | "member",
      added_by: auth.userId,
    }));

    const { error: insertErr } = await supabase
      .from("chat_channel_members")
      .insert(rowsToInsert);

    if (insertErr) {
      console.error("[chat] add members failed:", insertErr.message);
      return { status: "error", error: err.createFailed };
    }
  }

  revalidatePath("/chat");
  return { status: "success" };
}