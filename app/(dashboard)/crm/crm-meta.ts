import type { CrmStage, MarketingLeadStatus } from "@/types/database";

/**
 * Shared copy/display metadata for the CRM module. Client-safe.
 */

export const CRM_STAGES: CrmStage[] = [
  "lead",
  "contacted",
  "proposal",
  "won",
  "lost",
];

/** Semantic column dots: open → neutral, warm, amber, green, red. */
export const CRM_STAGE_DOT_CLASSES: Record<CrmStage, string> = {
  lead: "bg-muted-foreground",
  contacted: "bg-blue-500",
  proposal: "bg-amber-500",
  won: "bg-emerald-500",
  lost: "bg-red-500",
};

export const LEAD_STATUSES: MarketingLeadStatus[] = [
  "new",
  "contacted",
  "converted",
  "archived",
];

export const LEAD_STATUS_BADGE_CLASSES: Record<MarketingLeadStatus, string> = {
  new: "border-blue-300 bg-blue-50 text-blue-700",
  contacted: "border-amber-300 bg-amber-50 text-amber-700",
  converted: "border-emerald-300 bg-emerald-50 text-emerald-700",
  archived: "border-zinc-300 bg-zinc-100 text-zinc-600",
};

/** ISO 4217 codes offered in the deal dialog (any 3-letter code is accepted). */
export const CRM_CURRENCIES = ["USD", "EUR", "GBP", "AED", "SAR"] as const;

/**
 * Formats a deal value with the correct currency symbol placement for the
 * active locale. Falls back to USD for codes outside the known set so an
 * unexpected stored currency never crashes the board.
 */
export function formatCurrency(
  value: number,
  currency: string,
  locale = "en-US"
): string {
  const code = (currency || "USD").toUpperCase();
  const safe = (CRM_CURRENCIES as readonly string[]).includes(code)
    ? code
    : "USD";
  return new Intl.NumberFormat(locale.startsWith("ar") ? "ar-EG" : locale, {
    style: "currency",
    currency: safe,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

/** "Sep 12, 2026" for inbound lead timestamps. */
export function formatLeadDate(iso: string, locale = "en-US"): string {
  return new Intl.DateTimeFormat(locale.startsWith("ar") ? "ar-EG" : locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}