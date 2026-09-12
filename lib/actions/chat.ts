"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import {
  channelInputSchema,
  messageContentSchema,
  type CreateChannelState,
} from "@/lib/validations/chat";

/**
 * Chat server actions.
 *
 * Security model:
 *  - `organization_id` and `user_id` are NEVER read from the payload —
 *    they come exclusively from `getCurrentUserContext()`, so a caller can
 *    only touch rows inside their own organization, as themselves.
 *  - Viewing requires `chat.view`; creating channels requires `chat.manage`.
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
  created_at: string;
}

type ChatAuthResult =
  | { ok: true; organizationId: string; userId: string }
  | { ok: false; error: string };

/**
 * Verifies the session, the caller's organization, and that the caller
 * holds the given chat permission.
 */
async function requireChatPermission(
  permission: "chat.view" | "chat.manage"
): Promise<ChatAuthResult> {
  const userContext = await getCurrentUserContext();

  if (!userContext) {
    return { ok: false, error: "You must be signed in to do this." };
  }

  if (!hasPermission(permission, userContext.permissions)) {
    return {
      ok: false,
      error:
        permission === "chat.manage"
          ? "You don't have permission to create channels."
          : "You don't have permission to use chat.",
    };
  }

  const organizationId = userContext.organization?.id;

  if (!organizationId) {
    return { ok: false, error: "No organization found for your account." };
  }

  return {
    ok: true,
    organizationId,
    userId: userContext.user.id,
  };
}

function parseFieldErrors(
  issues: z.ZodIssue[]
): CreateChannelState["fieldErrors"] {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string") {
      (fieldErrors[key] ??= []).push(issue.message);
    }
  }
  return fieldErrors;
}

function toChannelRow(row: ChannelSelectRow): ChatChannelRow {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    isPrivate: row.is_private,
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
    .select("id, name, description, is_private, created_at")
    .eq("organization_id", organizationId)
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

  if (!channelId) {
    return { status: "error", error: "Missing channel." };
  }

  const parsed = messageContentSchema.safeParse(content);
  if (!parsed.success) {
    return {
      status: "error",
      error: parsed.error.issues[0]?.message ?? "Invalid message.",
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
      error: "Channel not found, or you don't have access to it.",
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
      error: "Could not send the message. Please try again.",
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

  const parsed = channelInputSchema.safeParse(data);
  if (!parsed.success) {
    return {
      status: "error",
      error: "Please fix the highlighted fields.",
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
    .select("id, name, description, is_private, created_at")
    .single();

  if (error) {
    console.error("[chat] create channel failed:", error.message);

    // 23505 = unique violation on (organization_id, name) — friendlier error.
    if (error.code === "23505") {
      return {
        status: "error",
        error: "A channel with that name already exists.",
      };
    }

    return {
      status: "error",
      error: "Could not create the channel. Please try again.",
    };
  }

  revalidatePath("/chat");
  return {
    status: "success",
    channel: toChannelRow(inserted as unknown as ChannelSelectRow),
  };
}