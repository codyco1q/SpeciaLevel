import { z } from "zod";

/**
 * Shared Zod schemas for the chat module (create channel + message content).
 * Used client-side (react-hook-form resolver) and re-validated
 * server-side in lib/actions/chat.ts.
 *
 * i18n: validation messages are parameterized through the
 * `createChannelInputSchema(messages)` / `createMessageContentSchema(messages)`
 * factories so the client forms and the server actions can pass localized
 * messages from the active dictionary. The exported `channelInputSchema` /
 * `messageContentSchema` keep the English defaults as a fallback.
 *
 * Field names are camelCase over the wire; they are mapped to the
 * snake_case DB columns inside the server actions.
 */

/** Localized string messages consumed by the channel + message schemas. */
export interface ChatValidationMessages {
  nameRequired: string;
  nameMax: string;
  nameFormat: string;
  descriptionMax: string;
  messageEmpty: string;
  messageMax: string;
}

export const DEFAULT_CHAT_VALIDATION_MESSAGES: ChatValidationMessages = {
  nameRequired: "Channel name is required.",
  nameMax: "Channel name must be 50 characters or fewer.",
  nameFormat:
    "Use lowercase letters, numbers, and dashes/underscores (e.g. 'general', 'product-launch').",
  descriptionMax: "Description must be 200 characters or fewer.",
  messageEmpty: "Message can't be empty.",
  messageMax: "Messages must be 2000 characters or fewer.",
};

/**
 * Channel names are lowercase kebab/snake-case slugs (e.g. "general",
 * "product-launch", "support_tickets"). Normalized to lowercase so a
 * friendly "General" input becomes "general"; the DB check constraint
 * mirrors this pattern.
 */
export function createChannelNameSchema(
  messages: ChatValidationMessages = DEFAULT_CHAT_VALIDATION_MESSAGES
) {
  return z
    .string()
    .trim()
    .toLowerCase()
    .min(1, messages.nameRequired)
    .max(50, messages.nameMax)
    .regex(/^[a-z0-9]+(?:[_-][a-z0-9]+)*$/, messages.nameFormat);
}

export function createChannelInputSchema(
  messages: ChatValidationMessages = DEFAULT_CHAT_VALIDATION_MESSAGES
) {
  return z.object({
    name: createChannelNameSchema(messages),
    description: z
      .string()
      .trim()
      .max(200, messages.descriptionMax)
      .optional()
      .or(z.literal("")),
    isPrivate: z.boolean().optional(),
  });
}

export function createMessageContentSchema(
  messages: ChatValidationMessages = DEFAULT_CHAT_VALIDATION_MESSAGES
) {
  return z
    .string()
    .trim()
    .min(1, messages.messageEmpty)
    .max(2000, messages.messageMax);
}

export const channelNameSchema = createChannelNameSchema();
export const channelInputSchema = createChannelInputSchema();
export const messageContentSchema = createMessageContentSchema();

export type ChannelFormValues = z.infer<typeof channelInputSchema>;

/** State returned by the createChannel server action. */
export interface CreateChannelState {
  status: "idle" | "success" | "error";
  error?: string | null;
  fieldErrors?: Partial<Record<keyof ChannelFormValues, string[] | undefined>>;
}

export const initialCreateChannelState: CreateChannelState = {
  status: "idle",
};