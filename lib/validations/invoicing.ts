import { z } from "zod";
import type { InvoiceStatus } from "@/types/database";

/**
 * Shared Zod schema for invoice creation. Validated client-side in the
 * create-invoice dialog and re-validated server-side in
 * lib/actions/invoicing.ts before the payload reaches the atomic
 * `create_invoice` DB function.
 *
 * i18n: validation messages are parameterized through
 * `createInvoiceInputSchema(messages)` so the create dialog and the
 * server actions can pass localized messages from the active dictionary.
 * The exported `createInvoiceInputSchema()` keeps English defaults for
 * callers that need the schema without a locale.
 *
 * Field names are camelCase over the wire; they map to the snake_case
 * params of the `create_invoice(...)` RPC inside the server action.
 * `contactId` and `dueDate` may be empty strings from the form — they
 * are normalized to null before the RPC call.
 */

export const invoiceStatusSchema = z.enum([
  "draft",
  "sent",
  "paid",
  "overdue",
  "cancelled",
]);

/** Localized string messages consumed by the invoice schema. */
export interface InvoicingValidationMessages {
  contactInvalid: string;
  currencyInvalid: string;
  taxRateInvalid: string;
  dueDateInvalid: string;
  notesMax: string;
  itemsRequired: string;
  itemDescriptionRequired: string;
  itemDescriptionMax: string;
  itemQuantityInvalid: string;
  itemUnitPriceInvalid: string;
}

export const DEFAULT_INVOICING_VALIDATION_MESSAGES: InvoicingValidationMessages =
  {
    contactInvalid: "Select a valid client.",
    currencyInvalid: "Use a 3-letter currency code (e.g. USD).",
    taxRateInvalid: "Enter a tax rate between 0 and 100.",
    dueDateInvalid: "Enter a valid date in YYYY-MM-DD format.",
    notesMax: "Notes must be 4000 characters or fewer.",
    itemsRequired: "Add at least one line item.",
    itemDescriptionRequired: "Every line item needs a description.",
    itemDescriptionMax:
      "Line item descriptions must be 500 characters or fewer.",
    itemQuantityInvalid: "Enter a valid quantity (0 or more).",
    itemUnitPriceInvalid: "Enter a valid unit price (0 or more).",
  };

export function createInvoiceInputSchema(
  messages: InvoicingValidationMessages = DEFAULT_INVOICING_VALIDATION_MESSAGES
) {
  return z.object({
    contactId: z
      .string()
      .trim()
      .uuid(messages.contactInvalid)
      .optional()
      .or(z.literal("")),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, messages.currencyInvalid),
    taxRate: z
      .number({ error: messages.taxRateInvalid })
      .min(0, messages.taxRateInvalid)
      .max(100, messages.taxRateInvalid),
    dueDate: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, messages.dueDateInvalid)
      .optional()
      .or(z.literal("")),
    notes: z
      .string()
      .trim()
      .max(4000, messages.notesMax)
      .optional()
      .or(z.literal("")),
    items: z
      .array(
        z.object({
          description: z
            .string()
            .trim()
            .min(1, messages.itemDescriptionRequired)
            .max(500, messages.itemDescriptionMax),
          quantity: z
            .number({ error: messages.itemQuantityInvalid })
            .min(0, messages.itemQuantityInvalid)
            .max(100_000_000, messages.itemQuantityInvalid),
          unitPrice: z
            .number({ error: messages.itemUnitPriceInvalid })
            .min(0, messages.itemUnitPriceInvalid)
            .max(1_000_000_000, messages.itemUnitPriceInvalid),
        })
      )
      .min(1, messages.itemsRequired)
      .max(200, messages.itemsRequired),
  });
}

export type InvoiceInput = z.infer<ReturnType<typeof createInvoiceInputSchema>>;

export type InvoiceStatusValue = InvoiceStatus;

/** State returned by invoicing server actions. */
export interface InvoicingActionState {
  status: "idle" | "success" | "error";
  error?: string | null;
  fieldErrors?: Partial<Record<keyof InvoiceInput, string[] | undefined>>;
}

export const initialInvoicingActionState: InvoicingActionState = {
  status: "idle",
};