/**
 * Shared display helpers for the Marketing module. Client-safe.
 */

import type { MarketingChannel, MarketingStatus } from "@/lib/validations/marketing";
import type { Locale } from "@/lib/i18n/get-dictionary";

/** Channel badge colors mirroring the platform's semantic badge palette. */
export const MARKETING_CHANNEL_BADGE_CLASSES: Record<MarketingChannel, string> = {
  meta: "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300",
  google: "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-300",
  email: "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/50 dark:text-violet-300",
  content: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300",
  linkedin: "border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300",
  other: "border-zinc-300 bg-zinc-100 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-400",
};

/** Campaign status pill colors. */
export const MARKETING_STATUS_BADGE_CLASSES: Record<MarketingStatus, string> = {
  draft: "border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300",
  active: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300",
  paused: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300",
  completed: "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300",
};

/**
 * UTM source derived from the campaign channel so the generator helper
 * never asks the user to pick a redundant value.
 */
export const MARKETING_UTM_SOURCES: Record<MarketingChannel, string> = {
  meta: "facebook",
  google: "google",
  email: "newsletter",
  content: "organic",
  linkedin: "linkedin",
  other: "social",
};

/** UTM medium options offered by the generator helper. */
export const MARKETING_UTM_MEDIUMS = [
  "cpc",
  "email",
  "social",
  "display",
  "organic",
  "manual",
] as const;

export type MarketingUtmMedium = (typeof MARKETING_UTM_MEDIUMS)[number];

function intlLocale(locale: Locale): string {
  return locale.startsWith("ar") ? "ar-EG" : locale;
}

/** Formats a monetary value as USD with the active locale's number rules. */
export function formatCampaignMoney(value: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

function parseIsoDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "Sep 12, 2026" for a single campaign date; "—" when unset. */
export function formatCampaignDate(
  value: string | null,
  locale: Locale
): string {
  const date = parseIsoDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat(intlLocale(locale), {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

/**
 * "Sep 1 – Oct 31, 2026" for the campaign date range column; "—" when
 * neither endpoint is set, and a single formatted date when only one is.
 */
export function formatCampaignDateRange(
  start: string | null,
  end: string | null,
  locale: Locale
): string {
  const startDate = parseIsoDate(start);
  const endDate = parseIsoDate(end);
  if (!startDate && !endDate) return "—";

  const monthDay = new Intl.DateTimeFormat(intlLocale(locale), {
    month: "short",
    day: "numeric",
  });
  const full = new Intl.DateTimeFormat(intlLocale(locale), {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  if (startDate && endDate) {
    if (startDate.getFullYear() === endDate.getFullYear()) {
      return `${monthDay.format(startDate)} – ${full.format(endDate)}`;
    }
    return `${full.format(startDate)} – ${full.format(endDate)}`;
  }
  return full.format((startDate ?? endDate) as Date);
}

/** "q4-product-launch" — the slug used for the UTM campaign param. */
export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

/**
 * Full tracking URL: `${baseUrl}?utm_source=…&utm_medium=…&utm_campaign=…`.
 * Appends with `&` when the base URL already carries query params.
 */
export function buildUtmUrl(
  baseUrl: string,
  source: string,
  medium: string,
  campaign: string
): string {
  const base = baseUrl.trim() || "https://example.com/landing";
  const params = new URLSearchParams({
    utm_source: source,
    utm_medium: medium,
    utm_campaign: slugify(campaign) || "campaign",
  });
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}${params.toString()}`;
}