import { z } from "zod";

/**
 * Shared Zod schema for the SpeciaLevel marketing lead form.
 * Used both client-side (react-hook-form resolver) and server-side
 * (secure re-validation in the server action).
 */

export const MARKETING_PACKAGE_OPTIONS = [
  { value: "not-sure", label: "Not sure yet — let's figure it out" },
  { value: "audit", label: "Automation Audit & Blueprint" },
  { value: "implementation", label: "Custom Systems Implementation" },
  { value: "retainer", label: "Managed Operations & Retainer" },
] as const;

export const marketingLeadSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Please enter your full name.")
    .max(120, "Name must be 120 characters or fewer."),
  email: z.string().trim().email("Please enter a valid email address."),
  company: z
    .string()
    .trim()
    .min(2, "Please enter your company name.")
    .max(150, "Company must be 150 characters or fewer."),
  bottleneck: z
    .string()
    .trim()
    .min(10, "Give us a sentence or two about your current bottleneck or project scope.")
    .max(2000, "Project details must be 2000 characters or fewer."),
  packageOfInterest: z.enum([
    "not-sure",
    "audit",
    "implementation",
    "retainer",
  ]),
});

export type MarketingLeadFormValues = z.infer<typeof marketingLeadSchema>;

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