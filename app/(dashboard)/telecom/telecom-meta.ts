/**
 * Shared display helpers for the Telecommunications module. Client-safe.
 */

import type {
  TelecomCallStatus,
  TelecomDirection,
  TelecomSmsStatus,
} from "@/lib/validations/telecom";
import type { Locale } from "@/lib/i18n/get-dictionary";

/** Direction badge colors (arrow in vs arrow out). */
export const TELECOM_DIRECTION_BADGE_CLASSES: Record<
  TelecomDirection,
  string
> = {
  inbound:
    "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-300",
  outbound:
    "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/50 dark:text-violet-300",
};

/** Call outcome pill colors. */
export const TELECOM_CALL_STATUS_BADGE_CLASSES: Record<
  TelecomCallStatus,
  string
> = {
  completed:
    "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300",
  missed:
    "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300",
  busy: "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/50 dark:text-orange-300",
  failed:
    "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300",
  voicemail:
    "border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300",
};

/** SMS status pill colors. */
export const TELECOM_SMS_STATUS_BADGE_CLASSES: Record<
  TelecomSmsStatus,
  string
> = {
  sent: "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300",
  delivered:
    "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300",
  failed:
    "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300",
  received:
    "border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300",
};

/** "mm:ss" (or "h:mm:ss" past the hour) from a seconds value. */
export function formatCallDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const mm = String(minutes).padStart(hours > 0 ? 2 : 1, "0");
  const ss = String(secs).padStart(2, "0");
  return hours > 0
    ? `${hours}:${mm}:${ss}`
    : `${mm}:${ss}`;
}

function intlLocale(locale: Locale): string {
  return locale.startsWith("ar") ? "ar-EG" : locale;
}

/** "Sep 12, 2026, 9:41 AM" — localized call/SMS timestamp. */
export function formatTelecomDateTime(
  value: string,
  locale: Locale
): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/**
 * Counterpart number for a call/SMS row: for outbound traffic it is
 * the dialed number; for inbound it is the caller's number.
 */
export function counterpartNumber(
  direction: string,
  fromNumber: string,
  toNumber: string
): string {
  if (direction === "outbound") return toNumber;
  // Inbound calls can be unanswered (no caller number captured) — fall
  // back to whatever side is populated.
  return fromNumber || toNumber;
}