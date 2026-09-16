import { z } from "zod";

/**
 * Shared Zod schemas for the CRM contacts directory (00020).
 *
 * Used client-side (react-hook-form resolver in the contact dialog)
 * and re-validated server-side in lib/actions/crm-contacts.ts.
 *
 * i18n: validation messages are parameterized through
 * `createContactInputSchema(messages)` so the client forms and the
 * server actions pass localized messages from the active dictionary.
 * Field names are camelCase over the wire; they are mapped to the
 * snake_case DB columns inside the server actions.
 */

/**
 * Localized string messages consumed by the contacts schemas.
 *
 * The key names intentionally match `platform.crm.errors` in the
 * dictionaries (the existing CRM entry already carries
 * contactNameMin/contactNameMax/contactEmailInvalid/
 * contactCompanyMax/contactPhoneMax), so callers can pass the whole
 * errors object straight into the schema factory.
 */
export interface ContactValidationMessages {
  contactNameMin: string;
  contactNameMax: string;
  contactEmailInvalid: string;
  contactCompanyMax: string;
  contactPhoneMax: string;
  titleMax: string;
  addressMax: string;
  notesMax: string;
  tagMin: string;
  tagMax: string;
  tagsMax: string;
  noteRequired: string;
  noteMax: string;
}

export const DEFAULT_CONTACT_VALIDATION_MESSAGES: ContactValidationMessages = {
  contactNameMin: "Contact name must be at least 2 characters.",
  contactNameMax: "Contact name must be 120 characters or fewer.",
  contactEmailInvalid: "Enter a valid contact email.",
  contactCompanyMax: "Company must be 150 characters or fewer.",
  contactPhoneMax: "Phone must be 30 characters or fewer.",
  titleMax: "Job title must be 150 characters or fewer.",
  addressMax: "Address must be 500 characters or fewer.",
  notesMax: "Notes must be 4000 characters or fewer.",
  tagMin: "Tags can't be empty.",
  tagMax: "Keep each tag within 24 characters.",
  tagsMax: "Add at most 20 tags.",
  noteRequired: "Note content is required.",
  noteMax: "Note must be 2000 characters or fewer.",
};

export function createContactInputSchema(
  messages: ContactValidationMessages = DEFAULT_CONTACT_VALIDATION_MESSAGES
) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(2, messages.contactNameMin)
      .max(120, messages.contactNameMax),
    email: z.string().trim().toLowerCase().email(messages.contactEmailInvalid),
    company: z
      .string()
      .trim()
      .max(150, messages.contactCompanyMax)
      .optional()
      .or(z.literal("")),
    phone: z
      .string()
      .trim()
      .max(30, messages.contactPhoneMax)
      .optional()
      .or(z.literal("")),
    title: z
      .string()
      .trim()
      .max(150, messages.titleMax)
      .optional()
      .or(z.literal("")),
    address: z
      .string()
      .trim()
      .max(500, messages.addressMax)
      .optional()
      .or(z.literal("")),
    notes: z
      .string()
      .trim()
      .max(4000, messages.notesMax)
      .optional()
      .or(z.literal("")),
    tags: z
      .array(
        z
          .string()
          .trim()
          .min(1, messages.tagMin)
          .max(24, messages.tagMax)
      )
      .max(20, messages.tagsMax),
  });
}

export const contactInputSchema = createContactInputSchema();

export type ContactInput = z.infer<
  ReturnType<typeof createContactInputSchema>
>;

/** Schema for a single internal contact note. */
export function createContactNoteSchema(
  messages: ContactValidationMessages = DEFAULT_CONTACT_VALIDATION_MESSAGES
) {
  return z
    .object({
      content: z
        .string()
        .trim()
        .min(1, messages.noteRequired)
        .max(2000, messages.noteMax),
    })
    .required();
}

export const contactNoteSchema = createContactNoteSchema();

export type ContactNoteInput = z.infer<
  ReturnType<typeof createContactNoteSchema>
>;

/** State returned by CRM contact server actions. */
export interface ContactActionState {
  status: "idle" | "success" | "error";
  error?: string | null;
  fieldErrors?: Partial<Record<keyof ContactInput, string[] | undefined>>;
}

export const initialContactActionState: ContactActionState = {
  status: "idle",
};

/**
 * Splits a comma-separated tag field (used by the contact dialog) into a
 * normalized tag array. Blanks are dropped; duplicates are collapsed to
 * their first occurrence, case-insensitively.
 */
export function parseTagsInput(raw: string): string[] {
  return Array.from(
    new Map(
      raw
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .map((tag) => [tag.toLowerCase(), tag])
    ).values()
  );
}

/** Rejoins a tag array into the comma-separated text a form field shows. */
export function joinTagsInput(tags: string[]): string {
  return (tags ?? []).join(", ");
}