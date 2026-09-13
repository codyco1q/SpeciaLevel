"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { hasPermission } from "@/lib/auth/rbac"
import { getCurrentUserContext } from "@/lib/auth/session"
import { createServerClient } from "@/lib/supabase/server"
import {
  aiPromptToggleSchema,
  createAiPromptSchema,
  type AiValidationMessages,
} from "@/lib/validations/ai"
import { getDictionary } from "@/lib/i18n/get-dictionary"
import { runPromptExecution, type AiRunResult } from "@/lib/ai/execute"

/**
 * AI module server actions.
 *
 * Security model mirrors automations.ts: `organization_id`, `created_by`
 * and `executed_by` always come from the session, `ai.view` gates reads
 * and executions, `ai.manage` gates prompt CRUD/toggling. Client input is
 * re-validated server-side with the shared Zod schemas, and every action
 * returns a typed result object instead of throwing.
 */

export interface AiPromptRow {
  id: string
  name: string
  description: string | null
  modelProvider: string
  modelName: string
  systemPrompt: string
  userTemplate: string
  temperature: number
  maxTokens: number | null
  isActive: boolean
  createdBy: { fullName: string | null; email: string | null } | null
  createdAt: string
  updatedAt: string
}

interface AiPromptJoinRow {
  id: string
  name: string
  description: string | null
  model_provider: string | null
  model_name: string | null
  system_prompt: string | null
  user_template: string
  temperature: number | null
  max_tokens: number | null
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  creator:
    | { full_name: string | null; email: string | null }
    | { full_name: string | null; email: string | null }[]
    | null
}

export interface AiExecutionRow {
  id: string
  promptId: string | null
  promptName: string | null
  toolKey: string | null
  status: "success" | "failed" | "running"
  modelUsed: string | null
  outputText: string | null
  errorMessage: string | null
  durationMs: number | null
  executedBy: string
  executedAt: string
}

interface AiExecutionJoinRow {
  id: string
  prompt_id: string | null
  tool_key: string | null
  status: string
  model_used: string | null
  output_text: string | null
  error_message: string | null
  duration_ms: number | null
  executed_by: string
  executed_at: string
  prompt: { name: string } | { name: string }[] | null
}

function toAiPromptRow(row: AiPromptJoinRow): AiPromptRow {
  const creator = Array.isArray(row.creator) ? row.creator[0] ?? null : row.creator
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    modelProvider: row.model_provider ?? "openai",
    modelName: row.model_name ?? "",
    systemPrompt: row.system_prompt ?? "",
    userTemplate: row.user_template,
    temperature: Number(row.temperature ?? 0.7),
    maxTokens: row.max_tokens ?? null,
    isActive: row.is_active,
    createdBy: creator
      ? {
          fullName: creator.full_name ?? null,
          email: creator.email ?? null,
        }
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toAiExecutionRow(row: AiExecutionJoinRow): AiExecutionRow {
  const prompt = Array.isArray(row.prompt) ? row.prompt[0] ?? null : row.prompt
  return {
    id: row.id,
    promptId: row.prompt_id,
    promptName: prompt?.name ?? null,
    toolKey: row.tool_key,
    status:
      row.status === "success" || row.status === "failed" || row.status === "running"
        ? row.status
        : "failed",
    modelUsed: row.model_used,
    outputText: row.output_text ?? null,
    errorMessage: row.error_message ?? null,
    durationMs: row.duration_ms ?? null,
    executedBy: row.executed_by,
    executedAt: row.executed_at,
  }
}

type AiAuthResult =
  | { ok: true; organizationId: string; userId: string }
  | { ok: false; error: string }

async function requireAiPermission(
  permission: "ai.view" | "ai.manage"
): Promise<AiAuthResult> {
  const dict = await getDictionary()
  const errors = dict.platform.ai.errors

  const userContext = await getCurrentUserContext()
  if (!userContext) {
    return { ok: false, error: errors.signedIn }
  }
  if (!userContext.organization) {
    return { ok: false, error: errors.noOrg }
  }
  if (!hasPermission(permission, userContext.permissions)) {
    return {
      ok: false,
      error:
        permission === "ai.view"
          ? errors.noPermissionView
          : errors.noPermissionManage,
    }
  }

  return {
    ok: true,
    organizationId: userContext.organization.id,
    userId: userContext.user.id,
  }
}

function parseFieldErrors(issues: z.ZodIssue[]): Record<string, string[]> {
  const errors: Record<string, string[]> = {}
  for (const issue of issues) {
    const key = issue.path[0]
    if (typeof key !== "string") continue
    if (!errors[key]) errors[key] = []
    errors[key].push(issue.message)
  }
  return errors
}

const fallbackToggleMessages: Pick<AiValidationMessages, "invalidConfig"> = {
  invalidConfig: "Invalid ID.",
}

const PROMPT_SELECT = `
  id,
  name,
  description,
  model_provider,
  model_name,
  system_prompt,
  user_template,
  temperature,
  max_tokens,
  is_active,
  created_by,
  created_at,
  updated_at,
  creator:profiles!fk_ai_prompts_created_by(id, full_name, email)
`

/** Lists all prompts for the current organization (newest first). */
export async function getAiPrompts(): Promise<AiPromptRow[] | null> {
  const auth = await requireAiPermission("ai.view")
  if (!auth.ok) return null

  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from("ai_prompts")
    .select(PROMPT_SELECT)
    .eq("organization_id", auth.organizationId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[ai] getAiPrompts failed:", error.message)
    return null
  }

  return (data as unknown as AiPromptJoinRow[]).map(toAiPromptRow)
}

export type CreateAiPromptResult =
  | { status: "success"; prompt: AiPromptRow }
  | { status: "error"; error: string; fieldErrors: Record<string, string[]> }

export async function createAiPrompt(data: unknown): Promise<CreateAiPromptResult> {
  const auth = await requireAiPermission("ai.manage")
  if (!auth.ok) {
    return { status: "error", error: auth.error, fieldErrors: {} }
  }

  const dict = await getDictionary()
  const t = dict.platform.ai

  const parsed = createAiPromptSchema(t.errors).safeParse(data)
  if (!parsed.success) {
    return {
      status: "error",
      error: t.errors.highlightFields,
      fieldErrors: parseFieldErrors(parsed.error.issues),
    }
  }

  const supabase = await createServerClient()
  const { data: row, error } = await supabase
    .from("ai_prompts")
    .insert({
      organization_id: auth.organizationId,
      created_by: auth.userId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      model_provider: parsed.data.modelProvider,
      model_name: parsed.data.modelName,
      system_prompt: parsed.data.systemPrompt ?? "",
      user_template: parsed.data.userTemplate,
      temperature: parsed.data.temperature,
      max_tokens: parsed.data.maxTokens ?? null,
      is_active: true,
    })
    .select(PROMPT_SELECT)
    .single()

  if (error || !row) {
    console.error("[ai] createAiPrompt failed:", error?.message)
    return {
      status: "error",
      error: t.errors.createFailed,
      fieldErrors: {},
    }
  }

  revalidatePath("/ai")
  return { status: "success", prompt: toAiPromptRow(row as unknown as AiPromptJoinRow) }
}

export type UpdateAiPromptResult =
  | { status: "success"; prompt: AiPromptRow }
  | { status: "error"; error: string; fieldErrors: Record<string, string[]> }

export async function updateAiPrompt(
  id: string,
  data: unknown
): Promise<UpdateAiPromptResult> {
  const auth = await requireAiPermission("ai.manage")
  if (!auth.ok) {
    return { status: "error", error: auth.error, fieldErrors: {} }
  }

  const dict = await getDictionary()
  const t = dict.platform.ai

  const parsed = createAiPromptSchema(t.errors).safeParse(data)
  if (!parsed.success) {
    return {
      status: "error",
      error: t.errors.highlightFields,
      fieldErrors: parseFieldErrors(parsed.error.issues),
    }
  }

  const supabase = await createServerClient()

  const { data: existing, error: ownershipError } = await supabase
    .from("ai_prompts")
    .select("id")
    .eq("id", id)
    .eq("organization_id", auth.organizationId)
    .maybeSingle()
  if (ownershipError || !existing) {
    return {
      status: "error",
      error: t.errors.notFound,
      fieldErrors: {},
    }
  }

  const { data: row, error } = await supabase
    .from("ai_prompts")
    .update({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      model_provider: parsed.data.modelProvider,
      model_name: parsed.data.modelName,
      system_prompt: parsed.data.systemPrompt ?? "",
      user_template: parsed.data.userTemplate,
      temperature: parsed.data.temperature,
      max_tokens: parsed.data.maxTokens ?? null,
    })
    .eq("id", existing.id)
    .eq("organization_id", auth.organizationId)
    .select(PROMPT_SELECT)
    .single()

  if (error || !row) {
    console.error("[ai] updateAiPrompt failed:", error?.message)
    return {
      status: "error",
      error: t.errors.updateFailed,
      fieldErrors: {},
    }
  }

  revalidatePath("/ai")
  return { status: "success", prompt: toAiPromptRow(row as unknown as AiPromptJoinRow) }
}

export type ToggleAiPromptResult =
  | { status: "success"; prompt: { id: string; isActive: boolean } }
  | { status: "error"; error: string }

export async function toggleAiPrompt(
  id: string,
  isActive: boolean
): Promise<ToggleAiPromptResult> {
  const auth = await requireAiPermission("ai.manage")
  if (!auth.ok) return { status: "error", error: auth.error }

  const dict = await getDictionary()
  const t = dict.platform.ai

  const parsed = aiPromptToggleSchema(fallbackToggleMessages).safeParse({
    id,
    isActive,
  })
  if (!parsed.success) {
    return { status: "error", error: t.errors.invalidId }
  }

  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from("ai_prompts")
    .update({ is_active: parsed.data.isActive })
    .eq("id", parsed.data.id)
    .eq("organization_id", auth.organizationId)
    .select("id, is_active")
    .single()

  if (error || !data) {
    console.error("[ai] toggleAiPrompt failed:", error?.message)
    return { status: "error", error: t.errors.toggleFailed }
  }

  revalidatePath("/ai")
  return {
    status: "success",
    prompt: { id: data.id, isActive: data.is_active },
  }
}

export type DeleteAiPromptResult =
  | { status: "success"; id: string }
  | { status: "error"; error: string }

export async function deleteAiPrompt(id: string): Promise<DeleteAiPromptResult> {
  const auth = await requireAiPermission("ai.manage")
  if (!auth.ok) return { status: "error", error: auth.error }

  const dict = await getDictionary()
  const t = dict.platform.ai

  if (!id) {
    return { status: "error", error: t.errors.invalidId }
  }

  const supabase = await createServerClient()
  const { error } = await supabase
    .from("ai_prompts")
    .delete()
    .eq("id", id)
    .eq("organization_id", auth.organizationId)

  if (error) {
    console.error("[ai] deleteAiPrompt failed:", error?.message)
    return { status: "error", error: t.errors.deleteFailed }
  }

  revalidatePath("/ai")
  return { status: "success", id }
}

export type GetAiExecutionsResult =
  | { status: "success"; executions: AiExecutionRow[] }
  | { status: "error"; error: string }

/**
 * Recent executions for the history drawer. Scoped to the whole
 * organization (each row already carries its own visibility via RLS),
 * newest first.
 */
export async function getAiExecutions(): Promise<GetAiExecutionsResult> {
  const auth = await requireAiPermission("ai.view")
  if (!auth.ok) return { status: "error", error: auth.error }

  const dict = await getDictionary()
  const t = dict.platform.ai

  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from("ai_executions")
    .select(
      `
        id,
        prompt_id,
        executed_by,
        tool_key,
        status,
        model_used,
        input_data,
        output_text,
        error_message,
        duration_ms,
        executed_at,
        prompt:ai_prompts!fk_ai_executions_prompt(name)
      `
    )
    .eq("organization_id", auth.organizationId)
    .order("executed_at", { ascending: false })
    .limit(50)

  if (error) {
    console.error("[ai] getAiExecutions failed:", error?.message)
    return { status: "error", error: t.errors.logsFailed }
  }

  return {
    status: "success",
    executions: (data as unknown as AiExecutionJoinRow[]).map(toAiExecutionRow),
  }
}

/**
 * Runs a playground request, quick tool, or stored prompt through the
 * provider gateway. The gateway resolves + records the execution.
 */
export async function executeAiTask(payload: unknown): Promise<AiRunResult> {
  const auth = await requireAiPermission("ai.view")
  if (!auth.ok) return { status: "error", error: auth.error }

  return runPromptExecution({
    organizationId: auth.organizationId,
    userId: auth.userId,
    payload,
  })
}