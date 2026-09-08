import { z } from "zod";

/**
 * Shared Zod schema for the organization onboarding form.
 * Used both client-side (react-hook-form resolver) and
 * server-side (secure re-validation in the server action).
 */
export const onboardingSchema = z.object({
  organizationName: z
    .string()
    .trim()
    .min(2, "Organization name must be at least 2 characters.")
    .max(100, "Organization name must be 100 characters or fewer."),
});

export type OnboardingFormValues = z.infer<typeof onboardingSchema>;

/**
 * State returned by the createOrganization server action.
 * Consumed by useActionState in the onboarding form.
 */
export interface OnboardingState {
  status: "idle" | "error";
  error?: string | null;
  fieldErrors?: Partial<Record<keyof OnboardingFormValues, string[] | undefined>>;
}

export const initialOnboardingState: OnboardingState = {
  status: "idle",
};