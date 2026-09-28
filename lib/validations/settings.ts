import { z } from "zod";

export * from "./organizations";

/** Localized string messages consumed by profile schema. */
export interface ProfileValidationMessages {
  fullNameRequired: string;
  fullNameMax: string;
  jobTitleMax: string;
}

export const DEFAULT_PROFILE_VALIDATION_MESSAGES: ProfileValidationMessages = {
  fullNameRequired: "Full name is required.",
  fullNameMax: "Full name must be 120 characters or fewer.",
  jobTitleMax: "Job title must be 100 characters or fewer.",
};

export function createProfileSchema(
  messages: ProfileValidationMessages = DEFAULT_PROFILE_VALIDATION_MESSAGES
) {
  return z.object({
    full_name: z
      .string()
      .trim()
      .min(1, messages.fullNameRequired)
      .max(120, messages.fullNameMax),
    job_title: z
      .string()
      .trim()
      .max(100, messages.jobTitleMax)
      .optional()
      .or(z.literal("")),
  });
}

export const profileSchema = createProfileSchema();
export type ProfileSettingsValues = z.infer<typeof profileSchema>;


