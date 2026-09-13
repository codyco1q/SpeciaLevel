import { z } from "zod"

/**
 * Shared Zod schemas for the AI module.
 *
 * Used client-side (custom-prompt dialog) and re-validated server-side in
 * `lib/actions/ai.ts` (create/update/toggle) and `lib/ai/execute.ts` (the
 * payload accepted by `executeAiTask` + POST /api/ai/execute).
 *
 * Mirrors the automations module conventions: validation messages are
 * parameterized through `createAiPromptSchema(messages)` so the client
 * forms and server actions pass localized messages from the active
 * dictionary, with English defaults as fallback.
 *
 * Field names are camelCase over the wire; the server actions map them to
 * the snake_case DB columns of `ai_prompts` / `ai_executions`.
 */

/** Localized string messages consumed by the AI schemas. */
export interface AiValidationMessages {
  nameRequired: string
  nameMax: string
  descriptionMax: string
  systemPromptMax: string
  templateRequired: string
  templateMax: string
  providerRequired: string
  modelNameRequired: string
  temperatureInvalid: string
  maxTokensInvalid: string
  invalidConfig: string
}

export const DEFAULT_AI_VALIDATION_MESSAGES: AiValidationMessages = {
  nameRequired: "Prompt name is required.",
  nameMax: "Prompt name must be 100 characters or fewer.",
  descriptionMax: "Description must be 400 characters or fewer.",
  systemPromptMax: "System prompt must be 4000 characters or fewer.",
  templateRequired: "The user template is required.",
  templateMax: "The user template must be 4000 characters or fewer.",
  providerRequired: "Select a model provider.",
  modelNameRequired: "Enter a model name.",
  temperatureInvalid: "Temperature must be between 0 and 2.",
  maxTokensInvalid: "Max tokens must be a number between 1 and 128000.",
  invalidConfig: "Invalid execution request.",
}

/** Model providers supported by the provider gateway (lib/ai/execute.ts). */
export const AI_MODEL_PROVIDERS = ["openai", "openrouter", "custom"] as const
export type AiModelProvider = (typeof AI_MODEL_PROVIDERS)[number]

/** Built-in quick tools executed with a fixed system prompt + raw input. */
export const AI_QUICK_TOOLS = [
  "summarize",
  "classify",
  "extract",
  "rewrite",
] as const
export type AiQuickTool = (typeof AI_QUICK_TOOLS)[number]

export function createAiPromptSchema(
  messages: AiValidationMessages = DEFAULT_AI_VALIDATION_MESSAGES
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
    modelProvider: z.enum(AI_MODEL_PROVIDERS, {
      message: messages.providerRequired,
    }),
    modelName: z
      .string()
      .trim()
      .min(1, messages.modelNameRequired)
      .max(100, messages.modelNameRequired),
    systemPrompt: z
      .string()
      .trim()
      .max(4000, messages.systemPromptMax)
      .optional()
      .or(z.literal(""))
      .transform((value) => (value ? value : undefined)),
    userTemplate: z
      .string()
      .trim()
      .min(1, messages.templateRequired)
      .max(4000, messages.templateMax),
    temperature: z
      .number({ message: messages.temperatureInvalid })
      .min(0, messages.temperatureInvalid)
      .max(2, messages.temperatureInvalid)
      .refine((value) => Number.isFinite(value), {
        message: messages.temperatureInvalid,
      }),
    maxTokens: z
      .number({ message: messages.maxTokensInvalid })
      .int(messages.maxTokensInvalid)
      .min(1, messages.maxTokensInvalid)
      .max(128000, messages.maxTokensInvalid)
      .optional()
      .or(z.null())
      .transform((value) => (value ? value : undefined)),
  })
}

const FALLBACK_INVALID = "Invalid ID."

export function aiPromptToggleSchema(
  messages?: Pick<AiValidationMessages, "invalidConfig">
) {
  return z.object({
    id: z.string().min(1, messages?.invalidConfig ?? FALLBACK_INVALID),
    isActive: z.boolean(),
  })
}

/**
 * Payload accepted by `executeAiTask` and POST /api/ai/execute.
 * The executor resolves a stored prompt (truthy `promptId`), a built-in
 * quick tool (truthy `toolKey`), or the raw playground when both are null.
 */
export function executeAiInputSchema(
  messages?: Pick<AiValidationMessages, "invalidConfig">
) {
  const invalid = messages?.invalidConfig ?? FALLBACK_INVALID
  return z.object({
    promptId: z.string().min(1, invalid).nullable().optional(),
    toolKey: z.enum(AI_QUICK_TOOLS, { message: invalid }).nullable().optional(),
    inputData: z.record(z.string(), z.unknown()).default({}),
  })
}

export const aiPromptInputSchema = createAiPromptSchema(
  DEFAULT_AI_VALIDATION_MESSAGES
)

/** Client-facing form values for the prompt dialog. */
export type AiPromptFormValues = z.infer<
  ReturnType<typeof createAiPromptSchema>
>