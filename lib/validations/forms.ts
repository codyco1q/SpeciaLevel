import { z } from "zod";

export type FormFieldType =
  | "text"
  | "email"
  | "phone"
  | "textarea"
  | "select"
  | "number";

export interface FormField {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  placeholder?: string;
  options?: string[];
  helpText?: string;
}

export type DealStage = "lead" | "contacted" | "proposal" | "won" | "lost";

export interface FormSettings {
  submitButtonText?: string;
  successMessage?: string;
  autoCreateDeal?: boolean;
  defaultDealStage?: DealStage;
  defaultDealValue?: number;
  redirectUrl?: string;
}

export interface FormRow {
  id: string;
  organizationId: string;
  title: string;
  slug: string;
  description: string | null;
  isPublished: boolean;
  fields: FormField[];
  settings: FormSettings;
  submissionsCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface FormSubmissionRow {
  id: string;
  formId: string;
  organizationId: string;
  data: Record<string, unknown>;
  contactId: string | null;
  dealId: string | null;
  ipHash: string | null;
  createdAt: string;
  contact?: {
    id: string;
    name: string;
    email: string;
    company?: string | null;
    phone?: string | null;
  } | null;
  deal?: {
    id: string;
    title: string;
    value: number;
    currency: string;
    stage: string;
  } | null;
}

export interface PublicFormData {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  isPublished: boolean;
  fields: FormField[];
  settings: {
    submitButtonText: string;
    successMessage: string;
    redirectUrl?: string | null;
  };
  organizationName: string;
}

export interface FormValidationErrors {
  titleRequired?: string;
  titleMax?: string;
  slugInvalid?: string;
  slugRequired?: string;
  descriptionMax?: string;
  fieldsRequired?: string;
  fieldLabelRequired?: string;
  dealValueInvalid?: string;
  redirectUrlInvalid?: string;
}

export const formFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().trim().min(1, { message: "Field label is required" }),
  type: z.enum(["text", "email", "phone", "textarea", "select", "number"]),
  required: z.boolean().default(false),
  placeholder: z.string().optional(),
  options: z.array(z.string()).optional(),
  helpText: z.string().optional(),
});

export const formSettingsSchema = z.object({
  submitButtonText: z.string().trim().max(100).optional(),
  successMessage: z.string().trim().max(1000).optional(),
  autoCreateDeal: z.boolean().optional(),
  defaultDealStage: z
    .enum(["lead", "contacted", "proposal", "won", "lost"])
    .optional(),
  defaultDealValue: z.number().min(0).optional(),
  redirectUrl: z
    .string()
    .trim()
    .url()
    .or(z.literal(""))
    .optional(),
});

export function createFormInputSchema(errors?: FormValidationErrors) {
  return z.object({
    title: z
      .string()
      .trim()
      .min(1, { message: errors?.titleRequired ?? "Title is required" })
      .max(200, {
        message: errors?.titleMax ?? "Title must be 200 characters or fewer",
      }),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(2, {
        message: errors?.slugInvalid ?? "Slug must be at least 2 characters",
      })
      .max(100)
      .regex(/^[a-z0-9-_]+$/, {
        message:
          errors?.slugInvalid ??
          "Slug can only contain lowercase letters, numbers, hyphens, and underscores",
      }),
    description: z
      .string()
      .trim()
      .max(1000, {
        message:
          errors?.descriptionMax ??
          "Description must be 1000 characters or fewer",
      })
      .optional()
      .nullable(),
    isPublished: z.boolean().default(true),
    fields: z
      .array(formFieldSchema)
      .min(1, {
        message: errors?.fieldsRequired ?? "Add at least one field to your form",
      }),
    settings: formSettingsSchema.optional().default({}),
  });
}

export type CreateFormInput = z.infer<ReturnType<typeof createFormInputSchema>>;
export type UpdateFormInput = CreateFormInput;
