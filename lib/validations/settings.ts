import { z } from "zod";

/**
 * Zod schemas + shared types for the Settings module
 * (General Settings + Personal Profile tabs).
 */

export const organizationSettingsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Organization name must be at least 2 characters.")
    .max(100, "Organization name must be 100 characters or fewer."),
  timezone: z.string().trim().min(1, "Select a timezone."),
});

export const profileSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(1, "Full name is required.")
    .max(120, "Full name must be 120 characters or fewer."),
  job_title: z
    .string()
    .trim()
    .max(100, "Job title must be 100 characters or fewer.")
    .optional()
    .or(z.literal("")),
});

export type OrganizationSettingsValues = z.infer<
  typeof organizationSettingsSchema
>;
export type ProfileSettingsValues = z.infer<typeof profileSchema>;

export interface SettingsActionState {
  status: "idle" | "success" | "error";
  error?: string | null;
  fieldErrors?: Record<string, string[] | undefined>;
}

export const initialSettingsActionState: SettingsActionState = {
  status: "idle",
};

/**
 * Common IANA timezones offered in the General Settings tab.
 */
export const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: "UTC", label: "UTC (Coordinated Universal Time)" },
  { value: "America/New_York", label: "Eastern Time (ET) — New York" },
  { value: "America/Chicago", label: "Central Time (CT) — Chicago" },
  { value: "America/Denver", label: "Mountain Time (MT) — Denver" },
  { value: "America/Phoenix", label: "Arizona Time (MST, no DST) — Phoenix" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT) — Los Angeles" },
  { value: "America/Anchorage", label: "Alaska Time (AKT) — Anchorage" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT) — Honolulu" },
  { value: "America/Halifax", label: "Atlantic Time (AT) — Halifax" },
  { value: "America/St_Johns", label: "Newfoundland Time (NT) — St. John's" },
  { value: "America/Mexico_City", label: "Central Mexico — Mexico City" },
  { value: "America/Bogota", label: "Colombia Time (COT) — Bogotá" },
  { value: "America/Lima", label: "Peru Time (PET) — Lima" },
  { value: "America/Santiago", label: "Chile Time (CLT) — Santiago" },
  { value: "America/Sao_Paulo", label: "Brasília Time (BRT) — São Paulo" },
  { value: "America/Buenos_Aires", label: "Argentina Time (ART) — Buenos Aires" },
  { value: "Europe/London", label: "Greenwich Mean Time (GMT) — London" },
  { value: "Europe/Dublin", label: "Irish Standard Time — Dublin" },
  { value: "Europe/Lisbon", label: "Western European Time (WET) — Lisbon" },
  { value: "Europe/Madrid", label: "Central European Time (CET) — Madrid" },
  { value: "Europe/Paris", label: "Central European Time (CET) — Paris" },
  { value: "Europe/Amsterdam", label: "Central European Time (CET) — Amsterdam" },
  { value: "Europe/Berlin", label: "Central European Time (CET) — Berlin" },
  { value: "Europe/Zurich", label: "Central European Time (CET) — Zurich" },
  { value: "Europe/Rome", label: "Central European Time (CET) — Rome" },
  { value: "Europe/Stockholm", label: "Central European Time (CET) — Stockholm" },
  { value: "Europe/Vienna", label: "Central European Time (CET) — Vienna" },
  { value: "Europe/Warsaw", label: "Central European Time (CET) — Warsaw" },
  { value: "Europe/Prague", label: "Central European Time (CET) — Prague" },
  { value: "Europe/Budapest", label: "Central European Time (CET) — Budapest" },
  { value: "Europe/Athens", label: "Eastern European Time (EET) — Athens" },
  { value: "Europe/Helsinki", label: "Eastern European Time (EET) — Helsinki" },
  { value: "Europe/Istanbul", label: "Turkey Time (TRT) — Istanbul" },
  { value: "Europe/Moscow", label: "Moscow Time (MSK) — Moscow" },
  { value: "Africa/Cairo", label: "Egypt Standard Time — Cairo" },
  { value: "Africa/Casablanca", label: "Western European Time — Casablanca" },
  { value: "Africa/Lagos", label: "West Africa Time (WAT) — Lagos" },
  { value: "Africa/Accra", label: "Greenwich Mean Time (GMT) — Accra" },
  { value: "Africa/Nairobi", label: "East Africa Time (EAT) — Nairobi" },
  { value: "Africa/Johannesburg", label: "South Africa Standard Time (SAST)" },
  { value: "Asia/Dubai", label: "Gulf Standard Time (GST) — Dubai" },
  { value: "Asia/Riyadh", label: "Arabian Standard Time — Riyadh" },
  { value: "Asia/Tehran", label: "Iran Standard Time (IRST) — Tehran" },
  { value: "Asia/Karachi", label: "Pakistan Standard Time (PKT) — Karachi" },
  { value: "Asia/Kolkata", label: "India Standard Time (IST) — New Delhi" },
  { value: "Asia/Kathmandu", label: "Nepal Time (NPT) — Kathmandu" },
  { value: "Asia/Dhaka", label: "Bangladesh Standard Time (BST) — Dhaka" },
  { value: "Asia/Colombo", label: "Sri Lanka Standard Time (SLST) — Colombo" },
  { value: "Asia/Bangkok", label: "Indochina Time (ICT) — Bangkok" },
  { value: "Asia/Jakarta", label: "Western Indonesia Time (WIB) — Jakarta" },
  { value: "Asia/Singapore", label: "Singapore Time (SGT)" },
  { value: "Asia/Kuala_Lumpur", label: "Malaysia Time (MYT) — Kuala Lumpur" },
  { value: "Asia/Hong_Kong", label: "Hong Kong Time (HKT)" },
  { value: "Asia/Shanghai", label: "China Standard Time (CST) — Shanghai" },
  { value: "Asia/Taipei", label: "Taiwan Time (TWT) — Taipei" },
  { value: "Asia/Seoul", label: "Korea Standard Time (KST) — Seoul" },
  { value: "Asia/Tokyo", label: "Japan Standard Time (JST) — Tokyo" },
  { value: "Asia/Manila", label: "Philippine Time (PHT) — Manila" },
  { value: "Australia/Perth", label: "Australian Western Standard Time (AWST) — Perth" },
  { value: "Australia/Adelaide", label: "Australian Central Standard Time (ACST) — Adelaide" },
  { value: "Australia/Brisbane", label: "Australian Eastern Standard Time (AEST) — Brisbane" },
  { value: "Australia/Sydney", label: "Australian Eastern Time (AET) — Sydney" },
  { value: "Australia/Melbourne", label: "Australian Eastern Time (AET) — Melbourne" },
  { value: "Pacific/Auckland", label: "New Zealand Time (NZT) — Auckland" },
  { value: "Pacific/Fiji", label: "Fiji Time (FJT) — Suva" },
];