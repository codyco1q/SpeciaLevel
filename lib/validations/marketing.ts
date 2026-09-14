import { z } from "zod";

/**
 * Shared Zod schemas for the Marketing module (create + update).
 * Used client-side (campaign dialog) and re-validated server-side in
 * lib/actions/marketing.ts.
 *
 * i18n: validation messages are parameterized through the
 * `createCampaignInputSchema(messages)` factory so the client forms
 * and the server actions can pass localized messages from the active
 * dictionary. The exported `campaignInputSchema` keeps the English
 * defaults as a fallback.
 *
 * Field names are camelCase over the wire; they are mapped to the
 * snake_case DB columns inside the server actions. Optional text
 * fields may arrive as empty strings from the form — they are
 * normalized to null before the insert/update.
 */

/** Every channel the platform tracks campaigns on. */
export const MARKETING_CHANNELS = [
  "meta",
  "google",
  "email",
  "content",
  "linkedin",
  "other",
] as const;

export type MarketingChannel = (typeof MARKETING_CHANNELS)[number];

/** Campaign lifecycle statuses (the DB default is 'draft'). */
export const MARKETING_STATUSES = [
  "draft",
  "active",
  "paused",
  "completed",
] as const;

export type MarketingStatus = (typeof MARKETING_STATUSES)[number];

/** Localized string messages consumed by the campaign schema. */
export interface MarketingValidationMessages {
  nameRequired: string;
  nameMax: string;
  descriptionMax: string;
  channelRequired: string;
  statusRequired: string;
  budgetInvalid: string;
  spendInvalid: string;
  targetAudienceMax: string;
  utmInvalid: string;
  dateInvalid: string;
}

export const DEFAULT_MARKETING_VALIDATION_MESSAGES: MarketingValidationMessages =
  {
    nameRequired: "Campaign name is required.",
    nameMax: "Campaign name must be 100 characters or fewer.",
    descriptionMax: "Description must be 400 characters or fewer.",
    channelRequired: "Select a channel.",
    statusRequired: "Select a status.",
    budgetInvalid: "Enter a valid budget (0 or more).",
    spendInvalid: "Enter valid spend (0 or more).",
    targetAudienceMax: "Target audience must be 400 characters or fewer.",
    utmInvalid: "UTM campaign must be 100 characters or fewer.",
    dateInvalid: "The end date must be on or after the start date.",
  };

/**
 * NUMERIC(12, 2) cap from the DB column. Kept in sync with the
 * 00018 migration's check constraints (>= 0, 12 integer digits).
 */
const MAX_MONEY = 9_999_999_999.99;

/** Money input — plain controlled `z.number()`, like the invoice schema. */
const moneyField = (message: string) =>
  z
    .number({ error: message })
    .min(0, message)
    .max(MAX_MONEY, message);

/** Optional text field that may arrive as an empty string from forms. */
const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .or(z.literal(""));

export function createCampaignInputSchema(
  messages: MarketingValidationMessages = DEFAULT_MARKETING_VALIDATION_MESSAGES
) {
  return z
    .object({
      name: z
        .string()
        .trim()
        .min(1, messages.nameRequired)
        .max(100, messages.nameMax),
      description: optionalText(400, messages.descriptionMax),
      channel: z.enum(MARKETING_CHANNELS, {
        message: messages.channelRequired,
      }),
      status: z.enum(MARKETING_STATUSES, {
        message: messages.statusRequired,
      }),
      budget: moneyField(messages.budgetInvalid),
      spend: moneyField(messages.spendInvalid),
      startDate: optionalText(10, messages.dateInvalid),
      endDate: optionalText(10, messages.dateInvalid),
      targetAudience: optionalText(400, messages.targetAudienceMax),
      utmCampaign: optionalText(100, messages.utmInvalid),
    })
    .refine(
      (data) => !data.startDate || !data.endDate || data.endDate >= data.startDate,
      { message: messages.dateInvalid, path: ["endDate"] }
    );
}

/** English-default instance for callers that don't need localization. */
export const campaignInputSchema = createCampaignInputSchema(
  DEFAULT_MARKETING_VALIDATION_MESSAGES
);

/** Client-facing form values for the create/edit campaign dialog. */
export type CampaignFormValues = z.infer<
  ReturnType<typeof createCampaignInputSchema>
>;

/** Validates a campaign id before it touches the DB (localized message). */
export function campaignIdSchema(idInvalidMessage: string) {
  return z.object({ id: z.string().min(1, idInvalidMessage) });
}

/** State returned by campaign server actions. */
export interface CampaignActionState {
  status: "idle" | "success" | "error";
  error?: string | null;
  fieldErrors?: Partial<Record<keyof CampaignFormValues, string[] | undefined>>;
}

export const initialCampaignActionState: CampaignActionState = {
  status: "idle",
};