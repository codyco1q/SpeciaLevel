import type { TaskPriority, TaskStatus, RichTextBlock } from "@/types/database";

/**
 * Shared copy/display metadata for the Tasks & Docs module. Client-safe.
 */

export const TASK_STATUSES: TaskStatus[] = [
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  in_review: "In Review",
  blocked: "Blocked",
  done: "Done",
};

export const TASK_STATUS_DOT_CLASSES: Record<TaskStatus, string> = {
  todo: "bg-slate-400 dark:bg-slate-500",
  in_progress: "bg-blue-500 dark:bg-blue-400",
  in_review: "bg-amber-500 dark:bg-amber-400",
  blocked: "bg-rose-500 dark:bg-rose-400",
  done: "bg-emerald-500 dark:bg-emerald-400",
};

export const TASK_STATUS_BADGE_CLASSES: Record<TaskStatus, string> = {
  todo: "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300",
  in_progress: "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300",
  in_review: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300",
  blocked: "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300",
  done: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300",
};

export const TASK_PRIORITIES: TaskPriority[] = [
  "urgent",
  "high",
  "medium",
  "low",
  "none",
];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
  none: "None",
};

/** Semantic priority badge colors */
export const TASK_PRIORITY_BADGE_CLASSES: Record<TaskPriority, string> = {
  urgent: "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/70 dark:text-rose-300 font-semibold",
  high: "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/60 dark:text-orange-300",
  medium: "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300",
  low: "border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400",
  none: "border-border bg-muted/50 text-muted-foreground",
};

export const TASK_PRIORITY_DOT_CLASSES: Record<TaskPriority, string> = {
  urgent: "bg-rose-500",
  high: "bg-orange-500",
  medium: "bg-blue-500",
  low: "bg-zinc-400",
  none: "bg-muted-foreground/40",
};

/** "Sep 12, 2026" — empty string when no due date is set. */
export function formatDueDate(iso: string | null, locale = "en-US"): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat(locale.startsWith("ar") ? "ar-EG" : locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

/** "Sep 12" — compact date format for cards */
export function formatShortDate(iso: string | null, locale = "en-US"): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat(locale.startsWith("ar") ? "ar-EG" : locale, {
      month: "short",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

/**
 * True when the due date falls before the start of today (local time), so
 * cards can highlight overdue tasks.
 */
export function isTaskOverdue(iso: string | null, nowIso: string): boolean {
  if (!iso) return false;
  const due = new Date(iso);
  const today = new Date(nowIso);
  today.setHours(0, 0, 0, 0);
  return due.getTime() < today.getTime();
}

/** Converts rich text blocks to plain text snippet for previews and cards */
export function blocksToPlainText(blocks: RichTextBlock[] | null | undefined): string {
  if (!blocks || !Array.isArray(blocks) || blocks.length === 0) return "";
  return blocks
    .map((b) => b.content ?? "")
    .filter(Boolean)
    .join(" ");
}
