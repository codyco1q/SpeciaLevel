import { z } from "zod";

/**
 * Duplicate handling strategies for bulk CSV contact import.
 * - `update`: Matches by email/phone; updates existing contact details and merges tags/custom_fields.
 * - `skip`: Ignores incoming row if email or phone already exists in the organization.
 * - `create`: Inserts a new contact record regardless.
 */
export const duplicateStrategySchema = z.enum(["update", "skip", "create"]);
export type DuplicateStrategy = z.infer<typeof duplicateStrategySchema>;

/**
 * Localized string messages consumed by contact schemas.
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
  messages?: Partial<ContactValidationMessages>
) {
  const msg = { ...DEFAULT_CONTACT_VALIDATION_MESSAGES, ...messages };
  return z.object({
    name: z
      .string()
      .trim()
      .min(2, msg.contactNameMin)
      .max(120, msg.contactNameMax),
    email: z.string().trim().toLowerCase().email(msg.contactEmailInvalid),
    company: z
      .string()
      .trim()
      .max(150, msg.contactCompanyMax)
      .optional()
      .or(z.literal("")),
    phone: z
      .string()
      .trim()
      .max(30, msg.contactPhoneMax)
      .optional()
      .or(z.literal("")),
    title: z
      .string()
      .trim()
      .max(150, msg.titleMax)
      .optional()
      .or(z.literal("")),
    address: z
      .string()
      .trim()
      .max(500, msg.addressMax)
      .optional()
      .or(z.literal("")),
    notes: z
      .string()
      .trim()
      .max(4000, msg.notesMax)
      .optional()
      .or(z.literal("")),
    tags: z
      .array(
        z
          .string()
          .trim()
          .min(1, msg.tagMin)
          .max(24, msg.tagMax)
      )
      .max(20, msg.tagsMax),
  });
}

export const contactInputSchema = createContactInputSchema();
export type ContactInput = z.infer<ReturnType<typeof createContactInputSchema>>;

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
export type ContactNoteInput = z.infer<ReturnType<typeof createContactNoteSchema>>;

/** Schema for a single row mapped from CSV during bulk import. */
export const importContactItemSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().toLowerCase().optional().or(z.literal("")),
  phone: z.string().trim().optional().or(z.literal("")),
  company: z.string().trim().optional().or(z.literal("")),
  title: z.string().trim().optional().or(z.literal("")),
  address: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
  tags: z.array(z.string().trim()).default([]),
});

export type ImportContactItem = z.infer<typeof importContactItemSchema>;

/** Schema for the bulk import server action payload. */
export const importContactsInputSchema = z.object({
  contacts: z
    .array(importContactItemSchema)
    .min(1, "At least one contact row is required to import."),
  duplicateStrategy: duplicateStrategySchema.default("update"),
  batchTags: z.array(z.string().trim()).default([]),
});

export type ImportContactsInput = z.infer<typeof importContactsInputSchema>;

/** State returned by contact server actions. */
export interface ContactActionState {
  status: "idle" | "success" | "error";
  error?: string | null;
  fieldErrors?: Partial<Record<keyof ContactInput, string[] | undefined>>;
}

export const initialContactActionState: ContactActionState = {
  status: "idle",
};

export interface BulkImportResult {
  inserted_count: number;
  updated_count: number;
  skipped_count: number;
  errors: Array<{ row_index?: number; error: string }>;
}

export interface ContactImportError {
  index?: number;
  row_index?: number;
  email?: string;
  name?: string;
  error: string;
}

export interface ImportContactsActionState {
  status: "idle" | "success" | "error";
  error?: string | null;
  createdCount?: number;
  updatedCount?: number;
  skippedCount?: number;
  errorCount?: number;
  errors?: ContactImportError[];
  data?: BulkImportResult;
}

export type ContactImportResult = ImportContactsActionState;
export type ContactImportRecord = ImportContactItem;

/**
 * Splits a comma-separated tag field into a normalized tag array.
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

/**
 * Joins a tag array into a clean comma-separated string for form inputs.
 */
export function joinTagsInput(tags: string[]): string {
  return (tags ?? []).join(", ");
}
