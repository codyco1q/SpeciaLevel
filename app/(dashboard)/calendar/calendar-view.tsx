"use client";

import { useEffect, useState } from "react";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getCalendarEvents,
  type CalendarEventRow,
} from "@/lib/actions/calendar";
import type { EmployeeOption } from "./event-dialog";
import { EventDialog } from "./event-dialog";
import { EventDetailDialog } from "./event-detail-dialog";
import { MonthView } from "./month-view";
import { WeekView } from "./week-view";
import { DayView } from "./day-view";
import {
  type CalendarViewMode,
  addDays,
  addMonths,
  formatWindowLabel,
  getViewWindow,
} from "./calendar-utils";

const VIEW_OPTIONS: { key: CalendarViewMode; label: string }[] = [
  { key: "month", label: "Month" },
  { key: "week", label: "Week" },
  { key: "day", label: "Day" },
];

interface CalendarViewProps {
  initialEvents: CalendarEventRow[];
  employees: EmployeeOption[];
  permissions: string[];
  /** ISO string of today (server-rendered), used for highlighting. */
  todayIso: string;
}

/** "YYYY-MM-DDTHH:00" datetime-local helper. */
function slotDatetimeLocal(date: Date, hour: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const d = new Date(date);
  d.setHours(hour, 0, 0, 0);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Add 1 hour to a datetime-local string. */
function addHourLocal(dtLocal: string): string {
  const d = new Date(dtLocal);
  d.setHours(d.getHours() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Normalize to local midnight. */
function localMidnight(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

/**
 * Main interactive calendar shell: header with view switcher + navigation,
 * three-way conditional view render, and create/edit/detail dialogs.
 */
export function CalendarView({
  initialEvents,
  employees,
  permissions,
  todayIso,
}: CalendarViewProps) {
  const canCreate = permissions.includes("calendar.create");
  const canEdit = permissions.includes("calendar.edit");
  const canDelete = permissions.includes("calendar.delete");

  const serverToday = localMidnight(new Date(todayIso));
  const [view, setView] = useState<CalendarViewMode>("month");
  const [anchor, setAnchor] = useState(serverToday);
  const [events, setEvents] = useState<CalendarEventRow[]>(initialEvents);
  const [fetching, setFetching] = useState(false);

  // Refetch events whenever the visible window changes.
  const { startIso, endIso } = getViewWindow(view, anchor);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setFetching(true);
      try {
        const rows = await getCalendarEvents(startIso, endIso);
        if (!cancelled) setEvents(rows ?? []);
      } finally {
        if (!cancelled) setFetching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [startIso, endIso]);

  /** Force-refresh events for the current window. */
  async function refreshEvents() {
    const rows = await getCalendarEvents(startIso, endIso);
    if (rows) setEvents(rows);
  }

  // ── Navigation ────────────────────────────────────────────────
  function navigatePrev() {
    setAnchor((a) =>
      view === "month"
        ? addMonths(a, -1)
        : view === "week"
          ? addDays(a, -7)
          : addDays(a, -1)
    );
  }

  function navigateNext() {
    setAnchor((a) =>
      view === "month"
        ? addMonths(a, 1)
        : view === "week"
          ? addDays(a, 7)
          : addDays(a, 1)
    );
  }

  function goToday() {
    setAnchor(localMidnight(new Date()));
  }

  // ── Dialog state ──────────────────────────────────────────────
  const [detailEvent, setDetailEvent] = useState<CalendarEventRow | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEventRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDefaults, setCreateDefaults] = useState({
    start: slotDatetimeLocal(serverToday, 9),
    end: addHourLocal(slotDatetimeLocal(serverToday, 9)),
  });

  function handleCreateAt(day: Date, hour: number) {
    if (!canCreate) return;
    const s = slotDatetimeLocal(day, hour);
    setCreateDefaults({ start: s, end: addHourLocal(s) });
    setCreateOpen(true);
  }

  function handleNewEventButton() {
    if (!canCreate) return;
    const s = slotDatetimeLocal(anchor, 9);
    setCreateDefaults({ start: s, end: addHourLocal(s) });
    setCreateOpen(true);
  }

  function handleEditRequest(event: CalendarEventRow) {
    setDetailEvent(null);
    setEditingEvent(event);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">
            {formatWindowLabel(view, anchor)}
          </h1>
          {fetching && (
            <LoaderCircle className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View switcher */}
          <div className="inline-flex rounded-md border border-border bg-card">
            {VIEW_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setView(option.key)}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium transition-colors",
                  view === option.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Navigation */}
          <Button variant="outline" size="icon" onClick={navigatePrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={navigateNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToday}>
            Today
          </Button>

          {canCreate && (
            <Button size="sm" onClick={handleNewEventButton}>
              <CalendarPlus className="h-4 w-4" />
              New Event
            </Button>
          )}
        </div>
      </div>

      {/* ── View renderers ──────────────────────────────────────── */}
      {view === "month" && (
        <MonthView
          anchor={anchor}
          today={serverToday}
          events={events}
          onEventClick={setDetailEvent}
          onDayClick={(day) => handleCreateAt(day, 9)}
        />
      )}

      {view === "week" && (
        <WeekView
          anchor={anchor}
          today={serverToday}
          events={events}
          onEventClick={setDetailEvent}
          onCreateAt={handleCreateAt}
        />
      )}

      {view === "day" && (
        <DayView
          anchor={anchor}
          events={events}
          onEventClick={setDetailEvent}
          onCreateAt={handleCreateAt}
        />
      )}

      {/* ── Dialogs ─────────────────────────────────────────────── */}
      <EventDetailDialog
        open={detailEvent !== null}
        onOpenChange={(open) => { if (!open) setDetailEvent(null); }}
        event={detailEvent}
        canEdit={canEdit}
        canDelete={canDelete}
        onEditRequest={handleEditRequest}
        onDeleted={refreshEvents}
      />

      <EventDialog
        open={createOpen || editingEvent !== null}
        onOpenChange={(open) => {
          if (!open) { setCreateOpen(false); setEditingEvent(null); }
        }}
        event={editingEvent}
        employees={employees}
        defaultStart={createDefaults.start}
        defaultEnd={createDefaults.end}
        onSaved={() => { refreshEvents(); setCreateOpen(false); setEditingEvent(null); }}
      />
    </div>
  );
}