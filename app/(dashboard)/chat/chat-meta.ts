/**
 * Shared display helpers for the Chat module. Client-safe.
 */

/** "2:41 PM" for today, "Sep 12, 2:41 PM" otherwise (year added when not the current one). */
export function formatMessageTime(iso: string, locale = "en-US"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const intlLocale = locale.startsWith("ar") ? "ar-EG" : locale;

  if (sameDay) {
    return new Intl.DateTimeFormat(intlLocale, {
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }

  const sameYear = date.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat(intlLocale, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/** Full timestamp for the message `title` tooltip. */
export function formatMessageDateTitle(iso: string, locale = "en-US"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(
    locale.startsWith("ar") ? "ar-EG" : locale,
    {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    }
  ).format(date);
}

/** Up to two initials from a display name ("Ada Lovelace" → "AL"). */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || parts[0] === "") return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (
    parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
  ).toUpperCase();
}