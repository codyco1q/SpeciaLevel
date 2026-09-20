"use client";

import { useState, useEffect } from "react";
import {
  Calendar as CalendarIcon,
  Clock,
  Video,
  User,
  Mail,
  Phone,
  FileText,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  CalendarCheck,
  Download,
  ExternalLink,
  LoaderCircle,
  Sparkles,
  ArrowLeft,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  getPublicBookingSlots,
  bookPublicAppointment,
  type TimeSlotOption,
} from "@/lib/actions/calendar";
import type {
  PublicBookingProfile,
  DayOfWeek,
} from "@/lib/validations/calendar";

interface PublicBookingViewProps {
  profile: PublicBookingProfile;
  dictionary?: Record<string, any>;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
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

const DAYS_MAP: DayOfWeek[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function downloadIcs(data: {
  title: string;
  description: string;
  startIso: string;
  endIso: string;
  hostName: string;
  hostEmail: string;
}) {
  const formatDate = (iso: string) =>
    new Date(iso).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SpeciaLevel//Appointment Scheduler//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `DTSTART:${formatDate(data.startIso)}`,
    `DTEND:${formatDate(data.endIso)}`,
    `SUMMARY:${data.title}`,
    `DESCRIPTION:${data.description.replace(/\n/g, "\\n")}`,
    "LOCATION:Online Video Call",
    `ORGANIZER;CN=${data.hostName}:mailto:${data.hostEmail}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `appointment-${Date.now()}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function getGoogleCalendarUrl(data: {
  title: string;
  description: string;
  startIso: string;
  endIso: string;
}) {
  const formatDate = (iso: string) =>
    new Date(iso).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const start = formatDate(data.startIso);
  const end = formatDate(data.endIso);
  const details = encodeURIComponent(data.description);
  const text = encodeURIComponent(data.title);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${start}/${end}&details=${details}&location=Online+Video+Call`;
}


export function PublicBookingView({
  profile,
  dictionary,
}: PublicBookingViewProps) {
  const t = dictionary?.platform?.calendar?.public ?? {
    poweredBy: "Powered by",
    min: "min",
    videoCall: "Online Video Call",
    selectDateAndTime: "Select Date & Time",
    availableTimes: "Available times for",
    noTimesAvailable: "No available times on this date.",
    yourInfo: "Enter Details",
    fullName: "Your Name",
    email: "Email Address",
    phone: "Phone Number (Optional)",
    notes: "Additional Notes",
    notesPlaceholder: "Please share anything that will help us prepare for our meeting...",
    confirmBooking: "Confirm Booking",
    booking: "Scheduling...",
    confirmedTitle: "You're Scheduled!",
    confirmedSubtitle: "Your appointment has been confirmed. A calendar invitation has been sent.",
    addToGoogle: "Add to Google Calendar",
    downloadIcs: "Download iCal (.ics)",
    bookAnother: "Schedule another appointment",
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [currentMonth, setCurrentMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState<Date | null>(today);
  const [slots, setSlots] = useState<TimeSlotOption[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlotOption | null>(null);

  // Form step states
  const [step, setStep] = useState<"time" | "form" | "confirmed">("time");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [confirmedData, setConfirmedData] = useState<any | null>(null);

  const pad = (n: number) => String(n).padStart(2, "0");
  const dateToStr = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  // Fetch slots whenever selectedDate changes
  useEffect(() => {
    if (!selectedDate) return;
    const dateStr = dateToStr(selectedDate);
    setLoadingSlots(true);
    getPublicBookingSlots(profile.slug, dateStr, profile.orgSlug)
      .then((res) => {
        setSlots(res.slots);
      })
      .catch((err) => {
        console.error("Error fetching slots:", err);
        setSlots([]);
      })
      .finally(() => {
        setLoadingSlots(false);
      });
  }, [selectedDate, profile.slug, profile.orgSlug]);

  const handlePrevMonth = () => {
    setCurrentMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
    );
  };

  const handleNextMonth = () => {
    setCurrentMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
    );
  };

  const handleSelectSlot = (slot: TimeSlotOption) => {
    setSelectedSlot(slot);
    setStep("form");
    setSubmitError(null);
    setFieldErrors({});
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;

    setSubmitting(true);
    setSubmitError(null);
    setFieldErrors({});

    try {
      const res = await bookPublicAppointment({
        bookingProfileId: profile.id,
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim(),
        clientPhone: clientPhone.trim() || null,
        notes: notes.trim() || null,
        startTime: selectedSlot.startIso,
      });

      if (res.status === "error") {
        setSubmitError(res.error);
        if (res.fieldErrors) setFieldErrors(res.fieldErrors);
      } else {
        setConfirmedData(res.data);
        setStep("confirmed");
      }
    } catch (err: any) {
      setSubmitError(err?.message || "Failed to book appointment.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setStep("time");
    setSelectedSlot(null);
    setClientName("");
    setClientEmail("");
    setClientPhone("");
    setNotes("");
    setConfirmedData(null);
  };

  // Build calendar matrix
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

  const daysCells: (Date | null)[] = [];
  for (let i = 0; i < firstDayIndex; i++) {
    daysCells.push(null);
  }
  for (let d = 1; d <= totalDaysInMonth; d++) {
    daysCells.push(new Date(year, month, d));
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-background via-muted/20 to-background py-8 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center">
      <div className="w-full max-w-4xl bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-12 min-h-[560px]">
          {/* ── Left Column: Host & Meeting Details ──────────────────── */}
          <div className="md:col-span-5 p-6 md:p-8 border-b md:border-b-0 md:border-r border-border bg-muted/10 flex flex-col justify-between space-y-6">
            <div className="space-y-6">
              {/* Organization badge */}
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <Building2 className="size-3.5 text-primary" />
                <span>{profile.orgName}</span>
              </div>

              {/* Host avatar & name */}
              <div className="flex items-center gap-3">
                <div className="size-12 rounded-full border border-border bg-primary/10 text-primary flex items-center justify-center font-bold text-base overflow-hidden shrink-0">
                  {profile.hostAvatar ? (
                    <img
                      src={profile.hostAvatar}
                      alt={profile.hostName}
                      className="size-full object-cover"
                    />
                  ) : (
                    profile.hostName.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Host</div>
                  <div className="font-bold text-base text-foreground">
                    {profile.hostName}
                  </div>
                </div>
              </div>

              {/* Meeting title & badges */}
              <div className="space-y-3">
                <h1 className="text-2xl font-black tracking-tight text-foreground">
                  {profile.title}
                </h1>

                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <div className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 font-medium text-foreground">
                    <Clock className="size-3.5 text-primary" />
                    <span>{profile.durationMinutes} {t.min}</span>
                  </div>
                  <div className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 font-medium text-foreground">
                    <Video className="size-3.5 text-primary" />
                    <span>{t.videoCall}</span>
                  </div>
                </div>

                {profile.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap pt-2">
                    {profile.description}
                  </p>
                )}
              </div>
            </div>

            {/* Powered by SpeciaLevel */}
            <div className="pt-4 border-t border-border/50 text-[11px] text-muted-foreground flex items-center gap-1">
              <span>{t.poweredBy}</span>
              <span className="font-bold text-foreground">SpeciaLevel</span>
            </div>
          </div>


          {/* ── Right Column: Interactive Scheduling / Booking Flow ── */}
          <div className="md:col-span-7 p-6 md:p-8 flex flex-col justify-center">
            {step === "time" ? (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-foreground">
                    {t.selectDateAndTime}
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-6">
                  {/* Mini Calendar Date Picker */}
                  <div className="sm:col-span-7 space-y-3">
                    <div className="flex items-center justify-between pb-1">
                      <span className="font-semibold text-sm">
                        {MONTH_NAMES[month]} {year}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handlePrevMonth}
                          className="size-7"
                        >
                          <ChevronLeft className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleNextMonth}
                          className="size-7"
                        >
                          <ChevronRight className="size-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Weekday headers */}
                    <div className="grid grid-cols-7 text-center text-xs font-semibold text-muted-foreground pb-1">
                      {WEEKDAYS.map((wd) => (
                        <div key={wd}>{wd}</div>
                      ))}
                    </div>

                    {/* Day cells */}
                    <div className="grid grid-cols-7 gap-1">
                      {daysCells.map((d, index) => {
                        if (!d) {
                          return <div key={`empty-${index}`} className="h-8" />;
                        }

                        const dayOfWeek = DAYS_MAP[d.getDay()];
                        const hasAvailability =
                          profile.weeklyAvailability[dayOfWeek] &&
                          profile.weeklyAvailability[dayOfWeek].length > 0;
                        const isPast =
                          d.getTime() < today.getTime();
                        const isSelectable = !isPast && hasAvailability;

                        const isSelected =
                          selectedDate &&
                          d.getFullYear() === selectedDate.getFullYear() &&
                          d.getMonth() === selectedDate.getMonth() &&
                          d.getDate() === selectedDate.getDate();

                        return (
                          <button
                            key={d.toISOString()}
                            type="button"
                            disabled={!isSelectable}
                            onClick={() => setSelectedDate(d)}
                            className={cn(
                              "h-8 rounded-md text-xs font-medium transition-all flex items-center justify-center",
                              !isSelectable &&
                                "text-muted-foreground/30 cursor-not-allowed",
                              isSelectable &&
                                !isSelected &&
                                "hover:bg-primary/10 hover:text-primary font-semibold text-foreground",
                              isSelected &&
                                "bg-primary text-primary-foreground font-bold shadow-xs scale-105"
                            )}
                          >
                            {d.getDate()}
                          </button>
                        );
                      })}
                    </div>
                  </div>


                  {/* Time Slots column */}
                  <div className="sm:col-span-5 space-y-3 sm:border-l sm:border-border sm:pl-5">
                    <div className="text-xs font-semibold text-muted-foreground">
                      {selectedDate ? (
                        selectedDate.toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })
                      ) : (
                        "Select a day"
                      )}
                    </div>

                    {loadingSlots ? (
                      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                        <LoaderCircle className="size-6 animate-spin mb-2 text-primary" />
                        <span className="text-xs">Finding available times...</span>
                      </div>
                    ) : slots.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-48 text-center text-xs text-muted-foreground">
                        <CalendarIcon className="size-8 text-muted-foreground/40 mb-2" />
                        {t.noTimesAvailable}
                      </div>
                    ) : (
                      <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                        {slots.map((slot) => (
                          <Button
                            key={slot.time}
                            type="button"
                            variant="outline"
                            disabled={!slot.available}
                            onClick={() => handleSelectSlot(slot)}
                            className={cn(
                              "w-full justify-center h-9 text-xs font-semibold transition-all",
                              slot.available
                                ? "hover:bg-primary hover:text-primary-foreground hover:border-primary border-border"
                                : "opacity-40 cursor-not-allowed line-through"
                            )}
                          >
                            {slot.time}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {/* Step 2: Client Contact Form */}
            {step === "form" && selectedSlot ? (
              <div className="space-y-5">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setStep("time")}
                    className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="size-3.5 mr-1" />
                    Back
                  </Button>
                  <div className="text-xs text-muted-foreground">
                    Selected:{" "}
                    <span className="font-semibold text-foreground">
                      {selectedDate?.toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      at {selectedSlot.time}
                    </span>
                  </div>
                </div>

                <form onSubmit={handleBookingSubmit} className="space-y-4">
                  {submitError && (
                    <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive font-medium">
                      {submitError}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="client-name" className="text-xs font-semibold">
                      {t.fullName} *
                    </Label>
                    <Input
                      id="client-name"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Jane Doe"
                      required
                      className="h-9 text-xs"
                    />
                    {fieldErrors.clientName && (
                      <p className="text-xs text-destructive">{fieldErrors.clientName[0]}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="client-email" className="text-xs font-semibold">
                      {t.email} *
                    </Label>
                    <Input
                      id="client-email"
                      type="email"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      placeholder="jane@company.com"
                      required
                      className="h-9 text-xs"
                    />
                    {fieldErrors.clientEmail && (
                      <p className="text-xs text-destructive">{fieldErrors.clientEmail[0]}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="client-phone" className="text-xs font-semibold">
                      {t.phone}
                    </Label>
                    <Input
                      id="client-phone"
                      type="tel"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="client-notes" className="text-xs font-semibold">
                      {t.notes}
                    </Label>
                    <Textarea
                      id="client-notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={t.notesPlaceholder}
                      rows={2}
                      className="text-xs"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full h-10 text-xs font-semibold shadow-md mt-2"
                  >
                    {submitting ? (
                      <>
                        <LoaderCircle className="size-4 mr-2 animate-spin" />
                        {t.booking}
                      </>
                    ) : (
                      t.confirmBooking
                    )}
                  </Button>
                </form>
              </div>
            ) : null}

            {/* Step 3: Confirmation Screen */}
            {step === "confirmed" && confirmedData ? (
              <div className="py-4 text-center space-y-5">
                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                  <CheckCircle2 className="size-8" />
                </div>

                <div className="space-y-1.5">
                  <h2 className="text-xl font-bold text-foreground">
                    {t.confirmedTitle}
                  </h2>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    {t.confirmedSubtitle}
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-muted/20 p-4 text-left space-y-2 text-xs">
                  <div className="font-bold text-sm text-foreground">
                    {profile.title}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CalendarCheck className="size-3.5 text-primary" />
                    <span>
                      {new Date(confirmedData.start_time).toLocaleString(undefined, {
                        weekday: "long",
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="size-3.5 text-primary" />
                    <span>{profile.durationMinutes} min · Online Video Call</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="size-3.5 text-primary" />
                    <span>Host: {profile.hostName}</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      downloadIcs({
                        title: profile.title,
                        description: `Meeting with ${profile.hostName} (${profile.hostEmail})`,
                        startIso: confirmedData.start_time,
                        endIso: confirmedData.end_time,
                        hostName: profile.hostName,
                        hostEmail: profile.hostEmail,
                      })
                    }
                    className="w-full sm:w-1/2 h-9 text-xs font-semibold"
                  >
                    <Download className="size-3.5 mr-1.5" />
                    {t.downloadIcs}
                  </Button>

                  <a
                    href={getGoogleCalendarUrl({
                      title: profile.title,
                      description: `Meeting with ${profile.hostName} (${profile.hostEmail})`,
                      startIso: confirmedData.start_time,
                      endIso: confirmedData.end_time,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-1/2 inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground h-9 text-xs font-semibold hover:bg-primary/90 transition-colors"
                  >
                    <ExternalLink className="size-3.5 mr-1.5" />
                    {t.addToGoogle}
                  </a>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    {t.bookAnother}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}



