/**
 * Shared display helpers for the AI module. Client-safe.
 */

/** Provider pill colors mirroring the platform's semantic badge palette. */
export const AI_PROVIDER_BADGE_CLASSES: Record<string, string> = {
  openai: "border-emerald-300 bg-emerald-50 text-emerald-700",
  openrouter: "border-violet-300 bg-violet-50 text-violet-700",
  custom: "border-zinc-300 bg-zinc-100 text-zinc-600",
}

/** Execution status pill colors: green success, red failure, blue running. */
export const AI_STATUS_BADGE_CLASSES: Record<string, string> = {
  success: "border-emerald-300 bg-emerald-50 text-emerald-700",
  failed: "border-red-300 bg-red-50 text-red-700",
  running: "border-blue-300 bg-blue-50 text-blue-700",
}

/** "Sep 12, 2026 · 2:41 PM" for the history table. */
export function formatAiDate(iso: string, locale = "en-US"): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat(locale.startsWith("ar") ? "ar-EG" : locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

/**
 * Client-side preview: replaces {input} with the typed value and hides
 * other empty {placeholders} not supplied in this run.
 */
export function renderTemplatePreview(template: string, input: string): string {
  return (
    template
      .split("{input}")
      .join(input)
      // Strip leftover {placeholders} not supplied in this run.
      .replace(/\{[\w.-]+\}/g, "")
  )
}