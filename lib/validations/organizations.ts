import { z } from "zod";

export interface OrganizationValidationMessages {
  orgNameMin: string;
  orgNameMax: string;
  selectTimezone: string;
  invalidEmail?: string;
}

export const DEFAULT_ORG_VALIDATION_MESSAGES: OrganizationValidationMessages = {
  orgNameMin: "Organization name must be at least 2 characters.",
  orgNameMax: "Organization name must be 100 characters or fewer.",
  selectTimezone: "Select a timezone.",
  invalidEmail: "Enter a valid email address.",
};

export const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD ($) — US Dollar", symbol: "$" },
  { value: "EGP", label: "EGP (E£) — Egyptian Pound", symbol: "E£" },
  { value: "AED", label: "AED (د.إ) — UAE Dirham", symbol: "د.إ" },
  { value: "SAR", label: "SAR (﷼) — Saudi Riyal", symbol: "﷼" },
  { value: "EUR", label: "EUR (€) — Euro", symbol: "€" },
  { value: "GBP", label: "GBP (£) — British Pound", symbol: "£" },
] as const;

export const DATE_FORMAT_OPTIONS = [
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD (2026-09-28)" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY (28/09/2026)" },
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY (09/28/2026)" },
  { value: "YYYY.MM.DD", label: "YYYY.MM.DD (2026.09.28)" },
  { value: "D MMMM YYYY", label: "D MMMM YYYY (28 September 2026)" },
] as const;

export const PAYMENT_TERMS_OPTIONS = [
  { value: "due_on_receipt", label: "Due on Receipt" },
  { value: "net_15", label: "Net 15 Days" },
  { value: "net_30", label: "Net 30 Days" },
  { value: "net_60", label: "Net 60 Days" },
] as const;

export const SESSION_TIMEOUT_OPTIONS = [
  { value: 0, label: "Disabled / No timeout" },
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 60, label: "1 hour" },
  { value: 240, label: "4 hours" },
  { value: 480, label: "8 hours" },
  { value: 1440, label: "24 hours" },
] as const;

export const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: "Africa/Cairo", label: "Egypt Standard Time — Cairo (UTC+2)" },
  { value: "Asia/Dubai", label: "Gulf Standard Time (GST) — Dubai (UTC+4)" },
  { value: "Asia/Riyadh", label: "Arabian Standard Time — Riyadh (UTC+3)" },
  { value: "UTC", label: "UTC (Coordinated Universal Time)" },
  { value: "America/New_York", label: "Eastern Time (ET) — New York" },
  { value: "America/Chicago", label: "Central Time (CT) — Chicago" },
  { value: "America/Denver", label: "Mountain Time (MT) — Denver" },
  { value: "America/Phoenix", label: "Arizona Time (MST, no DST) — Phoenix" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT) — Los Angeles" },
  { value: "Europe/London", label: "Greenwich Mean Time (GMT) — London" },
  { value: "Europe/Paris", label: "Central European Time (CET) — Paris" },
  { value: "Europe/Berlin", label: "Central European Time (CET) — Berlin" },
  { value: "Asia/Singapore", label: "Singapore Time (SGT)" },
  { value: "Asia/Tokyo", label: "Japan Standard Time (JST) — Tokyo" },
  { value: "Australia/Sydney", label: "Australian Eastern Time (AET) — Sydney" },
];

export function createOrganizationSettingsSchema(
  messages: OrganizationValidationMessages = DEFAULT_ORG_VALIDATION_MESSAGES
) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(2, messages.orgNameMin)
      .max(100, messages.orgNameMax),
    legal_name: z.string().trim().max(150).optional().or(z.literal("")),
    tax_id: z.string().trim().max(50).optional().or(z.literal("")),
    website: z.string().trim().max(255).optional().or(z.literal("")),
    contact_email: z
      .string()
      .trim()
      .email(messages.invalidEmail || "Invalid email")
      .optional()
      .or(z.literal("")),
    contact_phone: z.string().trim().max(50).optional().or(z.literal("")),
    address: z
      .object({
        street: z.string().trim().max(255).default(""),
        city: z.string().trim().max(100).default(""),
        state: z.string().trim().max(100).default(""),
        country: z.string().trim().max(100).default(""),
        postal_code: z.string().trim().max(30).default(""),
      })
      .default({
        street: "",
        city: "",
        state: "",
        country: "",
        postal_code: "",
      }),
    timezone: z.string().trim().min(1, messages.selectTimezone).default("Africa/Cairo"),
    default_currency: z.string().trim().default("USD"),
    date_format: z.string().trim().default("YYYY-MM-DD"),
    security_settings: z
      .object({
        allowed_domains: z.array(z.string().trim()).default([]),
        session_timeout_minutes: z.coerce.number().min(0).default(0),
        prevent_member_deletion: z.boolean().default(false),
      })
      .default({
        allowed_domains: [],
        session_timeout_minutes: 0,
        prevent_member_deletion: false,
      }),
    billing_defaults: z
      .object({
        payment_terms: z.string().trim().default("net_30"),
        default_tax_rate: z.coerce.number().min(0).max(100).default(0),
        bank_name: z.string().trim().max(150).default(""),
        iban: z.string().trim().max(60).default(""),
        swift: z.string().trim().max(30).default(""),
        instructions: z.string().trim().max(1000).default(""),
      })
      .default({
        payment_terms: "net_30",
        default_tax_rate: 0,
        bank_name: "",
        iban: "",
        swift: "",
        instructions: "",
      }),
    logo_url: z.string().nullable().optional(),
  });
}

export const organizationSettingsSchema = createOrganizationSettingsSchema();

export type OrganizationSettingsValues = z.infer<
  typeof organizationSettingsSchema
>;

export interface SettingsActionState {
  status: "idle" | "success" | "error";
  error?: string | null;
  fieldErrors?: Record<string, string[] | undefined>;
  logoUrl?: string | null;
}

export const initialSettingsActionState: SettingsActionState = {
  status: "idle",
};

export const generalBrandingSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Organization name must be at least 2 characters.")
    .max(100),
  legal_name: z.string().trim().max(150).optional().or(z.literal("")),
  tax_id: z.string().trim().max(50).optional().or(z.literal("")),
  website: z.string().trim().max(255).optional().or(z.literal("")),
  contact_email: z
    .string()
    .trim()
    .email("Invalid email")
    .optional()
    .or(z.literal("")),
  contact_phone: z.string().trim().max(50).optional().or(z.literal("")),
  timezone: z.string().trim().min(1),
  default_currency: z.string().trim().min(1),
  date_format: z.string().trim().min(1),
  address: z.object({
    street: z.string().trim(),
    city: z.string().trim(),
    state: z.string().trim(),
    country: z.string().trim(),
    postal_code: z.string().trim(),
  }),
});

export type GeneralBrandingValues = z.infer<typeof generalBrandingSchema>;

