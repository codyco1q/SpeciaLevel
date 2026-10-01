"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { dispatchWorkflowTrigger } from "@/lib/services/workflow-runner";
import {
  createCrmDealInputSchema,
  crmPipelineSchema,
  type CrmActionState,
  type CrmDealInput,
  type CrmPipelineInput,
} from "@/lib/validations/crm";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type {
  CrmStage,
  MarketingLeadStatus,
} from "@/types/database";

export interface CrmPerson {
  id: string;
  fullName: string | null;
  email: string | null;
}

export interface DealContact {
  id: string;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
}

export interface PipelineStageRow {
  id: string;
  pipelineId: string;
  name: string;
  color: string;
  stageType: "open" | "won" | "lost";
  orderIndex: number;
  probability: number;
  staleDays: number;
  createdAt: string;
}

export interface PipelineRow {
  id: string;
  name: string;
  color: string;
  description?: string | null;
  targetAmount?: number | null;
  isDefault: boolean;
  orderIndex: number;
  stages: PipelineStageRow[];
  createdAt: string;
}

export interface DealRow {
  id: string;
  title: string;
  value: number;
  currency: string;
  stage: CrmStage;
  pipelineId: string | null;
  stageId: string | null;
  lostReason: string | null;
  wonReason: string | null;
  closedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  contact: DealContact | null;
  assignee: CrmPerson | null;
  stageObj?: PipelineStageRow | null;
}

export interface MarketingLeadRow {
  id: string;
  name: string;
  email: string;
  company: string | null;
  bottleneck: string | null;
  packageOfInterest: string | null;
  status: MarketingLeadStatus;
  createdAt: string;
}

type CrmAuthResult =
  | { ok: true; organizationId: string; userId: string }
  | { ok: false; error: CrmActionState };

/** Verifies the session, org, and that the caller holds the given permission. */
async function requireCrmPermission(
  permission: "crm.view" | "crm.manage"
): Promise<CrmAuthResult> {
  const userContext = await getCurrentUserContext();
  const dict = await getDictionary();
  const err = dict.platform.crm.errors;

  if (!userContext) {
    return { ok: false, error: { status: "error", error: err.signedIn } };
  }
  if (!hasPermission(permission, userContext.permissions)) {
    return { ok: false, error: { status: "error", error: err.noPermission } };
  }

  const organizationId = userContext.organization?.id;
  if (!organizationId) {
    return { ok: false, error: { status: "error", error: err.noOrg } };
  }

  return { ok: true, organizationId, userId: userContext.user.id };
}

function parseFieldErrors(
  issues: z.ZodIssue[]
): CrmActionState["fieldErrors"] {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = String(issue.path[0]);
    if (key) {
      (fieldErrors[key] ??= []).push(issue.message);
    }
  }
  return fieldErrors;
}

/** PostgREST may return a single object or an array for a to-one join. */
function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value as T;
}

interface RawDealRow {
  id: string;
  organization_id: string;
  pipeline_id: string | null;
  stage_id: string | null;
  title: string;
  value: number | string;
  currency: string;
  stage: string;
  notes: string | null;
  lost_reason: string | null;
  won_reason: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  contact:
    | {
        id: string;
        name: string;
        email: string;
        company: string | null;
        phone: string | null;
      }
    | Array<{
        id: string;
        name: string;
        email: string;
        company: string | null;
        phone: string | null;
      }>
    | null;
  assignee:
    | { id: string; full_name: string | null; email: string | null }
    | Array<{ id: string; full_name: string | null; email: string | null }>
    | null;
  stage_rel?:
    | {
        id: string;
        pipeline_id: string;
        name: string;
        color?: string | null;
        stage_type?: string | null;
        order_index: number;
        probability: number;
        stale_days: number;
        created_at: string;
      }
    | Array<{
        id: string;
        pipeline_id: string;
        name: string;
        color?: string | null;
        stage_type?: string | null;
        order_index: number;
        probability: number;
        stale_days: number;
        created_at: string;
      }>
    | null;
}

function resolveFallbackStageColor(name: string, probability?: number): string {
  const n = name.toLowerCase().trim();
  if (n.includes("won") || n.includes("signed") || probability === 100) return "#10b981";
  if (n.includes("lost") || n.includes("churn") || probability === 0) return "#ef4444";
  if (n.includes("negotiat") || n.includes("contract") || n.includes("review")) return "#f59e0b";
  if (n.includes("proposal") || n.includes("demo") || n.includes("pitch")) return "#8b5cf6";
  if (n.includes("contact") || n.includes("qualif") || n.includes("discover")) return "#0ea5e9";
  if (n.includes("lead") || n.includes("inbound")) return "#6366f1";
  return "#3b82f6";
}

function mapDealRow(row: RawDealRow): DealRow {
  const contact = firstOf(row.contact);
  const assignee = firstOf(row.assignee);
  const stageRel = firstOf(row.stage_rel);

  return {
    id: row.id,
    title: row.title,
    value: Number(row.value) || 0,
    currency: row.currency,
    stage: (stageRel ? stageRel.name.toLowerCase() : row.stage) as CrmStage,
    pipelineId: row.pipeline_id,
    stageId: row.stage_id,
    lostReason: row.lost_reason,
    wonReason: row.won_reason,
    closedAt: row.closed_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    contact: contact
      ? {
          id: contact.id,
          name: contact.name,
          email: contact.email,
          company: contact.company,
          phone: contact.phone,
        }
      : null,
    assignee: assignee
      ? {
          id: assignee.id,
          fullName: assignee.full_name,
          email: assignee.email,
        }
      : null,
    stageObj: stageRel
      ? {
          id: stageRel.id,
          pipelineId: stageRel.pipeline_id,
          name: stageRel.name,
          color: stageRel.color || resolveFallbackStageColor(stageRel.name, stageRel.probability),
          stageType:
            (stageRel.stage_type as "open" | "won" | "lost") ||
            (stageRel.probability === 100 ? "won" : stageRel.probability === 0 ? "lost" : "open"),
          orderIndex: stageRel.order_index,
          probability: stageRel.probability,
          staleDays: stageRel.stale_days,
          createdAt: stageRel.created_at,
        }
      : null,
  };
}

/**
 * Lists all pipelines for the active organization, ordered by order_index.
 * Auto-creates default pipeline if none exists.
 */
export async function getPipelines(): Promise<PipelineRow[]> {
  const auth = await requireCrmPermission("crm.view");
  if (!auth.ok) return [];

  const supabase = await createServerClient();

  // Try querying with full enhanced columns first
  let pipelineRows: any[] | null = null;
  let hasEnhancedColumns = true;

  const { data: fullData, error: fullError } = await supabase
    .from("crm_pipelines")
    .select(`
      id,
      name,
      color,
      description,
      target_amount,
      is_default,
      order_index,
      created_at,
      stages:crm_pipeline_stages(
        id,
        pipeline_id,
        name,
        color,
        stage_type,
        order_index,
        probability,
        stale_days,
        created_at
      )
    `)
    .eq("organization_id", auth.organizationId)
    .order("order_index", { ascending: true });

  if (fullError) {
    // If enhanced columns don't exist yet in remote DB, fall back to base columns
    hasEnhancedColumns = false;
    const { data: fallbackData, error: fallbackErr } = await supabase
      .from("crm_pipelines")
      .select(`
        id,
        name,
        is_default,
        order_index,
        created_at,
        stages:crm_pipeline_stages(
          id,
          pipeline_id,
          name,
          order_index,
          probability,
          stale_days,
          created_at
        )
      `)
      .eq("organization_id", auth.organizationId)
      .order("order_index", { ascending: true });

    if (fallbackErr) {
      console.error("[crm] getPipelines fallback failed:", fallbackErr.message);
      return [];
    }
    pipelineRows = fallbackData;
  } else {
    pipelineRows = fullData;
  }

  if (!pipelineRows || pipelineRows.length === 0) {
    let newPipeId: string | null = null;
    let newPipeCreated: any = null;

    if (hasEnhancedColumns) {
      const { data: newPipe, error: errNew } = await supabase
        .from("crm_pipelines")
        .insert({
          organization_id: auth.organizationId,
          name: "Sales Pipeline",
          color: "#6366f1",
          description: "Primary sales funnel for converting leads to deals.",
          is_default: true,
          order_index: 0,
        })
        .select("id, name, color, description, target_amount, is_default, order_index, created_at")
        .single();
      if (!errNew && newPipe) {
        newPipeId = newPipe.id;
        newPipeCreated = newPipe;
      }
    }

    if (!newPipeId) {
      const { data: newPipeBase } = await supabase
        .from("crm_pipelines")
        .insert({
          organization_id: auth.organizationId,
          name: "Sales Pipeline",
          is_default: true,
          order_index: 0,
        })
        .select("id, name, is_default, order_index, created_at")
        .single();
      if (newPipeBase) {
        newPipeId = newPipeBase.id;
        newPipeCreated = newPipeBase;
      }
    }

    if (newPipeCreated && newPipeId) {
      const defaultStages = [
        { name: "Lead", color: "#6366f1", stage_type: "open", order_index: 0, probability: 10, stale_days: 14 },
        { name: "Qualified", color: "#0ea5e9", stage_type: "open", order_index: 1, probability: 30, stale_days: 14 },
        { name: "Proposal", color: "#8b5cf6", stage_type: "open", order_index: 2, probability: 60, stale_days: 14 },
        { name: "Negotiation", color: "#f59e0b", stage_type: "open", order_index: 3, probability: 80, stale_days: 14 },
        { name: "Won", color: "#10b981", stage_type: "won", order_index: 4, probability: 100, stale_days: 30 },
        { name: "Lost", color: "#ef4444", stage_type: "lost", order_index: 5, probability: 0, stale_days: 30 },
      ];

      let insertedStages: any[] | null = null;
      if (hasEnhancedColumns) {
        const { data: stagesFull } = await supabase
          .from("crm_pipeline_stages")
          .insert(defaultStages.map((s) => ({ pipeline_id: newPipeId, ...s })))
          .select("id, pipeline_id, name, color, stage_type, order_index, probability, stale_days, created_at");
        insertedStages = stagesFull;
      }

      if (!insertedStages) {
        const { data: stagesBase } = await supabase
          .from("crm_pipeline_stages")
          .insert(
            defaultStages.map((s) => ({
              pipeline_id: newPipeId,
              name: s.name,
              order_index: s.order_index,
              probability: s.probability,
              stale_days: s.stale_days,
            }))
          )
          .select("id, pipeline_id, name, order_index, probability, stale_days, created_at");
        insertedStages = stagesBase;
      }

      const mappedStages: PipelineStageRow[] = ((insertedStages as Array<{
        id: string;
        pipeline_id: string;
        name: string;
        color?: string | null;
        stage_type?: string | null;
        order_index: number;
        probability: number;
        stale_days: number;
        created_at: string;
      }>) ?? []).map((s) => ({
        id: s.id,
        pipelineId: s.pipeline_id,
        name: s.name,
        color: s.color || resolveFallbackStageColor(s.name, s.probability),
        stageType:
          (s.stage_type as "open" | "won" | "lost") ||
          (s.probability === 100 ? "won" : s.probability === 0 ? "lost" : "open"),
        orderIndex: s.order_index,
        probability: s.probability,
        staleDays: s.stale_days,
        createdAt: s.created_at,
      }));

      return [
        {
          id: newPipeCreated.id,
          name: newPipeCreated.name,
          color: newPipeCreated.color || "#6366f1",
          description: newPipeCreated.description ?? null,
          targetAmount: newPipeCreated.target_amount ? Number(newPipeCreated.target_amount) : null,
          isDefault: newPipeCreated.is_default,
          orderIndex: newPipeCreated.order_index,
          createdAt: newPipeCreated.created_at,
          stages: mappedStages.sort((a, b) => a.orderIndex - b.orderIndex),
        },
      ];
    }
    return [];
  }

  return pipelineRows.map((p) => {
    const rawStages = (p.stages as Array<{
      id: string;
      pipeline_id: string;
      name: string;
      color?: string | null;
      stage_type?: string | null;
      order_index: number;
      probability: number;
      stale_days: number;
      created_at: string;
    }>) || [];

    const sortedStages: PipelineStageRow[] = rawStages
      .map((s) => ({
        id: s.id,
        pipelineId: s.pipeline_id,
        name: s.name,
        color: s.color || resolveFallbackStageColor(s.name, s.probability),
        stageType:
          (s.stage_type as "open" | "won" | "lost") ||
          (s.probability === 100 ? "won" : s.probability === 0 ? "lost" : "open"),
        orderIndex: s.order_index,
        probability: s.probability,
        staleDays: s.stale_days,
        createdAt: s.created_at,
      }))
      .sort((a, b) => a.orderIndex - b.orderIndex);

    return {
      id: p.id,
      name: p.name,
      color: p.color || "#6366f1",
      description: p.description ?? null,
      targetAmount: p.target_amount ? Number(p.target_amount) : null,
      isDefault: p.is_default,
      orderIndex: p.order_index,
      createdAt: p.created_at,
      stages: sortedStages,
    };
  });
}

/**
 * Creates a new pipeline with custom stages. Requires `crm.manage`.
 */
export async function createPipeline(
  data: CrmPipelineInput
): Promise<CrmActionState> {
  const auth = await requireCrmPermission("crm.manage");
  if (!auth.ok) return auth.error;

  const parsed = crmPipelineSchema.safeParse(data);
  if (!parsed.success) {
    return {
      status: "error",
      error: parsed.error.issues[0]?.message ?? "Invalid pipeline data",
      fieldErrors: parseFieldErrors(parsed.error.issues),
    };
  }

  const supabase = await createServerClient();

  if (parsed.data.isDefault) {
    await supabase
      .from("crm_pipelines")
      .update({ is_default: false })
      .eq("organization_id", auth.organizationId);
  }

  // 1. Try inserting with enhanced columns
  let pipeline: { id: string } | null = null;
  let pipelineInsertError: string | null = null;

  const fullInsertRes = await supabase
    .from("crm_pipelines")
    .insert({
      organization_id: auth.organizationId,
      name: parsed.data.name,
      color: parsed.data.color || "#6366f1",
      description: parsed.data.description || null,
      target_amount: parsed.data.targetAmount ?? null,
      is_default: Boolean(parsed.data.isDefault),
      order_index: parsed.data.orderIndex ?? 0,
    })
    .select("id")
    .single();

  if (fullInsertRes.data) {
    pipeline = fullInsertRes.data;
  } else {
    // Schema fallback if enhanced columns do not exist in DB yet
    const baseInsertRes = await supabase
      .from("crm_pipelines")
      .insert({
        organization_id: auth.organizationId,
        name: parsed.data.name,
        is_default: Boolean(parsed.data.isDefault),
        order_index: parsed.data.orderIndex ?? 0,
      })
      .select("id")
      .single();

    if (baseInsertRes.data) {
      pipeline = baseInsertRes.data;
    } else {
      pipelineInsertError =
        baseInsertRes.error?.message ||
        fullInsertRes.error?.message ||
        "Failed to create pipeline";
    }
  }

  if (!pipeline) {
    console.error("[crm] createPipeline failed:", pipelineInsertError);
    return { status: "error", error: pipelineInsertError || "Failed to create pipeline" };
  }

  // 2. Insert pipeline stages
  const stagesToInsertFull = parsed.data.stages.map((stage, idx) => ({
    pipeline_id: pipeline!.id,
    name: stage.name,
    color: stage.color || "#3b82f6",
    stage_type: stage.stageType || "open",
    order_index: stage.orderIndex ?? idx,
    probability: stage.probability,
    stale_days: stage.staleDays,
  }));

  const { error: stageErr } = await supabase
    .from("crm_pipeline_stages")
    .insert(stagesToInsertFull);

  if (stageErr) {
    // Fallback without enhanced stage columns
    const stagesToInsertBase = parsed.data.stages.map((stage, idx) => ({
      pipeline_id: pipeline!.id,
      name: stage.name,
      order_index: stage.orderIndex ?? idx,
      probability: stage.probability,
      stale_days: stage.staleDays,
    }));
    const { error: baseStageErr } = await supabase
      .from("crm_pipeline_stages")
      .insert(stagesToInsertBase);

    if (baseStageErr) {
      console.error("[crm] createPipeline stages failed:", baseStageErr.message);
      return { status: "error", error: baseStageErr.message };
    }
  }

  revalidatePath("/crm");
  return { status: "success", data: pipeline };
}

/**
 * Updates a pipeline and syncs its stages. Requires `crm.manage`.
 */
export async function updatePipeline(
  pipelineId: string,
  data: CrmPipelineInput
): Promise<CrmActionState> {
  const auth = await requireCrmPermission("crm.manage");
  if (!auth.ok) return auth.error;

  const parsed = crmPipelineSchema.safeParse(data);
  if (!parsed.success) {
    return {
      status: "error",
      error: parsed.error.issues[0]?.message ?? "Invalid pipeline data",
      fieldErrors: parseFieldErrors(parsed.error.issues),
    };
  }

  const supabase = await createServerClient();

  if (parsed.data.isDefault) {
    await supabase
      .from("crm_pipelines")
      .update({ is_default: false })
      .eq("organization_id", auth.organizationId)
      .neq("id", pipelineId);
  }

  // 1. Try updating pipeline with enhanced columns
  const { error: updateErr } = await supabase
    .from("crm_pipelines")
    .update({
      name: parsed.data.name,
      color: parsed.data.color || "#6366f1",
      description: parsed.data.description || null,
      target_amount: parsed.data.targetAmount ?? null,
      is_default: Boolean(parsed.data.isDefault),
      order_index: parsed.data.orderIndex ?? 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", pipelineId)
    .eq("organization_id", auth.organizationId);

  if (updateErr) {
    // Fallback to base columns
    const { error: baseUpdateErr } = await supabase
      .from("crm_pipelines")
      .update({
        name: parsed.data.name,
        is_default: Boolean(parsed.data.isDefault),
        order_index: parsed.data.orderIndex ?? 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", pipelineId)
      .eq("organization_id", auth.organizationId);

    if (baseUpdateErr) {
      console.error("[crm] updatePipeline failed:", baseUpdateErr.message);
      return { status: "error", error: baseUpdateErr.message || "Failed to update pipeline" };
    }
  }

  // 2. Sync stages
  const { data: existingStages } = await supabase
    .from("crm_pipeline_stages")
    .select("id")
    .eq("pipeline_id", pipelineId);

  const existingIds = new Set((existingStages ?? []).map((s) => s.id));
  const keepIds = new Set<string>();

  for (let i = 0; i < parsed.data.stages.length; i++) {
    const stage = parsed.data.stages[i];
    if (stage.id && existingIds.has(stage.id)) {
      keepIds.add(stage.id);
      const { error: stageUpdErr } = await supabase
        .from("crm_pipeline_stages")
        .update({
          name: stage.name,
          color: stage.color || "#3b82f6",
          stage_type: stage.stageType || "open",
          order_index: i,
          probability: stage.probability,
          stale_days: stage.staleDays,
          updated_at: new Date().toISOString(),
        })
        .eq("id", stage.id);

      if (stageUpdErr) {
        await supabase
          .from("crm_pipeline_stages")
          .update({
            name: stage.name,
            order_index: i,
            probability: stage.probability,
            stale_days: stage.staleDays,
            updated_at: new Date().toISOString(),
          })
          .eq("id", stage.id);
      }
    } else {
      const { data: newStage, error: insertStageErr } = await supabase
        .from("crm_pipeline_stages")
        .insert({
          pipeline_id: pipelineId,
          name: stage.name,
          color: stage.color || "#3b82f6",
          stage_type: stage.stageType || "open",
          order_index: i,
          probability: stage.probability,
          stale_days: stage.staleDays,
        })
        .select("id")
        .single();

      if (insertStageErr) {
        const { data: baseStage } = await supabase
          .from("crm_pipeline_stages")
          .insert({
            pipeline_id: pipelineId,
            name: stage.name,
            order_index: i,
            probability: stage.probability,
            stale_days: stage.staleDays,
          })
          .select("id")
          .single();

        if (baseStage) keepIds.add(baseStage.id);
      } else if (newStage) {
        keepIds.add(newStage.id);
      }
    }
  }

  const toDelete = Array.from(existingIds).filter((id) => !keepIds.has(id));
  if (toDelete.length > 0) {
    const fallbackStageId = Array.from(keepIds)[0];
    if (fallbackStageId) {
      await supabase
        .from("crm_deals")
        .update({ stage_id: fallbackStageId })
        .in("stage_id", toDelete);
    }
    await supabase
      .from("crm_pipeline_stages")
      .delete()
      .in("id", toDelete);
  }

  revalidatePath("/crm");
  return { status: "success" };
}

/**
 * Duplicates a pipeline and all its customized stages. Requires `crm.manage`.
 */
export async function duplicatePipeline(
  pipelineId: string
): Promise<CrmActionState> {
  const auth = await requireCrmPermission("crm.manage");
  if (!auth.ok) return auth.error;

  const supabase = await createServerClient();

  let pipe: any = null;
  const { data: fullPipe, error: pipeErr } = await supabase
    .from("crm_pipelines")
    .select(`
      id,
      name,
      color,
      description,
      target_amount,
      stages:crm_pipeline_stages(
        name,
        color,
        stage_type,
        order_index,
        probability,
        stale_days
      )
    `)
    .eq("id", pipelineId)
    .eq("organization_id", auth.organizationId)
    .single();

  if (pipeErr || !fullPipe) {
    const { data: basePipe, error: basePipeErr } = await supabase
      .from("crm_pipelines")
      .select(`
        id,
        name,
        stages:crm_pipeline_stages(
          name,
          order_index,
          probability,
          stale_days
        )
      `)
      .eq("id", pipelineId)
      .eq("organization_id", auth.organizationId)
      .single();

    if (basePipeErr || !basePipe) {
      return { status: "error", error: basePipeErr?.message || "Pipeline not found" };
    }
    pipe = basePipe;
  } else {
    pipe = fullPipe;
  }

  const { count } = await supabase
    .from("crm_pipelines")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", auth.organizationId);

  const newName = `${pipe.name} (Copy)`;
  const rawStages = (pipe.stages as Array<{
    name: string;
    color?: string | null;
    stage_type?: string | null;
    order_index: number;
    probability: number;
    stale_days: number;
  }>) || [];

  return createPipeline({
    name: newName,
    color: pipe.color || "#6366f1",
    description: pipe.description || undefined,
    targetAmount: pipe.target_amount ? Number(pipe.target_amount) : undefined,
    isDefault: false,
    orderIndex: count ?? 0,
    stages: rawStages
      .sort((a, b) => a.order_index - b.order_index)
      .map((s, idx) => ({
        name: s.name,
        color: s.color || resolveFallbackStageColor(s.name, s.probability),
        stageType:
          (s.stage_type as "open" | "won" | "lost") ||
          (s.probability === 100 ? "won" : s.probability === 0 ? "lost" : "open"),
        orderIndex: idx,
        probability: s.probability,
        staleDays: s.stale_days,
      })),
  });
}

/**
 * Deletes a pipeline if it's not the default and not the last one.
 */
export async function deletePipeline(
  pipelineId: string
): Promise<CrmActionState> {
  const auth = await requireCrmPermission("crm.manage");
  if (!auth.ok) return auth.error;

  const supabase = await createServerClient();

  const { data: pipe } = await supabase
    .from("crm_pipelines")
    .select("id, is_default")
    .eq("id", pipelineId)
    .eq("organization_id", auth.organizationId)
    .single();

  if (!pipe) {
    return { status: "error", error: "Pipeline not found" };
  }

  if (pipe.is_default) {
    return { status: "error", error: "The default pipeline cannot be deleted." };
  }

  const { count } = await supabase
    .from("crm_pipelines")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", auth.organizationId);

  if ((count ?? 0) <= 1) {
    return { status: "error", error: "You must keep at least one pipeline." };
  }

  const { data: defaultPipe } = await supabase
    .from("crm_pipelines")
    .select("id, stages:crm_pipeline_stages(id, order_index)")
    .eq("organization_id", auth.organizationId)
    .eq("is_default", true)
    .single();

  if (defaultPipe) {
    const rawStages = (defaultPipe.stages as Array<{ id: string; order_index: number }>) || [];
    const firstStage = rawStages.sort((a, b) => a.order_index - b.order_index)[0];

    await supabase
      .from("crm_deals")
      .update({
        pipeline_id: defaultPipe.id,
        stage_id: firstStage?.id ?? null,
      })
      .eq("pipeline_id", pipelineId)
      .eq("organization_id", auth.organizationId);
  }

  const { error } = await supabase
    .from("crm_pipelines")
    .delete()
    .eq("id", pipelineId)
    .eq("organization_id", auth.organizationId);

  if (error) {
    console.error("[crm] deletePipeline failed:", error.message);
    return { status: "error", error: "Failed to delete pipeline" };
  }

  revalidatePath("/crm");
  return { status: "success" };
}

/**
 * Lists all deals for the active organization, optionally filtered by pipeline.
 */
export async function getDeals(pipelineId?: string): Promise<DealRow[] | null> {
  const auth = await requireCrmPermission("crm.view");
  if (!auth.ok) return null;

  const supabase = await createServerClient();

  let query = supabase
    .from("crm_deals")
    .select(
      `
        id,
        organization_id,
        pipeline_id,
        stage_id,
        title,
        value,
        currency,
        stage,
        notes,
        lost_reason,
        won_reason,
        closed_at,
        created_at,
        updated_at,
        contact:crm_contacts(id, name, email, company, phone),
        assignee:profiles!fk_crm_deals_assigned_to(id, full_name, email),
        stage_rel:crm_pipeline_stages!crm_deals_stage_id_fkey(
          id,
          pipeline_id,
          name,
          color,
          stage_type,
          order_index,
          probability,
          stale_days,
          created_at
        )
      `
    )
    .eq("organization_id", auth.organizationId);

  if (pipelineId) {
    query = query.eq("pipeline_id", pipelineId);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    console.error("[crm] getDeals failed:", error.message);
    return null;
  }

  return ((data as unknown as RawDealRow[]) ?? []).map(mapDealRow);
}

/**
 * Lists inbound marketing leads. Requires `crm.manage`.
 */
export async function getMarketingLeads(): Promise<MarketingLeadRow[] | null> {
  const auth = await requireCrmPermission("crm.manage");
  if (!auth.ok) return null;

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("marketing_leads")
    .select("id, name, email, company, bottleneck, package_of_interest, status, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[crm] getMarketingLeads failed:", error.message);
    return null;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    company: row.company,
    bottleneck: row.bottleneck,
    packageOfInterest: row.package_of_interest,
    status: row.status as MarketingLeadStatus,
    createdAt: row.created_at,
  }));
}

/**
 * Helper to resolve or create a contact row.
 */
async function resolveContactId(
  organizationId: string,
  userId: string,
  contact: CrmDealInput["contact"]
): Promise<{ id: string | null; error?: string }> {
  if (!contact?.name || !contact.email) return { id: null };

  const supabase = await createServerClient();

  const { data: existing, error: findError } = await supabase
    .from("crm_contacts")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("email", contact.email)
    .maybeSingle();

  if (findError) {
    console.error("[crm] contact lookup failed:", findError.message);
    return { id: null, error: findError.message };
  }

  if (existing) {
    await supabase
      .from("crm_contacts")
      .update({
        name: contact.name,
        company: contact.company || null,
        phone: contact.phone || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    return { id: existing.id };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("crm_contacts")
    .insert({
      organization_id: organizationId,
      name: contact.name,
      email: contact.email,
      company: contact.company || null,
      phone: contact.phone || null,
      created_by: userId,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    console.error("[crm] contact insert failed:", insertError?.message);
    return { id: null, error: insertError?.message ?? "insert_failed" };
  }

  return { id: inserted.id };
}

/**
 * Creates a new CRM deal. Requires `crm.manage`.
 */
export async function createDeal(
  data: CrmDealInput
): Promise<CrmActionState> {
  const auth = await requireCrmPermission("crm.manage");
  if (!auth.ok) return auth.error;

  const dict = await getDictionary();
  const err = dict.platform.crm.errors;

  const parsed = createCrmDealInputSchema(err).safeParse(data);
  if (!parsed.success) {
    return {
      status: "error",
      error: err.highlightFields,
      fieldErrors: parseFieldErrors(parsed.error.issues),
    };
  }

  let contactId: string | null = null;
  if (
    parsed.data.contact &&
    (Boolean(parsed.data.contact.name) || Boolean(parsed.data.contact.email))
  ) {
    const contact = await resolveContactId(
      auth.organizationId,
      auth.userId,
      parsed.data.contact
    );
    if (contact.error) {
      return { status: "error", error: err.contactCreateFailed };
    }
    contactId = contact.id;
  }

  const supabase = await createServerClient();

  let pipelineId = parsed.data.pipelineId || null;
  let stageId = parsed.data.stageId || null;

  if (!pipelineId) {
    const { data: defaultPipe } = await supabase
      .from("crm_pipelines")
      .select("id")
      .eq("organization_id", auth.organizationId)
      .eq("is_default", true)
      .maybeSingle();
    pipelineId = defaultPipe?.id ?? null;
  }

  if (pipelineId && !stageId) {
    const { data: firstStage } = await supabase
      .from("crm_pipeline_stages")
      .select("id")
      .eq("pipeline_id", pipelineId)
      .order("order_index", { ascending: true })
      .limit(1)
      .maybeSingle();
    stageId = firstStage?.id ?? null;
  }

  const { error } = await supabase.from("crm_deals").insert({
    organization_id: auth.organizationId,
    contact_id: contactId,
    pipeline_id: pipelineId,
    stage_id: stageId,
    title: parsed.data.title,
    value: parsed.data.value,
    currency: parsed.data.currency,
    stage: parsed.data.stage || "lead",
    notes: parsed.data.notes || null,
    lost_reason: parsed.data.lostReason || null,
    won_reason: parsed.data.wonReason || null,
    assigned_to: parsed.data.assignedTo || null,
    created_by: auth.userId,
  });

  if (error) {
    console.error("[crm] deal insert failed:", error.message);
    return { status: "error", error: err.createFailed };
  }

  revalidatePath("/crm");
  return { status: "success" };
}

/**
 * Updates a deal's stage and adjusts won/lost metadata if applicable.
 */
export async function updateDealStage(
  dealId: string,
  stageIdOrCode: string,
  reason?: string
): Promise<CrmActionState> {
  const auth = await requireCrmPermission("crm.view");
  if (!auth.ok) return auth.error;

  const dict = await getDictionary();
  const err = dict.platform.crm.errors;

  if (!dealId || !stageIdOrCode) {
    return { status: "error", error: err.missingId };
  }

  const supabase = await createServerClient();

  let targetStageId: string | null = null;
  let targetStageName = stageIdOrCode;
  let targetProbability = 50;

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stageIdOrCode);

  if (isUuid) {
    const { data: stageRow } = await supabase
      .from("crm_pipeline_stages")
      .select("id, name, probability")
      .eq("id", stageIdOrCode)
      .maybeSingle();

    if (stageRow) {
      targetStageId = stageRow.id;
      targetStageName = stageRow.name;
      targetProbability = stageRow.probability;
    }
  } else {
    const { data: stageRow } = await supabase
      .from("crm_pipeline_stages")
      .select("id, name, probability")
      .ilike("name", stageIdOrCode)
      .limit(1)
      .maybeSingle();

    if (stageRow) {
      targetStageId = stageRow.id;
      targetStageName = stageRow.name;
      targetProbability = stageRow.probability;
    }
  }

  const isWon = targetStageName.toLowerCase() === "won" || targetProbability === 100;
  const isLost = targetStageName.toLowerCase() === "lost" || (targetProbability === 0 && targetStageName.toLowerCase() !== "lead");

  const updatePayload: Record<string, unknown> = {
    stage: targetStageName.toLowerCase(),
    updated_at: new Date().toISOString(),
  };

  if (targetStageId) {
    updatePayload.stage_id = targetStageId;
  }

  if (isWon) {
    updatePayload.won_reason = reason || null;
    updatePayload.lost_reason = null;
    updatePayload.closed_at = new Date().toISOString();
  } else if (isLost) {
    updatePayload.lost_reason = reason || null;
    updatePayload.won_reason = null;
    updatePayload.closed_at = new Date().toISOString();
  } else {
    updatePayload.won_reason = null;
    updatePayload.lost_reason = null;
    updatePayload.closed_at = null;
  }

  const { data: updated, error } = await supabase
    .from("crm_deals")
    .update(updatePayload)
    .eq("id", dealId)
    .eq("organization_id", auth.organizationId)
    .select("id");

  if (error) {
    console.error("[crm] stage update failed:", error.message);
    return { status: "error", error: err.updateFailed };
  }
  if (!updated || updated.length === 0) {
    return { status: "error", error: err.notFound };
  }

  revalidatePath("/crm");

  // Dispatch visual automation trigger
  dispatchWorkflowTrigger({
    type: "deal_stage_changed",
    orgId: auth.organizationId,
    payload: {
      deal_id: dealId,
      stage_id: targetStageId,
      stage: targetStageName,
      deal: {
        id: dealId,
        stage_id: targetStageId,
        stage: targetStageName,
      },
    },
  }).catch((triggerErr) =>
    console.error("[crm] dispatchWorkflowTrigger error:", triggerErr)
  );

  return { status: "success" };
}

/**
 * Explicit won/lost/reopen status updater with reason tracking.
 */
export async function updateDealStatus(
  dealId: string,
  status: "won" | "lost" | "open",
  reason?: string,
  stageId?: string
): Promise<CrmActionState> {
  const auth = await requireCrmPermission("crm.view");
  if (!auth.ok) return auth.error;

  const supabase = await createServerClient();

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (stageId) {
    updatePayload.stage_id = stageId;
  }

  if (status === "won") {
    updatePayload.won_reason = reason || null;
    updatePayload.lost_reason = null;
    updatePayload.closed_at = new Date().toISOString();
    updatePayload.stage = "won";
  } else if (status === "lost") {
    updatePayload.lost_reason = reason || null;
    updatePayload.won_reason = null;
    updatePayload.closed_at = new Date().toISOString();
    updatePayload.stage = "lost";
  } else {
    updatePayload.won_reason = null;
    updatePayload.lost_reason = null;
    updatePayload.closed_at = null;
  }

  const { data: updated, error } = await supabase
    .from("crm_deals")
    .update(updatePayload)
    .eq("id", dealId)
    .eq("organization_id", auth.organizationId)
    .select("id");

  if (error || !updated || updated.length === 0) {
    return { status: "error", error: "Failed to update deal status" };
  }

  revalidatePath("/crm");
  return { status: "success" };
}

/**
 * Converts an inbound marketing lead into a CRM deal.
 */
export async function convertLeadToDeal(
  leadId: string,
  data: CrmDealInput
): Promise<CrmActionState> {
  const auth = await requireCrmPermission("crm.manage");
  if (!auth.ok) return auth.error;

  const dict = await getDictionary();
  const err = dict.platform.crm.errors;

  if (!leadId) {
    return { status: "error", error: err.missingId };
  }

  const parsed = createCrmDealInputSchema(err).safeParse(data);
  if (!parsed.success) {
    return {
      status: "error",
      error: err.highlightFields,
      fieldErrors: parseFieldErrors(parsed.error.issues),
    };
  }

  const supabase = await createServerClient();

  const { data: lead, error: leadError } = await supabase
    .from("marketing_leads")
    .select("id, name, email, company, bottleneck, package_of_interest, status")
    .eq("id", leadId)
    .maybeSingle();

  if (leadError || !lead) {
    return { status: "error", error: err.notFound };
  }

  const hasOwnContact =
    Boolean(parsed.data.contact?.name) && Boolean(parsed.data.contact?.email);
  const contactInfo: CrmDealInput["contact"] = hasOwnContact
    ? parsed.data.contact
    : {
        name: lead.name,
        email: lead.email,
        company: lead.company ?? "",
        phone: "",
      };

  const contact = await resolveContactId(
    auth.organizationId,
    auth.userId,
    contactInfo
  );
  if (contact.error) {
    return { status: "error", error: err.contactCreateFailed };
  }

  let pipelineId = parsed.data.pipelineId || null;
  let stageId = parsed.data.stageId || null;

  if (!pipelineId) {
    const { data: defaultPipe } = await supabase
      .from("crm_pipelines")
      .select("id")
      .eq("organization_id", auth.organizationId)
      .eq("is_default", true)
      .maybeSingle();
    pipelineId = defaultPipe?.id ?? null;
  }

  if (pipelineId && !stageId) {
    const { data: firstStage } = await supabase
      .from("crm_pipeline_stages")
      .select("id")
      .eq("pipeline_id", pipelineId)
      .order("order_index", { ascending: true })
      .limit(1)
      .maybeSingle();
    stageId = firstStage?.id ?? null;
  }

  const { error: dealError } = await supabase.from("crm_deals").insert({
    organization_id: auth.organizationId,
    contact_id: contact.id,
    pipeline_id: pipelineId,
    stage_id: stageId,
    title: parsed.data.title,
    value: parsed.data.value,
    currency: parsed.data.currency,
    stage: parsed.data.stage || "lead",
    notes: parsed.data.notes || null,
    assigned_to: parsed.data.assignedTo || null,
    created_by: auth.userId,
  });

  if (dealError) {
    console.error("[crm] lead-to-deal conversion insert failed:", dealError.message);
    return { status: "error", error: err.convertFailed };
  }

  await supabase
    .from("marketing_leads")
    .update({ status: "converted" })
    .eq("id", leadId);

  revalidatePath("/crm");
  return { status: "success" };
}

/**
 * Updates an existing deal. Requires `crm.manage`.
 */
export async function updateDeal(
  dealId: string,
  data: CrmDealInput
): Promise<CrmActionState> {
  const auth = await requireCrmPermission("crm.manage");
  if (!auth.ok) return auth.error;

  const dict = await getDictionary();
  const err = dict.platform.crm.errors;

  if (!dealId) {
    return { status: "error", error: err.missingId };
  }

  const parsed = createCrmDealInputSchema(err).safeParse(data);
  if (!parsed.success) {
    return {
      status: "error",
      error: err.highlightFields,
      fieldErrors: parseFieldErrors(parsed.error.issues),
    };
  }

  let contactId: string | null = null;
  if (
    parsed.data.contact &&
    (Boolean(parsed.data.contact.name) || Boolean(parsed.data.contact.email))
  ) {
    const contact = await resolveContactId(
      auth.organizationId,
      auth.userId,
      parsed.data.contact
    );
    if (contact.error) {
      return { status: "error", error: err.updateFailed };
    }
    contactId = contact.id;
  }

  const supabase = await createServerClient();
  const updatePayload: Record<string, unknown> = {
    title: parsed.data.title,
    value: parsed.data.value,
    currency: parsed.data.currency,
    stage: parsed.data.stage || "lead",
    notes: parsed.data.notes || null,
    lost_reason: parsed.data.lostReason || null,
    won_reason: parsed.data.wonReason || null,
    assigned_to: parsed.data.assignedTo || null,
    updated_at: new Date().toISOString(),
  };

  if (parsed.data.pipelineId) {
    updatePayload.pipeline_id = parsed.data.pipelineId;
  }
  if (parsed.data.stageId) {
    updatePayload.stage_id = parsed.data.stageId;
  }
  if (contactId !== null) {
    updatePayload.contact_id = contactId;
  }

  const { data: updated, error } = await supabase
    .from("crm_deals")
    .update(updatePayload)
    .eq("id", dealId)
    .eq("organization_id", auth.organizationId)
    .select("id");

  if (error) {
    console.error("[crm] deal update failed:", error.message);
    return { status: "error", error: err.updateFailed };
  }
  if (!updated || updated.length === 0) {
    return { status: "error", error: err.notFound };
  }

  revalidatePath("/crm");
  return { status: "success" };
}

/**
 * Deletes a pipeline deal. Requires `crm.manage`.
 */
export async function deleteDeal(dealId: string): Promise<CrmActionState> {
  const auth = await requireCrmPermission("crm.manage");
  if (!auth.ok) return auth.error;

  const dict = await getDictionary();
  const err = dict.platform.crm.errors;

  if (!dealId) {
    return { status: "error", error: err.missingId };
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("crm_deals")
    .delete()
    .eq("id", dealId)
    .eq("organization_id", auth.organizationId);

  if (error) {
    console.error("[crm] deal delete failed:", error.message);
    return { status: "error", error: err.updateFailed };
  }

  revalidatePath("/crm");
  return { status: "success" };
}