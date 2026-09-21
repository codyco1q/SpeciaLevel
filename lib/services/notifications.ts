import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { NotificationType } from "@/types/database";

export interface DispatchNotificationParams {
  orgId: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  link?: string | null;
}

export interface DispatchOrgNotificationParams {
  orgId: string;
  title: string;
  message: string;
  type: NotificationType;
  link?: string | null;
  specificUserId?: string | null;
}

/**
 * Dispatches an in-app notification to a specific user and triggers any
 * configured external webhook integrations asynchronously.
 */
export async function dispatchNotification(params: DispatchNotificationParams) {
  try {
    const supabase = createServiceRoleClient();

    const { error } = await supabase.from("system_notifications").insert({
      organization_id: params.orgId,
      user_id: params.userId,
      title: params.title,
      message: params.message,
      type: params.type,
      link: params.link ?? null,
      is_read: false,
    });

    if (error) {
      console.error("[notifications] Failed to insert notification:", error.message);
    }

    // Trigger external webhook if configured
    const webhookUrl = process.env.ORGANIZATION_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Event-Type": `notification.${params.type}`,
          },
          body: JSON.stringify({
            event: "notification.created",
            organization_id: params.orgId,
            user_id: params.userId,
            type: params.type,
            title: params.title,
            message: params.message,
            link: params.link ?? null,
            timestamp: new Date().toISOString(),
          }),
        }).catch((err) => {
          console.error("[notifications] Webhook dispatch error:", err);
        });
      } catch (err) {
        console.error("[notifications] Webhook error:", err);
      }
    }
  } catch (err) {
    console.error("[notifications] Unexpected error in dispatchNotification:", err);
  }
}

/**
 * Dispatches an in-app notification to all administrators / managers of an organization,
 * as well as an optional specific user (e.g. form creator or deal owner).
 */
export async function dispatchNotificationToOrgAdmins(params: DispatchOrgNotificationParams) {
  try {
    const supabase = createServiceRoleClient();

    // Query profiles in the organization with admin/manager roles
    const { data: members, error } = await supabase
      .from("user_roles")
      .select("user_id, roles!inner(key)")
      .eq("organization_id", params.orgId);

    const recipientIds = new Set<string>();

    if (params.specificUserId) {
      recipientIds.add(params.specificUserId);
    }

    if (!error && members) {
      for (const m of members) {
        const role = Array.isArray(m.roles) ? m.roles[0] : m.roles;
        if (role && ["owner", "admin", "manager"].includes(role.key)) {
          recipientIds.add(m.user_id);
        }
      }
    }

    // If no roles matched, fallback to all profiles in that organization
    if (recipientIds.size === 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id")
        .eq("organization_id", params.orgId)
        .limit(5);

      if (profiles) {
        for (const p of profiles) {
          recipientIds.add(p.id);
        }
      }
    }

    await Promise.all(
      Array.from(recipientIds).map((userId) =>
        dispatchNotification({
          orgId: params.orgId,
          userId,
          title: params.title,
          message: params.message,
          type: params.type,
          link: params.link,
        })
      )
    );
  } catch (err) {
    console.error("[notifications] Unexpected error in dispatchNotificationToOrgAdmins:", err);
  }
}
