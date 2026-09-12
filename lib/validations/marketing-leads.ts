import { z } from "zod";

/**
 * Shared Zod schema for the SpeciaLevel marketing lead form.
 * Used both client-side (react-hook-form resolver) and server-side
 * (secure re-validation in the server action).
 *
 * i18n: validation messages are parameterized through
 * `createMarketingLeadSchema(messages)` so the contact form and the server
 * action can pass localized messages from the active dictionary. The
 * exported `marketingLeadSchema` keeps the English defaults as a fallback
 * for any caller that needs the schema without a locale.
 */

export const MARKETING_PACKAGE_OPTIONS = [
  { value: "not-sure", label: "Not sure yet — let's figure it out" },
  { value: "audit", label: "Automation Audit & Blueprint" },
  { value: "implementation", label: "Custom Systems Implementation" },
  { value: "retainer", label: "Managed Operations & Retainer" },
] as const;

/** Localized string messages consumed by the lead form schema. */
export interface MarketingLeadMessages {
  fieldNameMin: string;
  fieldNameMax: string;
  fieldEmailInvalid: string;
  fieldCompanyMin: string;
  fieldCompanyMax: string;
  fieldBottleneckMin: string;
  fieldBottleneckMax: string;
}

export const DEFAULT_MARKETING_LEAD_MESSAGES: MarketingLeadMessages = {
  fieldNameMin: "Please enter your full name.",
  fieldNameMax: "Name must be 120 characters or fewer.",
  fieldEmailInvalid: "Please enter a valid email address.",
  fieldCompanyMin: "Please enter your company name.",
  fieldCompanyMax: "Company must be 150 characters or fewer.",
  fieldBottleneckMin:
    "Give us a sentence or two about your current bottleneck or project scope.",
  fieldBottleneckMax: "Project details must be 2000 characters or fewer.",
};

export function createMarketingLeadSchema(
  messages: MarketingLeadMessages = DEFAULT_MARKETING_LEAD_MESSAGES
) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(2, messages.fieldNameMin)
      .max(120, messages.fieldNameMax),
    email: z.string().trim().email(messages.fieldEmailInvalid),
    company: z
      .string()
      .trim()
      .min(2, messages.fieldCompanyMin)
      .max(150, messages.fieldCompanyMax),
    bottleneck: z
      .string()
      .trim()
      .min(10, messages.fieldBottleneckMin)
      .max(2000, messages.fieldBottleneckMax),
    packageOfInterest: z.enum([
      "not-sure",
      "audit",
      "implementation",
      "retainer",
    ]),
  });
}

export const marketingLeadSchema = createMarketingLeadSchema();

export type MarketingLeadFormValues = z.infer<ReturnType<typeof createMarketingLeadSchema>>;

/**
 * State returned by the submitMarketingLead server action.
 * Consumed by useActionState in the contact form.
 */
export interface MarketingLeadState {
  status: "idle" | "success" | "error";
  error?: string | null;
  fieldErrors?: Partial<
    Record<keyof MarketingLeadFormValues, string[] | undefined>
  >;
}

export const initialMarketingLeadState: MarketingLeadState = {
  status: "idle",
};