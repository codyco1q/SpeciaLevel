"use client";

import { useEffect, useState } from "react";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  CalendarDays,
  Clock,
  Link as LinkIcon,
  Check,
  ExternalLink,
  Search,
  Filter,
  Users,
  Building2,
  CalendarCheck,
  CheckCircle2,
  XCircle,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  getCalendarEvents,
  type CalendarEventRow,
} from "@/lib/actions/calendar";
import type {
  AppointmentRow,
  BookingProfileRow,
} from "@/lib/validations/calendar";
import type { EmployeeOption } from "./event-dialog";
import { EventDialog } from "./event-dialog";
import { EventDetailDialog } from "./event-detail-dialog";
import { AvailabilityDialog } from "./availability-dialog";
import { AppointmentDetailDialog } from "./appointment-detail-dialog";
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
import Link from "next/link";

const VIEW_OPTIONS: { key: CalendarViewMode; label: string }[] = [
  { key: "month", label: "Month" },
  { key: "week", label: "Week" },
  { key: "day", label: "Day" },
];

interface CalendarViewProps {
  initialEvents: CalendarEventRow[];
  initialAppointments?: AppointmentRow[];
  initialBookingProfile?: BookingProfileRow | null;
  employees: EmployeeOption[];
  permissions: string[];
  todayIso: string;
  dictionary?: Record<string, any>;
}

function slotDatetimeLocal(date: Date, hour: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const d = new Date(date);
  d.setHours(hour, 0, 0, 0);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function addHourLocal(dtLocal: string): string {
  const d = new Date(dtLocal);
  d.setHours(d.getHours() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localMidnight(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function formatAppointmentDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatAppointmentTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function CalendarView({
  initialEvents,
  initialAppointments = [],
  initialBookingProfile = null,
  employees,
  permissions,
  todayIso,
  dictionary,
}: CalendarViewProps) {
  const canCreate = permissions.includes("calendar.create");
  const canEdit = permissions.includes("calendar.edit");
  const canDelete = permissions.includes("calendar.delete");
  const canManage = permissions.includes("calendar.manage");

  const t = dictionary?.platform?.calendar ?? {
    title: "Team Calendar & Scheduler",
    subtitle: "Coordinate team events and let clients book appointments automatically.",
    tabEvents: "Team Events",
    tabAppointments: "Client Appointments",
    bookingLink: "Booking Link",
    copyBookingLink: "Copy Booking Link",
    copied: "Copied!",
    availabilitySettings: "Availability Settings",
    noAppointments: "No appointments booked yet.",
    noAppointmentsHint: "Appointments will appear here when clients book through your booking link.",
    newEvent: "New Event",
    statusConfirmed: "Confirmed",
    statusCancelled: "Cancelled",
    statusCompleted: "Completed",
    client: "Client",
    host: "Host",
    duration: "Duration",
    dateTime: "Date & Time",
  };

  const [activeTab, setActiveTab] = useState<"calendar" | "appointments">("calendar");
  const [bookingProfile, setBookingProfile] = useState<BookingProfileRow | null>(
    initialBookingProfile ?? null
  );
  const [appointments, setAppointments] = useState<AppointmentRow[]>(initialAppointments);
  const [appointmentSearch, setAppointmentSearch] = useState("");
  const [appointmentStatusFilter, setAppointmentStatusFilter] = useState<string>("all");
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentRow | null>(null);
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const serverToday = new Date(todayIso);
  const [anchor, setAnchor] = useState<Date>(() => localMidnight(serverToday));
  const [view, setView] = useState<CalendarViewMode>("month");
  const [events, setEvents] = useState<CalendarEventRow[]>(initialEvents);
  const [fetching, setFetching] = useState(false);

  // Dialog states
  const [createOpen, setCreateOpen] = useState(false);
  const [createDefaults, setCreateDefaults] = useState<{
    start?: string;
    end?: string;
  }>({});
  const [editingEvent, setEditingEvent] = useState<CalendarEventRow | null>(null);
  const [detailEvent, setDetailEvent] = useState<CalendarEventRow | null>(null);

  const refreshEvents = async () => {
    const { startIso, endIso } = getViewWindow(view, anchor);
    setFetching(true);
    try {
      const rows = await getCalendarEvents(startIso, endIso);
      if (rows) {
        setEvents(rows);
      }
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    refreshEvents();
  }, [view, anchor]);

  const navigatePrev = () => {
    setAnchor((prev) => {
      if (view === "month") return addMonths(prev, -1);
      if (view === "week") return addDays(prev, -7);
      return addDays(prev, -1);
    });
  };

  const navigateNext = () => {
    setAnchor((prev) => {
      if (view === "month") return addMonths(prev, 1);
      if (view === "week") return addDays(prev, 7);
      return addDays(prev, 1);
    });
  };

  const goToday = () => {
    setAnchor(localMidnight(new Date()));
  };

  const handleCreateAt = (day: Date, hour: number) => {
    if (!canCreate) return;
    const start = slotDatetimeLocal(day, hour);
    const end = addHourLocal(start);
    setCreateDefaults({ start, end });
    setEditingEvent(null);
    setCreateOpen(true);
  };

  const handleNewEventButton = () => {
    const now = new Date();
    const nextHour = now.getHours() + 1;
    const start = slotDatetimeLocal(anchor, nextHour >= 24 ? 9 : nextHour);
    const end = addHourLocal(start);
    setCreateDefaults({ start, end });
    setEditingEvent(null);
    setCreateOpen(true);
  };

  const handleEditRequest = (event: CalendarEventRow) => {
    setDetailEvent(null);
    setEditingEvent(event);
  };

  const handleCopyBookingLink = () => {
    if (!bookingProfile?.slug) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/book/${bookingProfile.slug}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleAppointmentCancelled = (appointmentId: string) => {
    setAppointments((prev) =>
      prev.map((a) => (a.id === appointmentId ? { ...a, status: "cancelled" } : a))
    );
    refreshEvents();
  };

  const filteredAppointments = appointments.filter((appt) => {
    const matchesSearch =
      appointmentSearch === "" ||
      appt.clientName.toLowerCase().includes(appointmentSearch.toLowerCase()) ||
      appt.clientEmail.toLowerCase().includes(appointmentSearch.toLowerCase()) ||
      (appt.clientPhone && appt.clientPhone.includes(appointmentSearch));
    const matchesStatus =
      appointmentStatusFilter === "all" || appt.status === appointmentStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const confirmedCount = appointments.filter((a) => a.status === "confirmed").length;
  const bookingUrl =
    bookingProfile?.slug && typeof window !== "undefined"
      ? `${window.location.origin}/book/${bookingProfile.slug}`
      : bookingProfile?.slug
      ? `/book/${bookingProfile.slug}`
      : null;


  return (
    <div className="space-y-6">
      {/* ── Top Header Toolbar ────────────────────────────────────── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{t.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {bookingProfile?.slug && (
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card p-1 text-xs shadow-2xs">
              <div className="flex items-center gap-1.5 px-2 py-1 text-muted-foreground font-mono truncate max-w-[200px] sm:max-w-[260px]">
                <LinkIcon className="size-3 text-primary shrink-0" />
                <span className="truncate">/book/{bookingProfile.slug}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyBookingLink}
                className="h-7 px-2 text-xs"
              >
                {copiedLink ? (
                  <>
                    <Check className="size-3.5 mr-1 text-emerald-500" />
                    {t.copied}
                  </>
                ) : (
                  t.copyBookingLink
                )}
              </Button>
              {bookingUrl && (
                <Link
                  href={bookingUrl}
                  target="_blank"
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="Open public booking page"
                >
                  <ExternalLink className="size-3.5" />
                </Link>
              )}
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setAvailabilityOpen(true)}
            className="h-9 text-xs font-medium"
          >
            <SlidersHorizontal className="size-3.5 mr-1.5 text-primary" />
            {t.availabilitySettings}
          </Button>

          {canCreate && (
            <Button
              size="sm"
              onClick={handleNewEventButton}
              className="h-9 text-xs font-medium"
            >
              <CalendarPlus className="size-3.5 mr-1.5" />
              {t.newEvent}
            </Button>
          )}
        </div>
      </div>

      {/* ── View Mode Tabs ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("calendar")}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              activeTab === "calendar"
                ? "bg-primary text-primary-foreground shadow-2xs"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <CalendarDays className="size-4" />
            {t.tabEvents}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("appointments")}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              activeTab === "appointments"
                ? "bg-primary text-primary-foreground shadow-2xs"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <CalendarCheck className="size-4" />
            {t.tabAppointments}
            {confirmedCount > 0 && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                  activeTab === "appointments"
                    ? "bg-primary-foreground text-primary"
                    : "bg-primary/10 text-primary"
                )}
              >
                {confirmedCount}
              </span>
            )}
          </button>
        </div>

        {activeTab === "calendar" && (
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-md border border-border bg-card p-0.5">
              {VIEW_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setView(option.key)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium rounded-sm transition-colors",
                    view === option.key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={navigatePrev} className="size-7">
                <ChevronLeft className="size-3.5" />
              </Button>
              <Button variant="outline" size="icon" onClick={navigateNext} className="size-7">
                <ChevronRight className="size-3.5" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToday} className="h-7 text-xs px-2.5">
                Today
              </Button>
            </div>
          </div>
        )}
      </div>


      {/* ── Tab Content: Appointments ──────────────────────────────── */}
      {activeTab === "appointments" ? (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                value={appointmentSearch}
                onChange={(e) => setAppointmentSearch(e.target.value)}
                placeholder="Search by client name, email, phone..."
                className="pl-9 h-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Filter className="size-3.5 text-muted-foreground" />
              <select
                value={appointmentStatusFilter}
                onChange={(e) => setAppointmentStatusFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus:outline-hidden focus:ring-1 focus:ring-ring"
              >
                <option value="all">All Statuses ({appointments.length})</option>
                <option value="confirmed">Confirmed ({confirmedCount})</option>
                <option value="cancelled">Cancelled</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          {filteredAppointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 px-4 text-center bg-card/40">
              <CalendarCheck className="size-10 text-muted-foreground/50 mb-3" />
              <h3 className="text-base font-semibold">{t.noAppointments}</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                {t.noAppointmentsHint}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden shadow-2xs">
              {filteredAppointments.map((appt) => {
                const durationMin = Math.round(
                  (new Date(appt.endTime).getTime() - new Date(appt.startTime).getTime()) / 60000
                );
                return (
                  <div
                    key={appt.id}
                    onClick={() => setSelectedAppointment(appt)}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-muted/30 transition-colors cursor-pointer"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground hover:text-primary transition-colors">
                          {appt.clientName}
                        </span>
                        {appt.status === "confirmed" ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-200 text-[10px] px-1.5 py-0">
                            <CheckCircle2 className="size-2.5 mr-1" />
                            {t.statusConfirmed}
                          </Badge>
                        ) : appt.status === "cancelled" ? (
                          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[10px] px-1.5 py-0">
                            <XCircle className="size-2.5 mr-1" />
                            {t.statusCancelled}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-muted text-muted-foreground text-[10px] px-1.5 py-0">
                            {t.statusCompleted}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{appt.clientEmail}</span>
                        {appt.clientPhone && <span>· {appt.clientPhone}</span>}
                        {appt.host && (
                          <span className="text-foreground/80">· Host: {appt.host.fullName || appt.host.email}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs shrink-0">
                      <div className="text-right sm:space-y-0.5">
                        <div className="font-semibold text-foreground">
                          {formatAppointmentDate(appt.startTime)}
                        </div>
                        <div className="text-muted-foreground flex items-center justify-end gap-1">
                          <Clock className="size-3" />
                          {formatAppointmentTime(appt.startTime)} ({durationMin} min)
                        </div>
                      </div>

                      {appt.deal && (
                        <div className="hidden md:flex items-center gap-1 text-[11px] bg-primary/10 text-primary px-2 py-1 rounded-md font-medium max-w-[150px] truncate">
                          <Building2 className="size-3 shrink-0" />
                          <span className="truncate">{appt.deal.title}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ── Tab Content: Calendar Events ─────────────────────────── */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight">
              {formatWindowLabel(view, anchor)}
            </h2>
            {fetching && (
              <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
            )}
          </div>

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
        </div>
      )}

      {/* ── Dialogs ─────────────────────────────────────────────────── */}
      <AvailabilityDialog
        open={availabilityOpen}
        onOpenChange={setAvailabilityOpen}
        bookingProfile={bookingProfile}
        onSaved={(updated) => setBookingProfile(updated)}
        dictionary={dictionary}
      />

      <AppointmentDetailDialog
        appointment={selectedAppointment}
        open={selectedAppointment !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedAppointment(null);
        }}
        onAppointmentCancelled={handleAppointmentCancelled}
        canManage={canManage}
        dictionary={dictionary}
      />

      <EventDetailDialog
        open={detailEvent !== null}
        onOpenChange={(open) => {
          if (!open) setDetailEvent(null);
        }}
        event={detailEvent}
        canEdit={canEdit}
        canDelete={canDelete}
        onEditRequest={handleEditRequest}
        onDeleted={refreshEvents}
      />

      <EventDialog
        open={createOpen || editingEvent !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setEditingEvent(null);
          }
        }}
        event={editingEvent}
        employees={employees}
        defaultStart={createDefaults.start ?? ""}
        defaultEnd={createDefaults.end ?? ""}
        onSaved={() => {
          refreshEvents();
          setCreateOpen(false);
          setEditingEvent(null);
        }}
      />
    </div>
  );
}

