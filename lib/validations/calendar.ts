import { z } from "zod";

/**
 * Shared Zod schema for calendar events (create + update).
 * Used client-side (react-hook-form resolver) and re-validated
 * server-side in lib/actions/calendar.ts.
 *
 * Field names match the DB columns (starts_at / ends_at).
 * Times arrive as ISO strings; the raw datetime-local input is
 * validated client-side before submission.
 */
export const calendarEventSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required.")
    .max(200, "Title must be 200 characters or fewer."),
  description: z
    .string()
    .trim()
    .max(4000, "Description must be 4000 characters or fewer.")
    .optional()
    .or(z.literal("")),
  startsAt: z
    .string()
    .min(1, "Start time is required.")
    .refine(
      (value) => !Number.isNaN(Date.parse(value)),
      "Enter a valid start time."
    ),
  endsAt: z
    .string()
    .min(1, "End time is required.")
    .refine(
      (value) => !Number.isNaN(Date.parse(value)),
      "Enter a valid end time."
    ),
  location: z
    .string()
    .trim()
    .max(200, "Location must be 200 characters or fewer.")
    .optional()
    .or(z.literal("")),
  assignedUserId: z.string().uuid().optional().or(z.literal("")),
});

export type CalendarEventInput = z.infer<typeof calendarEventSchema>;

/** State returned by calendar server actions. */
export interface CalendarActionState {
  status: "idle" | "success" | "error";
  error?: string | null;
  fieldErrors?: Partial<Record<keyof CalendarEventInput, string[] | undefined>>;
}

export const initialCalendarActionState: CalendarActionState = {
  status: "idle",
};

/**
 * Refine end > start at the schema level so BOTH react-hook-form and
 * server-side re-validation enforce the invariant with one definition.
 */
export const calendarEventSchemaWithRange = calendarEventSchema.refine(
  (data) => {
    if (!data.startsAt || !data.endsAt) return true;
    const start = Date.parse(data.startsAt);
    const end = Date.parse(data.endsAt);
    if (Number.isNaN(start) || Number.isNaN(end)) return true;
    return end > start;
  },
  {
    message: "End time must be after the start time.",
    path: ["endsAt"],
  }
);

export type CalendarFormValues = z.infer<typeof calendarEventSchemaWithRange>;

// ============================================================
// Appointment Scheduler & Booking Profiles Schemas
// ============================================================

export type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export interface TimeSlot {
  start: string; // "HH:MM" 24hr format, e.g. "09:00"
  end: string;   // "HH:MM" 24hr format, e.g. "17:00"
}

export type WeeklyAvailability = Record<DayOfWeek, TimeSlot[]>;

export const DEFAULT_WEEKLY_AVAILABILITY: WeeklyAvailability = {
  monday: [{ start: "09:00", end: "17:00" }],
  tuesday: [{ start: "09:00", end: "17:00" }],
  wednesday: [{ start: "09:00", end: "17:00" }],
  thursday: [{ start: "09:00", end: "17:00" }],
  friday: [{ start: "09:00", end: "17:00" }],
  saturday: [],
  sunday: [],
};

export interface BookingProfileRow {
  id: string;
  organizationId: string;
  userId: string;
  slug: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  isActive: boolean;
  weeklyAvailability: WeeklyAvailability;
  createdAt: string;
  updatedAt: string;
}

export const timeSlotSchema = z.object({
  start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM)"),
  end: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM)"),
});

export const weeklyAvailabilitySchema = z.object({
  monday: z.array(timeSlotSchema),
  tuesday: z.array(timeSlotSchema),
  wednesday: z.array(timeSlotSchema),
  thursday: z.array(timeSlotSchema),
  friday: z.array(timeSlotSchema),
  saturday: z.array(timeSlotSchema),
  sunday: z.array(timeSlotSchema),
});

export const bookingProfileInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  slug: z
    .string()
    .trim()
    .min(2, "Slug must be at least 2 characters")
    .max(60)
    .regex(/^[a-z0-9-_]+$/, "Slug can only contain lowercase letters, numbers, hyphens, and underscores"),
  description: z.string().trim().max(1000).optional().nullable(),
  durationMinutes: z.coerce.number().int().min(5).max(480).default(30),
  bufferBeforeMinutes: z.coerce.number().int().min(0).max(60).default(0),
  bufferAfterMinutes: z.coerce.number().int().min(0).max(60).default(10),
  isActive: z.boolean().default(true),
  weeklyAvailability: weeklyAvailabilitySchema.default(DEFAULT_WEEKLY_AVAILABILITY),
});

export type BookingProfileInput = z.infer<typeof bookingProfileInputSchema>;

export type AppointmentStatus = "confirmed" | "cancelled" | "completed";

export interface AppointmentRow {
  id: string;
  organizationId: string;
  bookingProfileId: string;
  hostUserId: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  notes: string | null;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  contactId: string | null;
  dealId: string | null;
  createdAt: string;
  updatedAt: string;
  host?: {
    id: string;
    fullName: string | null;
    email: string | null;
    avatarUrl: string | null;
  };
  contact?: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    company?: string | null;
  } | null;
  deal?: {
    id: string;
    title: string;
    value: number;
    currency: string;
    stage: string;
  } | null;
}

export interface PublicBookingProfile {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  weeklyAvailability: WeeklyAvailability;
  hostName: string;
  hostAvatar: string | null;
  hostEmail: string;
  orgName: string;
  orgSlug: string;
  existingAppointments?: { start_time: string; end_time: string }[];
}

export const publicAppointmentInputSchema = z.object({
  bookingProfileId: z.string().uuid("Invalid booking profile"),
  clientName: z.string().trim().min(1, "Name is required").max(100),
  clientEmail: z.string().trim().email("Enter a valid email address"),
  clientPhone: z.string().trim().max(30).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  startTime: z.string().min(1, "Start time is required"),
});

export type PublicAppointmentInput = z.infer<typeof publicAppointmentInputSchema>;
