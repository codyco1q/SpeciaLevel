/**
 * Shared display helpers for the Automations module. Client-safe.
 */

import type { AutomationActionType } from "@/lib/validations/automations";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

/** Event badge colors mirroring the platform's semantic badge palette. */
export const AUTOMATION_TRIGGER_BADGE_CLASSES: Record<string, string> = {
  "lead.created": "border-blue-300 bg-blue-50 text-blue-700",
  "deal.stage_changed": "border-amber-300 bg-amber-50 text-amber-700",
  "invoice.paid": "border-violet-300 bg-violet-50 text-violet-700",
  "task.completed": "border-emerald-300 bg-emerald-50 text-emerald-700",
};

/** Action type badge colors. */
export const AUTOMATION_ACTION_BADGE_CLASSES: Record<string, string> = {
  webhook: "border-zinc-300 bg-zinc-100 text-zinc-600",
  chat_message: "border-sky-300 bg-sky-50 text-sky-700",
  create_task: "border-emerald-300 bg-emerald-50 text-emerald-700",
};

/** Execution status pill colors: success green, failure red, running blue. */
export const AUTOMATION_LOG_STATUS_BADGE_CLASSES: Record<string, string> = {
  "success": "border-emerald-300 bg-emerald-50 text-emerald-700",
  "failed": "border-red-300 bg-red-50 text-red-700",
  "running": "border-blue-300 bg-blue-50 text-blue-700",
};

type AutomationDict = Dictionary["platform"]["automations"];

/** "Sep 12, 2026 · 2:41 PM" for the logs table. */
export function formatAutomationDate(iso: string, locale = "en-US"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale.startsWith("ar") ? "ar-EG" : locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/** Host portion of a webhook URL (for list summaries). */
export function webhookHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * One-line localized action summary for the automations list:
 *   webhook       -> "Send webhook to example.com"
 *   chat_message  -> "Post to #general in chat"
 *   create_task   -> "Create task Follow up with the new lead"
 */
export function formatActionSummary(
  actionType: string,
  config: Record<string, unknown>,
  t: AutomationDict,
  channelNameById?: (channelId: string) => string | undefined
): string {
  switch (actionType as AutomationActionType) {
    case "webhook": {
      const url = typeof config.url === "string" ? config.url : "";
      return t.actionSummary.webhook.replace("{host}", webhookHost(url));
    }
    case "chat_message": {
      const channelId = typeof config.channelId === "string" ? config.channelId : "";
      const channelName =
        (channelNameById && channelNameById(channelId)) || channelId;
      return t.actionSummary.chatMessage.replace("{channel}", channelName);
    }
    case "create_task": {
      const title = typeof config.taskTitle === "string" ? config.taskTitle : "";
      return t.actionSummary.createTask.replace("{title}", title);
    }
    default:
      return actionType;
  }
}