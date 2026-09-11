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