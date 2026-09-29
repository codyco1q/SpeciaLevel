"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/rbac";
import { createServerClient } from "@/lib/supabase/server";
import {
  saveSocialPostSchema,
  deleteSocialPostSchema,
  type SaveSocialPostInput,
} from "@/lib/validations/marketing";
import type { MarketingSocialPost } from "@/types/database";

async function requirePermission(permission: "marketing.view" | "marketing.manage") {
  const userContext = await getCurrentUserContext();
  if (!userContext) return { ok: false as const, error: "Not signed in." };
  if (!userContext.organization) return { ok: false as const, error: "No active organization." };
  if (!hasPermission(permission, userContext.permissions)) {
    return { ok: false as const, error: "Insufficient permissions." };
  }
  return {
    ok: true as const,
    userId: userContext.user.id,
    organizationId: userContext.organization.id,
  };
}

export interface SocialPlannerStatusResult {
  isSubscribed: boolean;
  subscribedAt: string | null;
}

export async function getSocialPlannerStatus(): Promise<SocialPlannerStatusResult> {
  const auth = await requirePermission("marketing.view");
  if (!auth.ok) return { isSubscribed: false, subscribedAt: null };

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("has_social_planner_addon, social_planner_subscribed_at")
    .eq("id", auth.organizationId)
    .single();

  if (error || !data) return { isSubscribed: false, subscribedAt: null };

  return {
    isSubscribed: Boolean(data.has_social_planner_addon),
    subscribedAt: data.social_planner_subscribed_at ?? null,
  };
}

export async function activateSocialPlannerAddon(): Promise<{
  status: "success" | "error";
  error?: string;
}> {
  const auth = await requirePermission("marketing.manage");
  if (!auth.ok) return { status: "error", error: auth.error };

  const supabase = await createServerClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("organizations")
    .update({
      has_social_planner_addon: true,
      social_planner_subscribed_at: now,
      updated_at: now,
    })
    .eq("id", auth.organizationId);

  if (error) {
    return { status: "error", error: "Failed to activate Social Planner add-on." };
  }

  revalidatePath("/marketing");
  revalidatePath("/marketing/social");
  return { status: "success" };
}

export async function getSocialPosts(filters?: {
  status?: string;
}): Promise<MarketingSocialPost[]> {
  const auth = await requirePermission("marketing.view");
  if (!auth.ok) return [];

  const supabase = await createServerClient();
  let query = supabase
    .from("marketing_social_posts")
    .select(
      `
      id,
      organization_id,
      content,
      media_urls,
      platforms,
      status,
      scheduled_for,
      published_at,
      error_message,
      created_by,
      created_at,
      updated_at,
      creator:profiles!marketing_social_posts_created_by_fkey(id, full_name, email)
    `
    )
    .eq("organization_id", auth.organizationId)
    .order("created_at", { ascending: false });

  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;
  if (error) return [];

  return (data ?? []).map((row: any) => {
    const creator = Array.isArray(row.creator) ? row.creator[0] : row.creator;
    return {
      id: row.id,
      organization_id: row.organization_id,
      content: row.content,
      media_urls: row.media_urls || [],
      platforms: row.platforms || [],
      status: row.status,
      scheduled_for: row.scheduled_for,
      published_at: row.published_at,
      error_message: row.error_message,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      creator: creator
        ? {
            id: creator.id,
            full_name: creator.full_name,
            email: creator.email,
          }
        : null,
    };
  });
}

export async function saveSocialPost(payload: SaveSocialPostInput): Promise<{
  status: "success" | "error";
  error?: string;
  post?: MarketingSocialPost;
}> {
  const auth = await requirePermission("marketing.manage");
  if (!auth.ok) return { status: "error", error: auth.error };

  const parsed = saveSocialPostSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      status: "error",
      error: parsed.error.issues[0]?.message || "Invalid post data.",
    };
  }

  const data = parsed.data;
  const supabase = await createServerClient();

  if (data.id) {
    const { data: updated, error } = await supabase
      .from("marketing_social_posts")
      .update({
        content: data.content,
        media_urls: data.mediaUrls,
        platforms: data.platforms,
        status: data.status,
        scheduled_for: data.scheduledFor || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("organization_id", auth.organizationId)
      .select()
      .single();

    if (error) {
      return { status: "error", error: "Failed to update post." };
    }

    revalidatePath("/marketing");
    revalidatePath("/marketing/social");
    return { status: "success", post: updated as MarketingSocialPost };
  } else {
    const { data: inserted, error } = await supabase
      .from("marketing_social_posts")
      .insert({
        organization_id: auth.organizationId,
        content: data.content,
        media_urls: data.mediaUrls,
        platforms: data.platforms,
        status: data.status,
        scheduled_for: data.scheduledFor || null,
        created_by: auth.userId,
      })
      .select()
      .single();

    if (error) {
      return { status: "error", error: "Failed to create post." };
    }

    revalidatePath("/marketing");
    revalidatePath("/marketing/social");
    return { status: "success", post: inserted as MarketingSocialPost };
  }
}

export async function deleteSocialPost(id: string): Promise<{
  status: "success" | "error";
  error?: string;
}> {
  const auth = await requirePermission("marketing.manage");
  if (!auth.ok) return { status: "error", error: auth.error };

  const parsed = deleteSocialPostSchema.safeParse({ id });
  if (!parsed.success) return { status: "error", error: "Invalid post ID." };

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("marketing_social_posts")
    .delete()
    .eq("id", parsed.data.id)
    .eq("organization_id", auth.organizationId);

  if (error) {
    return { status: "error", error: "Failed to delete post." };
  }

  revalidatePath("/marketing");
  revalidatePath("/marketing/social");
  return { status: "success" };
}
