"use client";

import type { CalendarEventRow } from "@/lib/actions/calendar";
import { cn } from "@/lib/utils";
import {
  HOUR_HEIGHT_PX,
  HOURS,
  TOTAL_HOURS_PX,
  WEEKDAY_LABELS_MONDAY,
  addDays,
  eventBlockPosition,
  eventsForDay,
  formatHourLabel,
  isSameDay,
  startOfWeek,
} from "./calendar-utils";

interface WeekViewProps {
  anchor: Date;
  today: Date;
  events: CalendarEventRow[];
  onEventClick: (event: CalendarEventRow) => void;
  /** Empty-time-slot click: create an event on `day` starting near `hour`. */
  onCreateAt: (day: Date, hour: number) => void;
}

/**
 * 7-day (Monday–Sunday) time-grid layout. Events are absolutely-positioned
 * blocks sized/offset by their start/end times against a fixed hourly grid.
 */
export function WeekView({
  anchor,
  today,
  events,
  onEventClick,
  onCreateAt,
}: WeekViewProps) {
  const weekStart = startOfWeek(anchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Normalize column clicks so they land on the day the mouse is over.
  function handleColumnClick(day: Date) {
    return (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const hour = Math.floor(y / HOUR_HEIGHT_PX) + 6;
      onCreateAt(day, Math.max(6, Math.min(20, hour)));
    };
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Day header */}
      <div className="flex border-b border-border">
        <div className="w-14 shrink-0" />
        <div className="grid flex-1 grid-cols-7">
          {days.map((day, i) => {
            const isToday = isSameDay(day, today);
            return (
              <div
                key={day.toDateString()}
                className="border-l border-border/60 px-2 py-2 text-center"
              >
                <p className="text-xs font-semibold text-muted-foreground">
                  {WEEKDAY_LABELS_MONDAY[i]}
                </p>
                <p
                  className={cn(
                    "mx-auto inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold",
                    isToday
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground"
                  )}
                >
                  {day.getDate()}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Time grid */}
      <div className="relative">
        {/* Hour rows: gutter + gridline */}
        <div
          className="pointer-events-none"
          style={{ height: TOTAL_HOURS_PX }}
        >
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="flex"
              style={{ height: HOUR_HEIGHT_PX }}
            >
              <div className="w-14 shrink-0 pr-2 text-right text-xs text-muted-foreground tabular-nums">
                {formatHourLabel(hour)}
              </div>
              <div className="flex-1 border-b border-border/60" />
            </div>
          ))}
        </div>

        {/* 7 absolutely-positioned day columns with event blocks */}
        <div
          className="absolute inset-y-0 left-14 right-0 grid grid-cols-7"
          style={{ height: TOTAL_HOURS_PX }}
        >
          {days.map((day) => {
            const dayEvents = eventsForDay(events, day);
            return (
              <div
                key={day.toDateString()}
                className="relative border-l border-border/60"
                onClick={handleColumnClick(day)}
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
                      className="absolute inset-x-1 overflow-hidden rounded border-l-2 border-primary bg-primary/10 px-1.5 py-0.5 text-left text-xs font-medium text-foreground transition-colors hover:bg-primary/20"
                      style={{ top, height }}
                    >
                      <span className="block truncate">{event.title}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {event.assignedTo?.fullName ?? "Unassigned"}
                      </span>
                    </button>
                  );
                })}

                {/* "Today" marker line */}
                {isSameDay(day, today) && (
                  <div className="pointer-events-none absolute inset-x-0 top-1 z-10 flex items-center gap-1 px-1">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                    <span className="text-[10px] font-medium text-primary">
                      Today
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}