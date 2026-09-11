"use client";

import type { CalendarEventRow } from "@/lib/actions/calendar";
import { cn } from "@/lib/utils";
import {
  WEEKDAY_LABELS_MONDAY,
  eventsForDay,
  getMonthGridDays,
  isSameDay,
  isSameMonth,
  formatTime,
} from "./calendar-utils";

interface MonthViewProps {
  anchor: Date;
  today: Date;
  events: CalendarEventRow[];
  onEventClick: (event: CalendarEventRow) => void;
  onDayClick: (day: Date) => void;
}

const MAX_CHIPS = 3;

/**
 * Standard 7-column month grid. Each day cell shows the date number and up
 * to three clickable event chips (with a "+N more" overflow indicator).
 */
export function MonthView({
  anchor,
  today,
  events,
  onEventClick,
  onDayClick,
}: MonthViewProps) {
  const days = getMonthGridDays(anchor);

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAY_LABELS_MONDAY.map((label) => (
          <div
            key={label}
            className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const inMonth = isSameMonth(day, anchor);
          const isToday = isSameDay(day, today);
          const dayEvents = eventsForDay(events, day);
          const visible = dayEvents.slice(0, MAX_CHIPS);
          const hiddenCount = dayEvents.length - visible.length;

          return (
            <div
              key={day.toDateString()}
              onClick={() => onDayClick(day)}
              className={cn(
                "min-h-24 cursor-pointer border-b border-r border-border/60 p-1.5 transition-colors",
                "hover:bg-muted/50",
                !inMonth && "bg-muted/30 text-muted-foreground",
                // Right column of the 7-col grid: no right border.
                day.getDay() === 0 && "border-r-0"
              )}
            >
              <div className="flex justify-end">
                <span
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-sm",
                    isToday
                      ? "bg-primary font-semibold text-primary-foreground"
                      : "font-medium"
                  )}
                >
                  {day.getDate()}
                </span>
              </div>

              <div className="mt-1 space-y-1">
                {visible.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(event);
                    }}
                    className="block w-full truncate rounded border-l-2 border-primary bg-primary/10 px-1.5 py-0.5 text-left text-xs font-medium text-foreground transition-colors hover:bg-primary/20"
                  >
                    <span className="mr-1 font-normal text-muted-foreground tabular-nums">
                      {formatTime(event.startsAt)}
                    </span>
                    {event.title}
                  </button>
                ))}
                {hiddenCount > 0 && (
                  <p className="px-1.5 text-xs font-medium text-muted-foreground">
                    +{hiddenCount} more
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}