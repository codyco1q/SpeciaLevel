import { z } from "zod";

/**
 * Shared Zod schemas for the Automations module (create + toggle).
 * Used client-side (creation dialog) and re-validated server-side in
 * lib/actions/automations.ts.
 *
 * i18n: validation messages are parameterized through the
 * `createAutomationInputSchema(messages)` factory so the client forms
 * and the server actions can pass localized messages from the active
 * dictionary. The exported `automationInputSchema` keeps the English
 * defaults as a fallback.
 *
 * Field names are camelCase over the wire; they are mapped to the
 * snake_case DB columns inside the server actions. `actionConfig` is
 * a discriminated config object per action type:
 *
 *   webhook       -> { url: string }
 *   chat_message  -> { channelId: string; message: string }
 *   create_task   -> { taskTitle: string; assigneeId?: string }
 */

/** Localized string messages consumed by the automation schemas. */
export interface AutomationValidationMessages {
  nameRequired: string;
  nameMax: string;
  descriptionMax: string;
  triggerRequired: string;
  actionRequired: string;
  webhookUrlRequired: string;
  webhookUrlInvalid: string;
  channelRequired: string;
  messageRequired: string;
  messageMax: string;
  taskTitleRequired: string;
  taskTitleMax: string;
  assigneeInvalid: string;
  invalidConfig: string;
}

export const DEFAULT_AUTOMATION_VALIDATION_MESSAGES: AutomationValidationMessages =
  {
    nameRequired: "Automation name is required.",
    nameMax: "Automation name must be 100 characters or fewer.",
    descriptionMax: "Description must be 400 characters or fewer.",
    triggerRequired: "Select a trigger event.",
    actionRequired: "Select an action type.",
    webhookUrlRequired: "Webhook URL is required.",
    webhookUrlInvalid: "Enter a valid HTTPS URL.",
    channelRequired: "Select a channel.",
    messageRequired: "Message can't be empty.",
    messageMax: "Messages must be 500 characters or fewer.",
    taskTitleRequired: "Task title is required.",
    taskTitleMax: "Task titles must be 100 characters or fewer.",
    assigneeInvalid: "Select a valid team member.",
    invalidConfig: "Invalid configuration for this action.",
  };

/** All trigger events supported by the execution runner. */
export const AUTOMATION_TRIGGER_EVENTS = [
  "lead.created",
  "deal.stage_changed",
  "invoice.paid",
  "task.completed",
] as const;

export type AutomationTriggerEvent = (typeof AUTOMATION_TRIGGER_EVENTS)[number];

/** All action types supported by the execution runner. */
export const AUTOMATION_ACTION_TYPES = [
  "webhook",
  "chat_message",
  "create_task",
] as const;

export type AutomationActionType = (typeof AUTOMATION_ACTION_TYPES)[number];

const getUrlError = (messages: AutomationValidationMessages) =>
  messages.webhookUrlInvalid;

/** A webhook URL must be an absolute http(s) URL (harmless for local hooks). */
export function webhookUrlSchema(
  messages: AutomationValidationMessages = DEFAULT_AUTOMATION_VALIDATION_MESSAGES
) {
  return z
    .string()
    .trim()
    .min(1, messages.webhookUrlRequired)
    .url(getUrlError(messages))
    .refine((value) => /^https?:\/\//i.test(value), {
      message: messages.webhookUrlInvalid,
    });
}

/** Discriminated action config per action type. */
export function automationActionConfigSchema(
  messages: AutomationValidationMessages = DEFAULT_AUTOMATION_VALIDATION_MESSAGES
) {
  return z.discriminatedUnion("actionType", [
    z.object({
      actionType: z.literal("webhook"),
      url: webhookUrlSchema(messages),
    }),
    z.object({
      actionType: z.literal("chat_message"),
      channelId: z.string().min(1, messages.channelRequired),
      message: z
        .string()
        .trim()
        .min(1, messages.messageRequired)
        .max(500, messages.messageMax),
    }),
    z.object({
      actionType: z.literal("create_task"),
      taskTitle: z
        .string()
        .trim()
        .min(1, messages.taskTitleRequired)
        .max(100, messages.taskTitleMax),
      assigneeId: z
        .string()
        .optional()
        .or(z.literal(""))
        .transform((value) => (value ? value : undefined)),
    }),
  ]);
}

export function createAutomationInputSchema(
  messages: AutomationValidationMessages = DEFAULT_AUTOMATION_VALIDATION_MESSAGES
) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, messages.nameRequired)
      .max(100, messages.nameMax),
    description: z
      .string()
      .trim()
      .max(400, messages.descriptionMax)
      .optional()
      .or(z.literal(""))
      .transform((value) => (value ? value : undefined)),
    triggerEvent: z.enum(AUTOMATION_TRIGGER_EVENTS, {
      message: messages.triggerRequired,
    }),
    actionConfig: automationActionConfigSchema(messages),
  });
}

export function automationToggleSchema(messages?: AutomationValidationMessages) {
  return z.object({
    id: z.string().min(1, messages?.nameRequired ?? "Invalid ID."),
    isActive: z.boolean(),
  });
}

export const automationInputSchema = createAutomationInputSchema(
  DEFAULT_AUTOMATION_VALIDATION_MESSAGES
);

/** Client-facing form values for the creation dialog (step 2 output). */
export type AutomationFormValues = z.infer<
  ReturnType<typeof createAutomationInputSchema>
>;

/** State returned by the createAutomation server action. */
export interface CreateAutomationState {
  status: "idle" | "success" | "error";
  error?: string | null;
  fieldErrors?: Partial<Record<keyof AutomationFormValues, string[] | undefined>>;
}

export const initialCreateAutomationState: CreateAutomationState = {
  status: "idle",
};