import type { InvoiceStatus } from "@/types/database";

/**
 * Shared copy/display metadata for the Invoicing module. Client-safe.
 */

export const INVOICE_STATUSES: InvoiceStatus[] = [
  "draft",
  "sent",
  "paid",
  "overdue",
  "cancelled",
];

/** Semantic badge colors: neutral, blue, green, red, muted. */
export const INVOICE_STATUS_BADGE_CLASSES: Record<InvoiceStatus, string> = {
  draft: "border-zinc-300 bg-zinc-100 text-zinc-600",
  sent: "border-blue-300 bg-blue-50 text-blue-700",
  paid: "border-emerald-300 bg-emerald-50 text-emerald-700",
  overdue: "border-red-300 bg-red-50 text-red-700",
  cancelled: "border-zinc-300 bg-zinc-100 text-zinc-500",
};

/** ISO 4217 codes offered in the create dialog (any 3-letter code is accepted). */
export const INVOICING_CURRENCIES = ["USD", "EUR", "GBP", "AED", "SAR"] as const;

/**
 * Formats a monetary value with the correct currency symbol placement
 * for the active locale. Falls back to USD for codes outside the known
 * set so an unexpected stored currency never crashes the module.
 */
export function formatCurrency(
  value: number,
  currency: string,
  locale = "en-US"
): string {
  const code = (currency || "USD").toUpperCase();
  const safe = (INVOICING_CURRENCIES as readonly string[]).includes(code)
    ? code
    : "USD";
  return new Intl.NumberFormat(locale.startsWith("ar") ? "ar-EG" : locale, {
    style: "currency",
    currency: safe,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

/** "Sep 12, 2026" for issue/due dates; "—" when there is no date. */
export function formatInvoiceDate(
  value: string | null,
  locale = "en-US"
): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale.startsWith("ar") ? "ar-EG" : locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

/** Rounds half-up to 2 decimals the way the DB does. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Per-line amount = quantity × unit price. */
export function lineAmount(quantity: number, unitPrice: number): number {
  return round2(quantity * unitPrice);
}

/** Computed totals for the live estimate in the create dialog. */
export function estimateTotals(
  items: { quantity: number; unitPrice: number }[],
  taxRate: number
): { subtotal: number; taxAmount: number; total: number } {
  const subtotal = round2(
    items.reduce((sum, item) => sum + lineAmount(item.quantity, item.unitPrice), 0)
  );
  const taxAmount = round2(subtotal * (taxRate / 100));
  return { subtotal, taxAmount, total: round2(subtotal + taxAmount) };
}