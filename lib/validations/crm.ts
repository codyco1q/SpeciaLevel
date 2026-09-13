import { z } from "zod";
import type { CrmStage } from "@/types/database";

/**
 * Shared Zod schema for CRM deals (create + convert lead to deal).
 * Used client-side (react-hook-form resolver) and re-validated
 * server-side in lib/actions/crm.ts.
 *
 * i18n: validation messages are parameterized through
 * `createCrmDealInputSchema(messages)` so the deal dialog and the
 * server actions can pass localized messages from the active
 * dictionary. The exported `crmDealInputSchema` keeps the English
 * defaults for callers that need the schema without a locale.
 *
 * Field names are camelCase over the wire; they are mapped to the
 * snake_case DB columns inside the server actions. `contact` is
 * optional but, when provided, requires both a name and an email
 * (company and phone are optional extras).
 */

export const crmStageSchema = z.enum([
  "lead",
  "contacted",
  "proposal",
  "won",
  "lost",
]);

/** Localized string messages consumed by the CRM schema. */
export interface CrmValidationMessages {
  titleMin: string;
  titleMax: string;
  valueInvalid: string;
  currencyInvalid: string;
  notesMax: string;
  contactIncomplete: string;
  contactNameMin: string;
  contactNameMax: string;
  contactEmailInvalid: string;
  contactCompanyMax: string;
  contactPhoneMax: string;
  assigneeInvalid: string;
  stageInvalid: string;
}

export const DEFAULT_CRM_VALIDATION_MESSAGES: CrmValidationMessages = {
  titleMin: "Deal title must be at least 2 characters.",
  titleMax: "Deal title must be 200 characters or fewer.",
  valueInvalid: "Enter a valid deal value (0 or more).",
  currencyInvalid: "Use a 3-letter currency code (e.g. USD).",
  notesMax: "Notes must be 4000 characters or fewer.",
  contactIncomplete: "Provide both a name and an email to add a contact.",
  contactNameMin: "Contact name must be at least 2 characters.",
  contactNameMax: "Contact name must be 120 characters or fewer.",
  contactEmailInvalid: "Enter a valid contact email.",
  contactCompanyMax: "Company must be 150 characters or fewer.",
  contactPhoneMax: "Phone must be 30 characters or fewer.",
  assigneeInvalid: "Select a valid team member.",
  stageInvalid: "Invalid stage.",
};

export function createCrmDealInputSchema(
  messages: CrmValidationMessages = DEFAULT_CRM_VALIDATION_MESSAGES
) {
  return z.object({
    title: z
      .string()
      .trim()
      .min(2, messages.titleMin)
      .max(200, messages.titleMax),
    // Numeric input only (RHF sends a number via valueAsNumber). Negative
    // or non-numeric values fail; the client seeds the field with 0.
    value: z
      .number({ error: messages.valueInvalid })
      .min(0, messages.valueInvalid)
      .max(1_000_000_000, messages.valueInvalid),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, messages.currencyInvalid),
    stage: crmStageSchema,
    notes: z
      .string()
      .trim()
      .max(4000, messages.notesMax)
      .optional()
      .or(z.literal("")),
    assignedTo: z
      .string()
      .uuid(messages.assigneeInvalid)
      .optional()
      .or(z.literal("")),
    contact: z
      .object({
        name: z.string().trim(),
        email: z.string().trim().toLowerCase(),
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
      })
      .superRefine((contact, ctx) => {
        const hasName = contact.name.length > 0;
        const hasEmail = contact.email.length > 0;

        if (hasName !== hasEmail) {
          ctx.addIssue({
            code: "custom",
            path: ["name"],
            message: messages.contactIncomplete,
          });
          return;
        }

        if (!hasName) return; // both empty = no contact, that's fine

        if (contact.name.length < 2) {
          ctx.addIssue({
            code: "custom",
            path: ["name"],
            message: messages.contactNameMin,
          });
        }
        if (!z.string().email().safeParse(contact.email).success) {
          ctx.addIssue({
            code: "custom",
            path: ["email"],
            message: messages.contactEmailInvalid,
          });
        }
      })
      .optional(),
  });
}

export const crmDealInputSchema = createCrmDealInputSchema();

export type CrmDealInput = z.infer<ReturnType<typeof createCrmDealInputSchema>>;

export type CrmStageValue = CrmStage;

/** State returned by CRM server actions. */
export interface CrmActionState {
  status: "idle" | "success" | "error";
  error?: string | null;
  fieldErrors?: Partial<Record<keyof CrmDealInput, string[] | undefined>>;
}

export const initialCrmActionState: CrmActionState = {
  status: "idle",
};