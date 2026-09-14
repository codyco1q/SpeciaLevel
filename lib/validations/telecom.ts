import { z } from "zod";

/**
 * Shared Zod schemas for the Telecommunications module (log call + SMS).
 * Used client-side (log call / send SMS dialogs) and re-validated
 * server-side in lib/actions/telecom.ts.
 *
 * i18n: validation messages are parameterized through the
 * `createCallLogInputSchema(messages)` / `createSmsInputSchema(messages)`
 * factories so the client forms and the server actions can pass localized
 * messages from the active dictionary. The exported default instances keep
 * the English fallbacks.
 *
 * Field names are camelCase over the wire; they are mapped to the
 * snake_case DB columns inside the server actions. Optional text fields
 * may arrive as empty strings from the form — they are normalized to null
 * before the insert.
 */

/** Every call direction the platform tracks. */
export const TELECOM_DIRECTIONS = ["inbound", "outbound"] as const;

export type TelecomDirection = (typeof TELECOM_DIRECTIONS)[number];

/** Call outcome statuses (the DB default is 'completed'). */
export const TELECOM_CALL_STATUSES = [
  "completed",
  "missed",
  "busy",
  "failed",
  "voicemail",
] as const;

export type TelecomCallStatus = (typeof TELECOM_CALL_STATUSES)[number];

/** SMS delivery statuses (the DB default is 'delivered'). */
export const TELECOM_SMS_STATUSES = [
  "sent",
  "delivered",
  "failed",
  "received",
] as const;

export type TelecomSmsStatus = (typeof TELECOM_SMS_STATUSES)[number];

/** Localized string messages consumed by the telecom schemas. */
export interface TelecomValidationMessages {
  directionRequired: string;
  statusRequired: string;
  fromNumberRequired: string;
  toNumberRequired: string;
  numberMax: string;
  durationInvalid: string;
  recordingUrlInvalid: string;
  summaryMax: string;
  bodyRequired: string;
  bodyMax: string;
}

export const DEFAULT_TELECOM_VALIDATION_MESSAGES: TelecomValidationMessages =
  {
    directionRequired: "Select a direction.",
    statusRequired: "Select an outcome.",
    fromNumberRequired: "Enter the from number.",
    toNumberRequired: "Enter the to number.",
    numberMax: "Number must be 25 characters or fewer.",
    durationInvalid: "Enter a valid duration in seconds.",
    recordingUrlInvalid: "Recording URL must be 500 characters or fewer.",
    summaryMax: "Summary must be 1000 characters or fewer.",
    bodyRequired: "Message body is required.",
    bodyMax: "Message must be 1600 characters or fewer.",
  };

/** Number cap mirrors the DB check constraint source of truth. */
const MAX_PHONE_LENGTH = 25;

/** Phone-like string — non-blank, without an aggressive pattern check. */
const phoneField = (required: string, tooLong: string) =>
  z
    .string()
    .trim()
    .min(1, required)
    .max(MAX_PHONE_LENGTH, tooLong);

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .or(z.literal(""));

/** Optional contact selector value ('' from the form = no contact). */
const optionalContactId = z
  .string()
  .trim()
  .min(1)
  .optional()
  .or(z.literal(""));

/** 24h in seconds — hard upper bound so metrics never overflow. */
const MAX_DURATION_SECONDS = 24 * 60 * 60;

const durationField = (message: string) =>
  z
    .number({ error: message })
    .int({ error: message })
    .min(0, message)
    .max(MAX_DURATION_SECONDS, message);

export function createCallLogInputSchema(
  messages: TelecomValidationMessages = DEFAULT_TELECOM_VALIDATION_MESSAGES
) {
  return z.object({
    contactId: optionalContactId,
    direction: z.enum(TELECOM_DIRECTIONS, {
      message: messages.directionRequired,
    }),
    status: z.enum(TELECOM_CALL_STATUSES, {
      message: messages.statusRequired,
    }),
    fromNumber: phoneField(messages.fromNumberRequired, messages.numberMax),
    toNumber: phoneField(messages.toNumberRequired, messages.numberMax),
    durationSeconds: durationField(messages.durationInvalid),
    recordingUrl: optionalText(500, messages.recordingUrlInvalid),
    summary: optionalText(1000, messages.summaryMax),
  });
}

/** English-default instance for callers that don't need localization. */
export const callLogInputSchema = createCallLogInputSchema(
  DEFAULT_TELECOM_VALIDATION_MESSAGES
);

/** Client-facing form values for the log-call dialog / quick dialer. */
export type CallLogFormValues = z.infer<
  ReturnType<typeof createCallLogInputSchema>
>;

export function createSmsInputSchema(
  messages: TelecomValidationMessages = DEFAULT_TELECOM_VALIDATION_MESSAGES
) {
  return z.object({
    contactId: optionalContactId,
    direction: z.enum(TELECOM_DIRECTIONS, {
      message: messages.directionRequired,
    }),
    fromNumber: phoneField(messages.fromNumberRequired, messages.numberMax),
    toNumber: phoneField(messages.toNumberRequired, messages.numberMax),
    body: z
      .string()
      .trim()
      .min(1, messages.bodyRequired)
      .max(1600, messages.bodyMax),
  });
}

/** English-default SMS schema instance. */
export const smsInputSchema = createSmsInputSchema(
  DEFAULT_TELECOM_VALIDATION_MESSAGES
);

/** Client-facing form values for the send-SMS dialog. */
export type SmsFormValues = z.infer<ReturnType<typeof createSmsInputSchema>>;

/** Validates a telecom record id before it touches the DB (localized). */
export function telecomIdSchema(idInvalidMessage: string) {
  return z.object({ id: z.string().min(1, idInvalidMessage) });
}

/** State returned by telecom server actions. */
export interface TelecomActionState {
  status: "idle" | "success" | "error";
  error?: string | null;
  fieldErrors?: Record<string, string[]>;
}

export const initialTelecomActionState: TelecomActionState = {
  status: "idle",
};