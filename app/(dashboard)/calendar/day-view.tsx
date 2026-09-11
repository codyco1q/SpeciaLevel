"use client";

import type { CalendarEventRow } from "@/lib/actions/calendar";
import {
  HOUR_HEIGHT_PX,
  HOURS,
  TOTAL_HOURS_PX,
  eventBlockPosition,
  eventsForDay,
  formatHourLabel,
  formatShortDate,
  formatTime,
} from "./calendar-utils";

interface DayViewProps {
  anchor: Date;
  events: CalendarEventRow[];
  onEventClick: (event: CalendarEventRow) => void;
  /** Empty-time-slot click: prefill a new event near `hour`. */
  onCreateAt: (day: Date, hour: number) => void;
}

/**
 * Single-day hourly agenda. One wide column with detailed event blocks
 * positioned against the same hourly grid used by the week view.
 */
export function DayView({
  anchor,
  events,
  onEventClick,
  onCreateAt,
}: DayViewProps) {
  const dayEvents = eventsForDay(events, anchor);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const hour = Math.floor(y / HOUR_HEIGHT_PX) + 6;
    onCreateAt(anchor, Math.max(6, Math.min(20, hour)));
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">{formatShortDate(anchor)}</h2>
        <p className="text-xs text-muted-foreground">
          {dayEvents.length} event{dayEvents.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="relative">
        {/* Hour rows */}
        <div className="pointer-events-none" style={{ height: TOTAL_HOURS_PX }}>
          {HOURS.map((hour) => (
            <div key={hour} className="flex" style={{ height: HOUR_HEIGHT_PX }}>
              <div className="w-14 shrink-0 pr-2 text-right text-xs text-muted-foreground tabular-nums">
                {formatHourLabel(hour)}
              </div>
              <div className="flex-1 border-b border-border/60" />
            </div>
          ))}
        </div>

        {/* Event column */}
        <div
          className="absolute inset-y-0 left-14 right-0 border-l border-border/60"
          style={{ height: TOTAL_HOURS_PX }}
          onClick={handleClick}
        >
          {dayEvents.map((event) => {
            const { top, height } = eventBlockPosition(event);
            return (
              <button
                key={event.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEventClick(event);
                }}
                className="absolute inset-x-2 rounded-md border-l-4 border-primary bg-primary/10 px-3 py-1.5 text-left shadow-sm transition-colors hover:bg-primary/20"
                style={{ top, height }}
              >
                <p className="truncate text-sm font-semibold">{event.title}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {formatTime(event.startsAt)} – {formatTime(event.endsAt)}
                </p>
                {event.location && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {event.location}
                  </p>
                )}
                <p className="truncate text-xs text-muted-foreground">
                  {event.assignedTo
                    ? `Assigned to ${event.assignedTo.fullName ?? "Unnamed"}`
                    : "Unassigned"}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}