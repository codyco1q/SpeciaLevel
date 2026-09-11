/**
 * Pure calendar date math for the month/week/day views.
 *
 * All helpers operate on LOCAL time with plain `Date` objects — the UI
 * renders in the user's timezone while the DB stores UTC ISO strings.
 * No hooks, no browser-only APIs — safe in both client and server code.
 */

import type { CalendarEventRow } from "@/lib/actions/calendar";

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const WEEKDAY_LABELS_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
export const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export type CalendarViewMode = "month" | "week" | "day";

/** Returns a Date at local midnight for the given date. */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Returns a Date at local 23:59:59.999 for the given date. */
export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Adds `days` (can be negative) to a copy of the date. */
export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Adds `months` (can be negative) to a copy of the date. */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/** First day of the month containing `date`, at local midnight. */
export function startOfMonth(date: Date): Date {
  const d = startOfDay(date);
  d.setDate(1);
  return d;
}

/** Returns true when two dates fall on the same local calendar day. */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isSameMonth(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
  );
}

/**
 * Visible cell dates for a month grid: Monday-start weeks that fully cover
 * the given month (leading + trailing days from adjacent months).
 */
export function getMonthGridDays(monthDate: Date): Date[] {
  const first = startOfMonth(monthDate);
  // Monday-based week start.
  const leadOffset = (first.getDay() + 6) % 7;
  const gridStart = addDays(first, -leadOffset);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    days.push(addDays(gridStart, i));
  }
  return days;
}

/** Monday-based weekday labels. */
export const WEEKDAY_LABELS_MONDAY = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
];

/** Monday-based week start for a date. */
export function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  const offset = (d.getDay() + 6) % 7; // Monday = 0
  return addDays(d, -offset);
}

/** Monday-based week end (Sunday). */
export function endOfWeek(date: Date): Date {
  return addDays(startOfWeek(date), 6);
}

export function formatMonthYear(date: Date): string {
  return `${MONTH_LABELS[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatDayLabel(date: Date): string {
  return `${WEEKDAY_LABELS_LONG[date.getDay()]}, ${
    MONTH_LABELS[date.getMonth()]
  } ${date.getDate()}`;
}

export function formatShortDate(date: Date): string {
  return `${MONTH_LABELS[date.getMonth()].slice(0, 3)} ${date.getDate()}, ${date.getFullYear()}`;
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** ISO string -> Date (invalid input returns null). */
export function parseIso(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toIso(dateOrIso: Date | string): string {
  return typeof dateOrIso === "string" ? dateOrIso : dateOrIso.toISOString();
}

/**
 * Returns the events that overlap the given local day (inclusive).
 * Events that span multiple days appear on each day they touch.
 */
export function eventsForDay(
  events: CalendarEventRow[],
  day: Date
): CalendarEventRow[] {
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);
  const dayStartMs = dayStart.getTime();
  const dayEndMs = dayEnd.getTime();
  return events.filter((event) => {
    const start = parseIso(event.startsAt);
    const end = parseIso(event.endsAt);
    if (!start || !end) return false;
    return start.getTime() <= dayEndMs && end.getTime() >= dayStartMs;
  });
}

/** Events grouped by local day for a list of days. */
export function groupEventsByDay(
  events: CalendarEventRow[],
  days: Date[]
): Map<string, CalendarEventRow[]> {
  const map = new Map<string, CalendarEventRow[]>();
  for (const day of days) {
    map.set(day.toDateString(), eventsForDay(events, day));
  }
  return map;
}

/**
 * Visible hourly window for the week/day time grids.
 * Renders 6 AM — 9 PM by default (15 hours), configurable.
 */
export const VIEW_START_HOUR = 6;
export const VIEW_END_HOUR = 21; // exclusive end
export const HOUR_HEIGHT_PX = 48;
export const TOTAL_HOURS_PX = (VIEW_END_HOUR - VIEW_START_HOUR) * HOUR_HEIGHT_PX;

export const HOURS = Array.from(
  { length: VIEW_END_HOUR - VIEW_START_HOUR },
  (_, i) => VIEW_START_HOUR + i
);

/** Minutes-from-midnight for an ISO timestamp. */
function minutesOfDay(iso: string): number {
  const d = parseIso(iso);
  return d ? d.getHours() * 60 + d.getMinutes() : 0;
}

/**
 * Pixel offset + height for a timed event inside the hour grid.
 * Clamps multi-hour / out-of-window events so they render fully.
 */
export function eventBlockPosition(event: CalendarEventRow): {
  top: number;
  height: number;
} {
  const startMin = Math.max(
    minutesOfDay(event.startsAt),
    VIEW_START_HOUR * 60
  );
  const endMin = Math.min(
    minutesOfDay(event.endsAt),
    VIEW_END_HOUR * 60
  );
  const start = Math.min(startMin, VIEW_END_HOUR * 60);
  const end = Math.max(endMin, VIEW_START_HOUR * 60);
  const top = ((start - VIEW_START_HOUR * 60) / 60) * HOUR_HEIGHT_PX;
  const height =
    ((Math.max(end, start + 1) - start) / 60) * HOUR_HEIGHT_PX;
  return {
    top: Math.max(0, top),
    height: Math.max(HOUR_HEIGHT_PX / 2, height),
  };
}

/** "09:30 AM" label for a 24h hour index in the time grid column. */
export function formatHourLabel(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:00 ${period}`;
}

/** Friendly window label for the view header (e.g. "Jun 2026", "Jun 8 – 14"). */
export function formatWindowLabel(view: CalendarViewMode, anchor: Date): string {
  if (view === "month") return formatMonthYear(anchor);
  if (view === "day") return formatDayLabel(anchor);
  const start = startOfWeek(anchor);
  const end = endOfWeek(anchor);
  return `${MONTH_LABELS[start.getMonth()].slice(0, 3)} ${start.getDate()} – ${
    MONTH_LABELS[end.getMonth()].slice(0, 3)
  } ${end.getDate()}`;
}

/**
 * The [start, end) window used to query events for a view.
 * Slightly padded so grids pick up multi-day boundary events.
 */
export function getViewWindow(view: CalendarViewMode, anchor: Date): {
  startIso: string;
  endIso: string;
} {
  const start =
    view === "month"
      ? addDays(startOfMonth(anchor), -7)
      : view === "week"
        ? addDays(startOfWeek(anchor), -1)
        : addDays(startOfDay(anchor), -1);
  const end =
    view === "month"
      ? addDays(startOfMonth(addMonths(anchor, 1)), 7)
      : view === "week"
        ? addDays(endOfWeek(anchor), 1)
        : addDays(endOfDay(anchor), 1);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}