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

// ============================================================
// Social Media Planner Validations & Constants
// ============================================================

export const MARKETING_SOCIAL_PLATFORMS = [
  "facebook",
  "instagram",
  "twitter",
  "linkedin",
] as const;

export type MarketingSocialPlatform = (typeof MARKETING_SOCIAL_PLATFORMS)[number];

export const MARKETING_SOCIAL_STATUSES = [
  "draft",
  "scheduled",
  "published",
  "failed",
] as const;

export type MarketingSocialPostStatus = (typeof MARKETING_SOCIAL_STATUSES)[number];

export const saveSocialPostSchema = z.object({
  id: z.string().uuid().optional(),
  content: z
    .string()
    .trim()
    .min(1, "Post content cannot be empty.")
    .max(5000, "Content exceeds 5,000 characters."),
  mediaUrls: z.array(z.string().url("Invalid media URL.")).default([]),
  platforms: z
    .array(z.enum(MARKETING_SOCIAL_PLATFORMS))
    .min(1, "Select at least one platform."),
  status: z.enum(MARKETING_SOCIAL_STATUSES).default("draft"),
  scheduledFor: z.string().nullable().optional(),
});

export type SaveSocialPostInput = z.infer<typeof saveSocialPostSchema>;

export const deleteSocialPostSchema = z.object({
  id: z.string().uuid("Invalid post ID."),
});

// ============================================================
// Email Template Studio Validations & HTML Compiler
// ============================================================

export const EMAIL_BLOCK_TYPES = [
  "header",
  "text",
  "button",
  "divider",
  "spacer",
  "image",
] as const;

export const emailBlockStyleSchema = z.object({
  textColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  fontSize: z.number().optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  paddingTop: z.number().optional(),
  paddingBottom: z.number().optional(),
  paddingLeft: z.number().optional(),
  paddingRight: z.number().optional(),
  borderRadius: z.number().optional(),
  buttonColor: z.string().optional(),
  buttonTextColor: z.string().optional(),
  lineHeight: z.number().optional(),
  fontWeight: z.string().optional(),
}).optional();

export const emailBlockSchema = z.object({
  id: z.string().min(1),
  type: z.enum(EMAIL_BLOCK_TYPES),
  content: z.object({
    text: z.string().optional(),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
    buttonText: z.string().optional(),
    buttonUrl: z.string().optional(),
    imageUrl: z.string().optional(),
    imageAlt: z.string().optional(),
    imageWidth: z.number().optional(),
    spacerHeight: z.number().optional(),
    dividerColor: z.string().optional(),
  }).default({}),
  style: emailBlockStyleSchema,
});

export const saveEmailTemplateSchema = z.object({
  id: z.string().uuid().optional(),
  name: z
    .string()
    .trim()
    .min(1, "Template name is required.")
    .max(120, "Name must be 120 characters or fewer."),
  subject: z
    .string()
    .trim()
    .min(1, "Subject line is required.")
    .max(200, "Subject must be 200 characters or fewer."),
  previewText: z
    .string()
    .trim()
    .max(250, "Preview text must be 250 characters or fewer.")
    .optional()
    .nullable(),
  bodyJson: z.array(emailBlockSchema).default([]),
  bodyHtml: z.string().optional(),
});

export type SaveEmailTemplateInput = z.infer<typeof saveEmailTemplateSchema>;

export const deleteEmailTemplateSchema = z.object({
  id: z.string().uuid("Invalid template ID."),
});

export const sendTestEmailSchema = z.object({
  templateId: z.string().uuid("Invalid template ID.").optional(),
  toEmail: z.string().email("Please enter a valid email address."),
  subject: z.string().optional(),
  bodyHtml: z.string().optional(),
});

/**
 * Compiles an array of structured email blocks into responsive, email-client-ready HTML.
 */
export function compileEmailBlocksToHtml(blocks: z.infer<typeof emailBlockSchema>[]): string {
  const renderedBlocks = blocks
    .map((block) => {
      const style = block.style || {};
      const align = style.textAlign || "left";
      const padTop = style.paddingTop ?? 12;
      const padBottom = style.paddingBottom ?? 12;
      const padLeft = style.paddingLeft ?? 16;
      const padRight = style.paddingRight ?? 16;
      const textColor = style.textColor || "#1e293b";
      const bg = style.backgroundColor ? `background-color: ${style.backgroundColor};` : "";

      const containerStyle = `padding: ${padTop}px ${padRight}px ${padBottom}px ${padLeft}px; text-align: ${align}; ${bg}`;

      switch (block.type) {
        case "header": {
          const level = block.content.level || 1;
          const fontSize = style.fontSize || (level === 1 ? 26 : level === 2 ? 22 : 18);
          return `
            <tr>
              <td style="${containerStyle}">
                <h${level} style="margin: 0; color: ${textColor}; font-size: ${fontSize}px; font-weight: 700; line-height: 1.3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                  ${block.content.text || "Header Title"}
                </h${level}>
              </td>
            </tr>
          `;
        }
        case "text": {
          const fontSize = style.fontSize || 15;
          const formatted = (block.content.text || "Enter your text here...")
            .replace(/\n/g, "<br />");
          return `
            <tr>
              <td style="${containerStyle}">
                <p style="margin: 0; color: ${textColor}; font-size: ${fontSize}px; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                  ${formatted}
                </p>
              </td>
            </tr>
          `;
        }
        case "button": {
          const btnBg = style.buttonColor || "#2563eb";
          const btnTextColor = style.buttonTextColor || "#ffffff";
          const radius = style.borderRadius ?? 6;
          const btnText = block.content.buttonText || "Call to Action";
          const btnUrl = block.content.buttonUrl || "https://example.com";
          return `
            <tr>
              <td style="${containerStyle}">
                <a href="${btnUrl}" target="_blank" style="display: inline-block; background-color: ${btnBg}; color: ${btnTextColor}; font-size: 15px; font-weight: 600; text-decoration: none; padding: 12px 24px; border-radius: ${radius}px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                  ${btnText}
                </a>
              </td>
            </tr>
          `;
        }
        case "image": {
          const imgUrl = block.content.imageUrl || "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=800&q=80";
          const alt = block.content.imageAlt || "Marketing Visual";
          const width = block.content.imageWidth || 560;
          return `
            <tr>
              <td style="${containerStyle}">
                <img src="${imgUrl}" alt="${alt}" width="${width}" style="max-width: 100%; height: auto; border: 0; display: inline-block; border-radius: 6px;" />
              </td>
            </tr>
          `;
        }
        case "divider": {
          const color = block.content.dividerColor || "#e2e8f0";
          return `
            <tr>
              <td style="${containerStyle}">
                <hr style="border: 0; border-top: 1px solid ${color}; margin: 0;" />
              </td>
            </tr>
          `;
        }
        case "spacer": {
          const height = block.content.spacerHeight || 24;
          return `
            <tr>
              <td height="${height}" style="font-size: 0; line-height: 0;">&nbsp;</td>
            </tr>
          `;
        }
        default:
          return "";
      }
    })
    .join("\n");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Marketing Email</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">
          ${renderedBlocks}
          <tr>
            <td style="padding: 24px 16px; text-align: center; border-top: 1px solid #f1f5f9; background-color: #f8fafc;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                You received this email because you are connected with us.<br />
                {{organization.name}} &bull; All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/** Starter email templates to jumpstart users. */
export const STARTER_EMAIL_TEMPLATES = [
  {
    name: "Welcome Onboarding",
    subject: "Welcome to {{organization.name}}! 🎉",
    previewText: "We're excited to have you on board.",
    bodyJson: [
      {
        id: "b-1",
        type: "header" as const,
        content: { text: "Welcome to {{organization.name}}!", level: 1 as const },
        style: { textAlign: "center" as const, fontSize: 26, textColor: "#0f172a" },
      },
      {
        id: "b-2",
        type: "text" as const,
        content: {
          text: "Hi {{contact.name}},\n\nThank you for choosing {{organization.name}}. We're thrilled to partner with you to help you achieve your goals.\n\nTo get started, click the button below to explore your portal and resources.",
        },
        style: { fontSize: 15, textColor: "#334155" },
      },
      {
        id: "b-3",
        type: "button" as const,
        content: { buttonText: "Get Started Now", buttonUrl: "https://example.com/portal" },
        style: { textAlign: "center" as const, buttonColor: "#2563eb", buttonTextColor: "#ffffff" },
      },
      {
        id: "b-4",
        type: "divider" as const,
        content: { dividerColor: "#e2e8f0" },
      },
      {
        id: "b-5",
        type: "text" as const,
        content: {
          text: "If you have any questions, simply reply to this email. Our support team is here for you 24/7.",
        },
        style: { fontSize: 13, textColor: "#64748b", textAlign: "center" as const },
      },
    ],
  },
  {
    name: "Special Promotion Offer",
    subject: "Exclusive Offer for You, {{contact.name}} ⚡",
    previewText: "Limited-time promotion on all new services.",
    bodyJson: [
      {
        id: "b-promo-1",
        type: "header" as const,
        content: { text: "Special Limited-Time Offer", level: 1 as const },
        style: { textAlign: "center" as const, fontSize: 26, textColor: "#1e1b4b" },
      },
      {
        id: "b-promo-2",
        type: "text" as const,
        content: {
          text: "Hi {{contact.name}},\n\nFor a limited time, take advantage of our exclusive seasonal packages tailored specifically for your business.",
        },
        style: { fontSize: 15, textColor: "#334155" },
      },
      {
        id: "b-promo-3",
        type: "button" as const,
        content: { buttonText: "Claim Your Discount", buttonUrl: "https://example.com/offers" },
        style: { textAlign: "center" as const, buttonColor: "#7c3aed", buttonTextColor: "#ffffff" },
      },
    ],
  },
];

