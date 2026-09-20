"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Clock,
  LoaderCircle,
  Check,
  CalendarCheck,
} from "lucide-react";
import {
  updateMyBookingProfile,
} from "@/lib/actions/calendar";
import {
  DEFAULT_WEEKLY_AVAILABILITY,
  type BookingProfileRow,
  type BookingProfileInput,
  type DayOfWeek,
  type WeeklyAvailability,
} from "@/lib/validations/calendar";

interface AvailabilityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingProfile: BookingProfileRow | null;
  onSaved: (profile: BookingProfileRow) => void;
  dictionary?: Record<string, any>;
}

const DAYS: { key: DayOfWeek; label: string }[] = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
];

export function AvailabilityDialog({
  open,
  onOpenChange,
  bookingProfile,
  onSaved,
  dictionary,
}: AvailabilityDialogProps) {
  const t = dictionary?.platform?.calendar?.availability ?? {
    title: "Booking Profile & Availability",
    subtitle: "Configure your meeting title, duration, buffer times, and working hours.",
    meetingTitle: "Meeting Title",
    slug: "Custom Booking URL Slug",
    slugHint: "Public URL: /book/[slug]",
    description: "Description & Instructions",
    durationMinutes: "Meeting Duration (minutes)",
    bufferBefore: "Buffer Before (minutes)",
    bufferAfter: "Buffer After (minutes)",
    weeklySchedule: "Weekly Working Hours",
    activeStatus: "Accepting New Bookings",
    save: "Save Availability",
    saving: "Saving...",
  };

  const [title, setTitle] = useState(bookingProfile?.title ?? "30 Min Consultation");
  const [slug, setSlug] = useState(bookingProfile?.slug ?? "");
  const [description, setDescription] = useState(bookingProfile?.description ?? "");
  const [durationMinutes, setDurationMinutes] = useState(bookingProfile?.durationMinutes ?? 30);
  const [bufferBeforeMinutes, setBufferBeforeMinutes] = useState(bookingProfile?.bufferBeforeMinutes ?? 0);
  const [bufferAfterMinutes, setBufferAfterMinutes] = useState(bookingProfile?.bufferAfterMinutes ?? 10);
  const [isActive, setIsActive] = useState(bookingProfile?.isActive ?? true);
  const [weeklyAvailability, setWeeklyAvailability] = useState<WeeklyAvailability>(
    bookingProfile?.weeklyAvailability ?? DEFAULT_WEEKLY_AVAILABILITY
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen && bookingProfile) {
      setTitle(bookingProfile.title);
      setSlug(bookingProfile.slug);
      setDescription(bookingProfile.description ?? "");
      setDurationMinutes(bookingProfile.durationMinutes);
      setBufferBeforeMinutes(bookingProfile.bufferBeforeMinutes);
      setBufferAfterMinutes(bookingProfile.bufferAfterMinutes);
      setIsActive(bookingProfile.isActive);
      setWeeklyAvailability(bookingProfile.weeklyAvailability);
      setError(null);
      setFieldErrors({});
      setSavedSuccess(false);
    }
    onOpenChange(nextOpen);
  };

  const handleDayToggle = (day: DayOfWeek, enabled: boolean) => {
    setWeeklyAvailability((prev) => ({
      ...prev,
      [day]: enabled ? [{ start: "09:00", end: "17:00" }] : [],
    }));
  };

  const handleTimeChange = (
    day: DayOfWeek,
    field: "start" | "end",
    value: string
  ) => {
    setWeeklyAvailability((prev) => {
      const current = prev[day] && prev[day].length > 0 ? prev[day][0] : { start: "09:00", end: "17:00" };
      return {
        ...prev,
        [day]: [{ ...current, [field]: value }],
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});

    const payload: BookingProfileInput = {
      title: title.trim(),
      slug: slug.trim().toLowerCase(),
      description: description.trim() || null,
      durationMinutes: Number(durationMinutes),
      bufferBeforeMinutes: Number(bufferBeforeMinutes),
      bufferAfterMinutes: Number(bufferAfterMinutes),
      isActive,
      weeklyAvailability,
    };

    try {
      const res = await updateMyBookingProfile(payload);
      if (res.status === "error") {
        setError(res.error);
        if (res.fieldErrors) setFieldErrors(res.fieldErrors);
      } else {
        setSavedSuccess(true);
        onSaved(res.data);
        setTimeout(() => {
          onOpenChange(false);
          setSavedSuccess(false);
        }, 600);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to update booking profile.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck className="size-5 text-primary" />
            {t.title}
          </DialogTitle>
          <DialogDescription>{t.subtitle}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-2">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive font-medium">
              {error}
            </div>
          )}

          {/* Active toggle */}
          <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-muted/30">
            <div className="space-y-0.5">
              <Label htmlFor="active-toggle" className="font-semibold text-sm">
                {t.activeStatus}
              </Label>
              <p className="text-xs text-muted-foreground">
                When enabled, clients can schedule appointments with you via your link.
              </p>
            </div>
            <Switch
              id="active-toggle"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>

          {/* Meeting Title & Slug */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="meeting-title">{t.meetingTitle}</Label>
              <Input
                id="meeting-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 30 Min Consultation"
                required
              />
              {fieldErrors.title && (
                <p className="text-xs text-destructive">{fieldErrors.title[0]}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="meeting-slug">{t.slug}</Label>
              <Input
                id="meeting-slug"
                value={slug}
                onChange={(e) =>
                  setSlug(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-_]/g, "")
                  )
                }
                placeholder="e.g. my-name-30min"
                required
              />
              <p className="text-xs text-muted-foreground">{t.slugHint}</p>
              {fieldErrors.slug && (
                <p className="text-xs text-destructive">{fieldErrors.slug[0]}</p>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="meeting-desc">{t.description}</Label>
            <Textarea
              id="meeting-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description or instructions for clients when booking..."
              rows={2}
            />
          </div>

          {/* Duration & Buffer times */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="meeting-duration">{t.durationMinutes}</Label>
              <select
                id="meeting-duration"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus:outline-hidden focus:ring-1 focus:ring-ring"
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>60 minutes</option>
                <option value={90}>90 minutes</option>
                <option value={120}>2 hours</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="meeting-buffer-before">{t.bufferBefore}</Label>
              <select
                id="meeting-buffer-before"
                value={bufferBeforeMinutes}
                onChange={(e) => setBufferBeforeMinutes(Number(e.target.value))}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus:outline-hidden focus:ring-1 focus:ring-ring"
              >
                <option value={0}>0 min (None)</option>
                <option value={5}>5 min</option>
                <option value={10}>10 min</option>
                <option value={15}>15 min</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="meeting-buffer-after">{t.bufferAfter}</Label>
              <select
                id="meeting-buffer-after"
                value={bufferAfterMinutes}
                onChange={(e) => setBufferAfterMinutes(Number(e.target.value))}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus:outline-hidden focus:ring-1 focus:ring-ring"
              >
                <option value={0}>0 min (None)</option>
                <option value={5}>5 min</option>
                <option value={10}>10 min</option>
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
              </select>
            </div>
          </div>


          {/* Weekly Schedule Grid */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              <Label className="text-sm font-semibold">{t.weeklySchedule}</Label>
            </div>

            <div className="divide-y divide-border rounded-lg border border-border bg-card">
              {DAYS.map(({ key, label }) => {
                const daySlots = weeklyAvailability[key] || [];
                const isEnabled = daySlots.length > 0;
                const slot = isEnabled ? daySlots[0] : { start: "09:00", end: "17:00" };

                return (
                  <div
                    key={key}
                    className="flex flex-wrap items-center justify-between gap-3 p-3 transition-colors hover:bg-muted/20"
                  >
                    <div className="flex items-center gap-3 w-32">
                      <Switch
                        id={`day-${key}`}
                        checked={isEnabled}
                        onCheckedChange={(checked) => handleDayToggle(key, checked)}
                      />
                      <Label
                        htmlFor={`day-${key}`}
                        className={`text-sm cursor-pointer ${
                          isEnabled ? "font-medium text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {label}
                      </Label>
                    </div>

                    {isEnabled ? (
                      <div className="flex items-center gap-2 text-sm">
                        <Input
                          type="time"
                          value={slot.start}
                          onChange={(e) => handleTimeChange(key, "start", e.target.value)}
                          className="h-8 w-28 text-center"
                        />
                        <span className="text-muted-foreground text-xs">to</span>
                        <Input
                          type="time"
                          value={slot.end}
                          onChange={(e) => handleTimeChange(key, "end", e.target.value)}
                          className="h-8 w-28 text-center"
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">
                        Unavailable
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || savedSuccess}>
              {loading ? (
                <>
                  <LoaderCircle className="mr-2 size-4 animate-spin" />
                  {t.saving}
                </>
              ) : savedSuccess ? (
                <>
                  <Check className="mr-2 size-4 text-emerald-500" />
                  Saved!
                </>
              ) : (
                t.save
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

