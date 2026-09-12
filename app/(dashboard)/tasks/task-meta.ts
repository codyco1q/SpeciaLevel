import type { TaskPriority, TaskStatus } from "@/types/database";

/**
 * Shared copy/display metadata for the Tasks module. Client-safe.
 */

export const TASK_STATUSES: TaskStatus[] = [
  "todo",
  "in_progress",
  "review",
  "done",
];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
};

export const TASK_STATUS_DOT_CLASSES: Record<TaskStatus, string> = {
  todo: "bg-muted-foreground",
  in_progress: "bg-blue-500",
  review: "bg-amber-500",
  done: "bg-emerald-500",
};

export const TASK_PRIORITIES: TaskPriority[] = [
  "low",
  "medium",
  "high",
  "urgent",
];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

/** Semantic priority badge colors: Low → gray, Medium → blue, High → amber, Urgent → red. */
export const TASK_PRIORITY_BADGE_CLASSES: Record<TaskPriority, string> = {
  low: "border-zinc-300 bg-zinc-100 text-zinc-600",
  medium: "border-blue-300 bg-blue-50 text-blue-700",
  high: "border-amber-300 bg-amber-50 text-amber-700",
  urgent: "border-red-300 bg-red-50 text-red-700",
};

/** "Sep 12, 2026" — empty string when no due date is set. */
export function formatDueDate(iso: string | null, locale = "en-US"): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat(locale.startsWith("ar") ? "ar-EG" : locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
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