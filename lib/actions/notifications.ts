"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import type { SystemNotification } from "@/types/database";

export interface NotificationsResult {
  notifications: SystemNotification[];
  unreadCount: number;
}

/**
 * Fetches latest notifications for the current authenticated user in their active organization.
 */
export async function getUserNotifications(): Promise<NotificationsResult> {
  const userContext = await getCurrentUserContext();
  if (!userContext || !userContext.organization) {
    return { notifications: [], unreadCount: 0 };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("system_notifications")
    .select("*")
    .eq("organization_id", userContext.organization.id)
    .eq("user_id", userContext.user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !data) {
    console.error("[notifications] Failed to fetch user notifications:", error?.message);
    return { notifications: [], unreadCount: 0 };
  }

  const notifications = data as SystemNotification[];
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return { notifications, unreadCount };
}

/**
 * Marks a single notification as read.
 */
export async function markNotificationAsRead(id: string): Promise<boolean> {
  const userContext = await getCurrentUserContext();
  if (!userContext || !userContext.organization) {
    return false;
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("system_notifications")
    .update({ is_read: true })
    .eq("id", id)
    .eq("user_id", userContext.user.id)
    .eq("organization_id", userContext.organization.id);

  if (error) {
    console.error("[notifications] Failed to mark notification as read:", error.message);
    return false;
  }

  revalidatePath("/", "layout");
  return true;
}

/**
 * Marks all unread notifications for the current user in this organization as read.
 */
export async function markAllNotificationsAsRead(): Promise<boolean> {
  const userContext = await getCurrentUserContext();
  if (!userContext || !userContext.organization) {
    return false;
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("system_notifications")
    .update({ is_read: true })
    .eq("user_id", userContext.user.id)
    .eq("organization_id", userContext.organization.id)
    .eq("is_read", false);

  if (error) {
    console.error("[notifications] Failed to mark all notifications as read:", error.message);
    return false;
  }

  revalidatePath("/", "layout");
  return true;
}
