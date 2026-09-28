import { z } from "zod";
import type { CrmStage } from "@/types/database";

/**
 * Shared Zod schema for CRM deals (create + convert lead to deal + edit)
 * and CRM Multi-Pipeline Management (pipelines + stages).
 */

export const crmStageSchema = z.string().min(1);

/** Localized string messages consumed by the CRM schemas. */
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

export const crmPipelineStageSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Stage name is required").max(60, "Stage name is too long"),
  orderIndex: z.number().int().min(0).default(0),
  probability: z.number().min(0).max(100).default(100),
  staleDays: z.number().int().min(1).max(365).default(14),
});

export type CrmPipelineStageInput = z.infer<typeof crmPipelineStageSchema>;

export const crmPipelineSchema = z.object({
  name: z.string().trim().min(2, "Pipeline name must be at least 2 characters.").max(100, "Pipeline name must be 100 characters or fewer."),
  isDefault: z.boolean().optional().default(false),
  orderIndex: z.number().int().min(0).optional().default(0),
  stages: z.array(crmPipelineStageSchema).min(1, "A pipeline must have at least one stage."),
});

export type CrmPipelineInput = z.infer<typeof crmPipelineSchema>;

export function createCrmDealInputSchema(
  messages: CrmValidationMessages = DEFAULT_CRM_VALIDATION_MESSAGES
) {
  return z.object({
    title: z
      .string()
      .trim()
      .min(2, messages.titleMin)
      .max(200, messages.titleMax),
    value: z
      .number({ error: messages.valueInvalid })
      .min(0, messages.valueInvalid)
      .max(1_000_000_000, messages.valueInvalid),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, messages.currencyInvalid),
    pipelineId: z.string().uuid().optional().or(z.literal("")),
    stageId: z.string().uuid().optional().or(z.literal("")),
    stage: z.string().optional().or(z.literal("")),
    notes: z
      .string()
      .trim()
      .max(4000, messages.notesMax)
      .optional()
      .or(z.literal("")),
    lostReason: z.string().trim().max(500).optional().or(z.literal("")),
    wonReason: z.string().trim().max(500).optional().or(z.literal("")),
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
  fieldErrors?: Partial<Record<string, string[] | undefined>>;
  data?: unknown;
}

export const initialCrmActionState: CrmActionState = {
  status: "idle",
};
