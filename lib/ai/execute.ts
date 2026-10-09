import "server-only"

import { createServerClient } from "@/lib/supabase/server"
import { getDictionary } from "@/lib/i18n/get-dictionary"
import {
  executeAiInputSchema,
  type AiQuickTool,
} from "@/lib/validations/ai"

/**
 * Server-only AI execution engine — the single code path behind both
 * `executeAiTask` (server action) and POST /api/ai/execute.
 *
 * Resolves the effective configuration (stored prompt / quick tool /
 * raw playground), renders the user template with `inputData`, calls the
 * OpenAI-compatible chat-completions endpoint of the configured provider,
 * and records every run into `ai_executions` for the history drawer.
 *
 * Security: the provider API key lives only in `process.env.AI_API_KEY`
 * (never in the browser); `organizationId`/`userId` always come from the
 * caller's session, and stored prompts are looked up org-scoped.
 */

export interface AiRunRequest {
  organizationId: string
  userId: string
  payload: unknown
}

export type AiRunResult =
  | {
      status: "success"
      execution: {
        id: string
        output: string
        modelUsed: string | null
        durationMs: number | null
      }
    }
  | { status: "error"; error: string }

/** Hard cap on a single provider round-trip. */
const PROVIDER_TIMEOUT_MS = 60_000

const DEFAULT_SYSTEM_PROMPT =
  "You are a helpful assistant inside the UpLevel workspace. Write clear, concise, professional responses."

const QUICK_TOOL_SYSTEM_PROMPTS: Record<AiQuickTool, string> = {
  summarize:
    "Summarize the text below into concise bullet points covering the main topics, key decisions, and action items.",
  classify:
    "Classify the text below. Return a compact JSON object with exactly these keys: category, priority (low/medium/high), sentiment (positive/neutral/negative), and action_items (array of strings).",
  extract:
    "Extract the structured details from the text below. Return a compact JSON object with these keys: people (array of names), dates (array of dates), amounts (array of monetary values), and action_items (array of tasks).",
  rewrite:
    "Rewrite the text below to be clearer and more professional without changing its meaning. Keep the same length and structure.",
}

/** Known providers speak the OpenAI chat-completions dialect on these bases. */
const PROVIDER_BASE_URLS: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  custom_openai: "http://localhost:11434/v1",
  anthropic: "https://api.anthropic.com/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
}

function resolveBaseUrl(provider: string): string | null {
  if (provider === "custom" || provider === "custom_openai") {
    const customBase = process.env.AI_CUSTOM_API_BASE
    return customBase && customBase.trim()
      ? customBase.trim().replace(/\/+$/, "")
      : (PROVIDER_BASE_URLS[provider] ?? "http://localhost:11434/v1")
  }
  if (provider === "openai") {
    const openaiBase = process.env.OPENAI_BASE_URL
    return openaiBase && openaiBase.trim()
      ? openaiBase.trim().replace(/\/+$/, "")
      : PROVIDER_BASE_URLS.openai
  }
  return PROVIDER_BASE_URLS[provider] ?? null
}

/**
 * Replaces every `{key}` placeholder in a template with the matching value
 * from `variables` (strings verbatim, other values JSON-stringified), then
 * strips any leftover {placeholders} the caller didn't supply a value for.
 */
export function renderTemplate(
  template: string,
  variables: Record<string, unknown>
): string {
  let rendered = template
  for (const [key, value] of Object.entries(variables ?? {})) {
    const replacement =
      typeof value === "string"
        ? value
        : value === null || value === undefined
          ? ""
          : JSON.stringify(value)
    rendered = rendered.split(`{${key}}`).join(replacement)
  }
  return rendered.replace(/\{[\w.-]+\}/g, "")
}

function extractInput(inputData: Record<string, unknown>): string {
  const raw = inputData?.input
  if (typeof raw === "string") return raw.trim()
  if (raw === null || raw === undefined) return ""
  return typeof raw === "object" ? JSON.stringify(raw) : String(raw)
}

function extractChatContent(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null
  const choices = (payload as { choices?: unknown }).choices
  if (!Array.isArray(choices) || choices.length === 0) return null
  const first = choices[0] as
    | {
        message?: { content?: unknown }
      }
    | null
  const content = first?.message?.content
  return typeof content === "string" && content.trim().length > 0
    ? content
    : null
}

interface AiExecutionInsert {
  organization_id: string
  prompt_id: string | null
  tool_key: AiQuickTool | null
  status: "success" | "failed" | "running"
  model_used: string | null
  input_data: Record<string, unknown>
  output_text: string | null
  error_message: string | null
  duration_ms: number | null
  executed_by: string
}

async function recordExecution(payload: AiExecutionInsert): Promise<string | null> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from("ai_executions")
    .insert(payload)
    .select("id")
    .single()
  if (error) {
    console.error("[ai] execution record failed:", error.message)
    return null
  }
  return data?.id ?? null
}

export async function runPromptExecution(
  request: AiRunRequest
): Promise<AiRunResult> {
  const dict = await getDictionary()
  const errors = dict.platform.ai.errors

  const parsed = executeAiInputSchema().safeParse(request.payload)
  if (!parsed.success) {
    return { status: "error", error: errors.invalidConfig }
  }

  const { promptId = null, toolKey = null, inputData = {} } = parsed.data

  // Resolve the effective request: stored prompt, built-in quick tool,
  // or the raw playground (both keys empty).
  let modelProvider = "openai"
  let modelName = "gpt-4o-mini"
  let systemPrompt = DEFAULT_SYSTEM_PROMPT
  let userTemplate = "{input}"
  let temperature = 0.7
  let maxTokens: number | undefined

  const supabase = await createServerClient()

  if (promptId) {
    const { data: prompt } = await supabase
      .from("ai_prompts")
      .select(
        "id, model_provider, model_name, system_prompt, user_template, temperature, max_tokens, is_active"
      )
      .eq("id", promptId)
      .eq("organization_id", request.organizationId)
      .maybeSingle()

    if (!prompt || prompt.is_active === false) {
      return { status: "error", error: errors.notFound }
    }

    modelProvider = prompt.model_provider ?? "openai"
    modelName = prompt.model_name ?? "gpt-4o-mini"
    systemPrompt = prompt.system_prompt || DEFAULT_SYSTEM_PROMPT
    userTemplate = prompt.user_template
    temperature = Number(prompt.temperature ?? 0.7)
    maxTokens = prompt.max_tokens ?? undefined
  } else if (toolKey) {
    systemPrompt = QUICK_TOOL_SYSTEM_PROMPTS[toolKey]
    userTemplate = "{input}"
  }

  const input = extractInput(inputData)
  const attachments = Array.isArray(inputData?.attachments) ? inputData.attachments : []
  if (userTemplate.includes("{input}") && !input && attachments.length === 0) {
    return { status: "error", error: errors.inputRequired }
  }

  let renderedUserTemplate = renderTemplate(userTemplate, {
    ...inputData,
    input,
  })

  let apiKey: string | undefined = undefined
  let baseUrl: string | null = null

  // 1. Look up tenant's BYOK provider credentials from ai_model_providers table
  if (request.organizationId && request.organizationId !== "__api__") {
    const requestedProvider =
      typeof inputData?.modelProvider === "string"
        ? inputData.modelProvider
        : typeof inputData?.provider === "string"
          ? inputData.provider
          : null
    const requestedModel =
      typeof inputData?.modelName === "string"
        ? inputData.modelName
        : typeof inputData?.model === "string"
          ? inputData.model
          : null

    if (requestedProvider) {
      modelProvider = requestedProvider
    }
    if (requestedModel) {
      modelName = requestedModel
    }

    const { data: orgProviders } = await supabase
      .from("ai_model_providers")
      .select("provider, api_key_encrypted, base_url, default_model, is_active, updated_at")
      .eq("organization_id", request.organizationId)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })

    if (orgProviders && orgProviders.length > 0) {
      // Look for requested provider match (including custom vs custom_openai alias)
      let matched = orgProviders.find(
        (p) =>
          p.provider === modelProvider ||
          (modelProvider === "custom" && p.provider === "custom_openai") ||
          (modelProvider === "custom_openai" && p.provider === "custom")
      )

      // If no direct match and running raw playground, use the first active BYOK provider
      if (!matched && !promptId) {
        matched = orgProviders[0]
      }

      if (matched && matched.api_key_encrypted) {
        apiKey = matched.api_key_encrypted
        modelProvider = matched.provider
        baseUrl = matched.base_url?.trim()
          ? matched.base_url.trim().replace(/\/+$/, "")
          : resolveBaseUrl(matched.provider)

        if (!promptId && !requestedModel && matched.default_model) {
          modelName = matched.default_model
        }
      }
    }
  }

  // 2. Fall back to environment variables only if no BYOK provider was resolved from the database
  if (!apiKey) {
    apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY
    baseUrl =
      baseUrl ||
      resolveBaseUrl(modelProvider) ||
      process.env.AI_CUSTOM_API_BASE ||
      process.env.OPENAI_BASE_URL ||
      "https://api.openai.com/v1"
  }

  if (!apiKey || !baseUrl) {
    console.error("[ai] provider not configured for", modelProvider)
    return { status: "error", error: errors.providerNotConfigured }
  }

  const modelUsed = `${modelProvider}/${modelName}`
  const startedAt = Date.now()

  const failedExecution = (errorMessage: string) =>
    recordExecution({
      organization_id: request.organizationId,
      prompt_id: promptId,
      tool_key: toolKey,
      status: "failed",
      model_used: modelUsed,
      input_data: inputData,
      output_text: null,
      error_message: errorMessage,
      duration_ms: Date.now() - startedAt,
      executed_by: request.userId,
    })

  // Process attachments for multimodal/vision and document contexts
  const imageAttachments = attachments.filter((att: any) => {
    if (!att || typeof att !== "object") return false
    const url = att.dataUrl || att.data || att.url
    return (
      Boolean(url) &&
      (att.type?.startsWith("image/") || (typeof url === "string" && url.startsWith("data:image/")))
    )
  })
  const textAttachments = attachments.filter((att: any) => {
    if (!att || typeof att !== "object") return false
    const url = att.dataUrl || att.data || att.url
    return (
      !att.type?.startsWith("image/") &&
      (!url || (typeof url === "string" && !url.startsWith("data:image/")))
    )
  })

  for (const doc of textAttachments) {
    if (doc?.content) {
      renderedUserTemplate += `\n\n--- Attachment: ${doc.name || "Document"} ---\n${doc.content}`
    } else if (doc?.name) {
      renderedUserTemplate += `\n\n--- Attachment: ${doc.name} (${doc.type || "file"}) ---`
    }
  }

  const userMessageContent =
    imageAttachments.length > 0
      ? [
          { type: "text", text: renderedUserTemplate },
          ...imageAttachments.map((img: any) => ({
            type: "image_url",
            image_url: { url: img.dataUrl || img.data || img.url },
          })),
        ]
      : renderedUserTemplate

  // Provider round-trip (OpenAI-compatible chat completions).
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessageContent },
        ],
        temperature,
        ...(maxTokens ? { max_tokens: maxTokens } : {}),
      }),
      signal: controller.signal,
    })
  } catch (error) {
    clearTimeout(timeout)
    console.error("[ai] provider request failed:", error)
    await failedExecution(errors.providerCallFailed)
    return { status: "error", error: errors.providerCallFailed }
  }
  clearTimeout(timeout)

  const durationMs = Date.now() - startedAt

  const rawBody = await response.text()
  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    body = null
  }

  if (!response.ok) {
    console.error(
      "[ai] provider HTTP error:",
      response.status,
      rawBody.slice(0, 500)
    )
    await failedExecution(errors.providerCallFailed)
    return { status: "error", error: errors.providerCallFailed }
  }

  const content = extractChatContent(body)
  if (!content) {
    console.error("[ai] unexpected provider payload:", rawBody.slice(0, 500))
    await failedExecution(errors.providerCallFailed)
    return { status: "error", error: errors.providerCallFailed }
  }

  const executionId = await recordExecution({
    organization_id: request.organizationId,
    prompt_id: promptId,
    tool_key: toolKey,
    status: "success",
    model_used: modelUsed,
    input_data: inputData,
    output_text: content,
    error_message: null,
    duration_ms: durationMs,
    executed_by: request.userId,
  })

  return {
    status: "success",
    execution: {
      id: executionId ?? "",
      output: content,
      modelUsed,
      durationMs,
    },
  }
}