import { z } from "zod";

/**
 * Shared Zod schemas for the chat module (create channel + message content).
 * Used client-side (react-hook-form resolver) and re-validated
 * server-side in lib/actions/chat.ts.
 *
 * Field names are camelCase over the wire; they are mapped to the
 * snake_case DB columns inside the server actions.
 */

/**
 * Channel names are lowercase kebab/snake-case slugs (e.g. "general",
 * "product-launch", "support_tickets"). Normalized to lowercase so a
 * friendly "General" input becomes "general"; the DB check constraint
 * mirrors this pattern.
 */
export const channelNameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Channel name is required.")
  .max(50, "Channel name must be 50 characters or fewer.")
  .regex(
    /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/,
    "Use lowercase letters, numbers, and dashes/underscores (e.g. 'general', 'product-launch')."
  );

export const channelInputSchema = z.object({
  name: channelNameSchema,
  description: z
    .string()
    .trim()
    .max(200, "Description must be 200 characters or fewer.")
    .optional()
    .or(z.literal("")),
  isPrivate: z.boolean().optional(),
});

export const messageContentSchema = z
  .string()
  .trim()
  .min(1, "Message can't be empty.")
  .max(2000, "Messages must be 2000 characters or fewer.");

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