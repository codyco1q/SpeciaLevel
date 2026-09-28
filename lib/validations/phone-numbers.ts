import { z } from "zod";

export const CARRIER_PROVIDERS = ["twilio", "telnyx", "custom"] as const;
export type CarrierProviderType = (typeof CARRIER_PROVIDERS)[number];

export const carrierSettingsSchema = z.object({
  provider: z.enum(CARRIER_PROVIDERS),
  accountSid: z.string().trim().max(100).optional().or(z.literal("")),
  authToken: z.string().trim().max(200).optional().or(z.literal("")),
  apiKeySid: z.string().trim().max(100).optional().or(z.literal("")),
  apiKeySecret: z.string().trim().max(200).optional().or(z.literal("")),
  twimlAppSid: z.string().trim().max(100).optional().or(z.literal("")),
  isActive: z.boolean(),
});

export type CarrierSettingsFormValues = z.infer<typeof carrierSettingsSchema>;

export const phoneNumberSchema = z.object({
  phoneNumber: z
    .string()
    .trim()
    .min(1, "Phone number is required.")
    .max(30, "Phone number must be 30 characters or fewer."),
  friendlyName: z
    .string()
    .trim()
    .max(100, "Friendly name must be 100 characters or fewer.")
    .optional()
    .or(z.literal("")),
  capabilities: z.object({
    voice: z.boolean(),
    sms: z.boolean(),
  }),
  status: z.enum(["active", "inactive", "pending"]),
  assignedUserId: z.string().uuid().nullable().optional().or(z.literal("")),
});

export type PhoneNumberFormValues = z.infer<typeof phoneNumberSchema>;

