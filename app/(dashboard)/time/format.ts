/**
 * Pure time formatters shared by the /time server page and the client
 * tracker component. No hooks, no browser APIs — safe anywhere.
 */

/** "٠١٢٣٤٥٦٧٨٩" — deterministic digit mapping for Arabic renders. */
export const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** Localize ASCII digits for Arabic locales; no-op otherwise. */
export function localizeDigits(value: number | string, locale?: string): string {
  const text = String(value);
  if (!locale || !locale.startsWith("ar")) return text;
  return text.replace(/[0-9]/g, (digit) => ARABIC_DIGITS[Number(digit)]);
}

/** Resolve a locale to a concrete Intl tag (Gregorian Arabic for `ar`). */
export function toIntlLocale(locale?: string): string {
  return locale?.startsWith("ar") ? "ar-EG" : locale || "en-US";
}

/** 3723 -> "01:02:03" (live timer). */
export function formatElapsed(totalSeconds: number, locale?: string): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  const parts = [h, m, s].map((n) => String(n).padStart(2, "0"));
  return localizeDigits(parts.join(":"), locale);
}

/** Localized unit letters for compact durations ("h", "m", "s"). */
export interface DurationUnits {
  hours: string;
  minutes: string;
  seconds: string;
}

export const DEFAULT_DURATION_UNITS: DurationUnits = {
  hours: "h",
  minutes: "m",
  seconds: "s",
};

/** 8100 -> "2h 15m", 50 -> "50s", 0 -> "0s". */
export function formatDurationCompact(
  totalSeconds: number | null,
  units: DurationUnits = DEFAULT_DURATION_UNITS,
  locale?: string
): string {
  if (totalSeconds === null) return "—";
  const safe = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0)
    return `${localizeDigits(h, locale)}${units.hours} ${localizeDigits(m, locale)}${units.minutes}`;
  if (m > 0)
    return `${localizeDigits(m, locale)}${units.minutes} ${localizeDigits(s, locale)}${units.seconds}`;
  return `${localizeDigits(s, locale)}${units.seconds}`;
}

/** Alias for formatDurationCompact */
export function formatDuration(
  totalSeconds: number | null,
  units: DurationUnits = DEFAULT_DURATION_UNITS,
  locale?: string
): string {
  return formatDurationCompact(totalSeconds, units, locale);
}

/** Format seconds as decimal hours string, e.g. "2.50 hrs" */
export function formatHoursDecimal(
  totalSeconds: number | null,
  hoursLabel = "hrs",
  locale?: string
): string {
  if (totalSeconds === null || Number.isNaN(totalSeconds)) return `0.00 ${hoursLabel}`;
  const hours = (Math.max(0, totalSeconds) / 3600).toFixed(2);
  return `${localizeDigits(hours, locale)} ${hoursLabel}`;
}

/** ISO -> "3:04 PM". */
export function formatTime(iso: string, locale?: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/** ISO -> "Sep 9, 2026". */
export function formatDate(iso: string, locale?: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

/** ISO -> "Sep 9, 2026, 3:04 PM". */
export function formatDateTime(iso: string, locale?: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/** ISO or Date -> Short Day Name (e.g. "Mon"). */
export function formatDayName(dateOrIso: string | Date, locale?: string): string {
  const date = typeof dateOrIso === "string" ? new Date(dateOrIso) : dateOrIso;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    weekday: "short",
  }).format(date);
}

/** Export time entries to a CSV file. */
export function exportTimesheetsToCsv(
  rows: {
    userName?: string;
    departmentName?: string | null;
    clockedInAt: string;
    clockedOutAt: string | null;
    durationSeconds: number | null;
    status: string;
    notes?: string | null;
  }[],
  filename = "timesheets.csv"
) {
  const headers = ["Employee", "Department", "Clock In", "Clock Out", "Duration (Hours)", "Status", "Notes"];
  const csvContent = [
    headers.join(","),
    ...rows.map((r) => {
      const hours = r.durationSeconds ? (r.durationSeconds / 3600).toFixed(2) : "0.00";
      const notesClean = (r.notes || "").replace(/"/g, '""');
      return [
        `"${(r.userName || "").replace(/"/g, '""')}"`,
        `"${(r.departmentName || "").replace(/"/g, '""')}"`,
        `"${r.clockedInAt}"`,
        `"${r.clockedOutAt || ""}"`,
        `"${hours}"`,
        `"${r.status}"`,
        `"${notesClean}"`,
      ].join(",");
    }),
  ].join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}


