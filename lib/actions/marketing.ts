"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import {
  MARKETING_STATUSES,
  campaignIdSchema,
  createCampaignInputSchema,
  type MarketingStatus,
} from "@/lib/validations/marketing";
import { getDictionary } from "@/lib/i18n/get-dictionary";

/**
 * Marketing server actions.
 *
 * Security model:
 *  - `organization_id` and `created_by` are NEVER read from the payload —
 *    they come exclusively from `getCurrentUserContext()`, so a caller can
 *    only touch rows inside their own organization, as themselves.
 *  - Viewing requires `marketing.view`; creating/updating/deleting requires
 *    `marketing.manage` (the catalog permissions seeded by the 00018
 *    migration). The RLS policies additionally scope every query to
 *    `current_organization_id()`, so a user who somehow reaches a query
 *    with the permission still can only ever see their own tenant's rows.
 *  - Input is re-validated with Zod server-side (schema shared with the
 *    client forms).
 */

/** Public row shape for marketing campaigns (joined created-by profile). */
export interface MarketingCampaignRow {
  id: string;
  name: string;
  description: string | null;
  channel: string;
  status: string;
  budget: number;
  spend: number;
  startDate: string | null;
  endDate: string | null;
  targetAudience: string | null;
  utmCampaign: string | null;
  createdBy: {
    id: string;
    fullName: string | null;
    email: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

/** Raw PostgREST join shape for a marketing_campaigns row. */
interface MarketingCampaignJoinRow {
  id: string;
  name: string;
  description: string | null;
  channel: string;
  status: string;
  budget: number;
  spend: number;
  start_date: string | null;
  end_date: string | null;
  target_audience: string | null;
  utm_campaign: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  creator:
    | { id: string; full_name: string | null; email: string | null }
    | { id: string; full_name: string | null; email: string | null }[]
    | null;
}

const MARKETER_CREATOR_SELECT =
  "creator:profiles!fk_marketing_campaigns_created_by(id, full_name, email)";

const MARKETING_CAMPAIGN_SELECT = `
  id,
  name,
  description,
  channel,
  status,
  budget,
  spend,
  start_date,
  end_date,
  target_audience,
  utm_campaign,
  created_by,
  created_at,
  updated_at,
  ${MARKETER_CREATOR_SELECT}
`;

function toMarketingCampaignRow(row: MarketingCampaignJoinRow): MarketingCampaignRow {
  const creator = Array.isArray(row.creator) ? row.creator[0] : row.creator;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    channel: row.channel,
    status: row.status,
    budget: Number(row.budget ?? 0),
    spend: Number(row.spend ?? 0),
    startDate: row.start_date,
    endDate: row.end_date,
    targetAudience: row.target_audience,
    utmCampaign: row.utm_campaign,
    createdBy: creator
      ? {
          id: creator.id,
          fullName: creator.full_name,
          email: creator.email,
        }
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type MarketingAuthResult =
  | { ok: true; organizationId: string; userId: string }
  | { ok: false; error: string };

async function requireMarketingPermission(
  permission: "marketing.view" | "marketing.manage"
): Promise<MarketingAuthResult> {
  const userContext = await getCurrentUserContext();
  const dict = await getDictionary();
  const err = dict.platform.marketing.errors;

  if (!userContext) {
    return { ok: false, error: err.signedIn };
  }

  if (!hasPermission(permission, userContext.permissions)) {
    return {
      ok: false,
      error:
        permission === "marketing.manage"
          ? err.noPermissionManage
          : err.noPermissionView,
    };
  }

  const organizationId = userContext.organization?.id;
  if (!organizationId) {
    return { ok: false, error: err.noOrg };
  }

  return {
    ok: true,
    organizationId,
    userId: userContext.user.id,
  };
}

function parseFieldErrors(
  issues: z.ZodIssue[]
): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string") {
      (fieldErrors[key] ??= []).push(issue.message);
    }
  }
  return fieldErrors;
}

/**
 * Lists campaigns for the current organization, optionally filtered by
 * status. Requires `marketing.view`. Rows are returned newest-first.
 */
export async function getCampaigns(
  statusFilter?: "all" | MarketingStatus
): Promise<MarketingCampaignRow[] | null> {
  const auth = await requireMarketingPermission("marketing.view");
  if (!auth.ok) return null;

  const supabase = await createServerClient();

  let query = supabase
    .from("marketing_campaigns")
    .select(MARKETING_CAMPAIGN_SELECT)
    .eq("organization_id", auth.organizationId)
    .order("created_at", { ascending: false });

  if (
    statusFilter &&
    statusFilter !== "all" &&
    (MARKETING_STATUSES as readonly string[]).includes(statusFilter)
  ) {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[marketing] list failed:", error.message);
    return null;
  }

  return (data ?? []).map(
    (row) => toMarketingCampaignRow(row as unknown as MarketingCampaignJoinRow)
  );
}

export type CreateCampaignResult =
  | { status: "success"; campaign: MarketingCampaignRow }
  | { status: "error"; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Creates a campaign in the current organization. Requires
 * `marketing.manage`. All fields are re-validated server-side via the
 * shared Zod schema; `organization_id` and `created_by` always come from
 * the session.
 */
export async function createCampaign(
  data: unknown
): Promise<CreateCampaignResult> {
  const auth = await requireMarketingPermission("marketing.manage");
  if (!auth.ok) return { status: "error", error: auth.error };

  const dict = await getDictionary();
  const errors = dict.platform.marketing.errors;

  const parsed = createCampaignInputSchema(errors).safeParse(data);
  if (!parsed.success) {
    return {
      status: "error",
      error: errors.highlightFields,
      fieldErrors: parseFieldErrors(parsed.error.issues),
    };
  }

  const {
    name,
    description,
    channel,
    status,
    budget,
    spend,
    startDate,
    endDate,
    targetAudience,
    utmCampaign,
  } = parsed.data;

  const supabase = await createServerClient();
  const { data: inserted, error } = await supabase
    .from("marketing_campaigns")
    .insert({
      organization_id: auth.organizationId,
      name,
      description: description || null,
      channel,
      status,
      budget,
      spend,
      start_date: startDate || null,
      end_date: endDate || null,
      target_audience: targetAudience || null,
      utm_campaign: utmCampaign || null,
      created_by: auth.userId,
    })
    .select(MARKETING_CAMPAIGN_SELECT)
    .single();

  if (error) {
    console.error("[marketing] create failed:", error.message);
    return { status: "error", error: errors.createFailed };
  }

  revalidatePath("/marketing");
  return {
    status: "success",
    campaign: toMarketingCampaignRow(
      inserted as unknown as MarketingCampaignJoinRow
    ),
  };
}

export type UpdateCampaignResult =
  | { status: "success"; campaign: MarketingCampaignRow }
  | { status: "error"; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Updates an existing campaign. Requires `marketing.manage`. The same
 * Zod schema as create is re-validated server-side, and the update is
 * scoped to the caller's organization.
 */
export async function updateCampaign(
  id: string,
  data: unknown
): Promise<UpdateCampaignResult> {
  const auth = await requireMarketingPermission("marketing.manage");
  if (!auth.ok) return { status: "error", error: auth.error };

  const dict = await getDictionary();
  const errors = dict.platform.marketing.errors;

  const idParsed = campaignIdSchema(errors.invalidId).safeParse({ id });
  if (!idParsed.success) {
    return { status: "error", error: errors.invalidId };
  }

  const parsed = createCampaignInputSchema(errors).safeParse(data);
  if (!parsed.success) {
    return {
      status: "error",
      error: errors.highlightFields,
      fieldErrors: parseFieldErrors(parsed.error.issues),
    };
  }

  const {
    name,
    description,
    channel,
    status,
    budget,
    spend,
    startDate,
    endDate,
    targetAudience,
    utmCampaign,
  } = parsed.data;

  const supabase = await createServerClient();
  const { data: updated, error } = await supabase
    .from("marketing_campaigns")
    .update({
      name,
      description: description || null,
      channel,
      status,
      budget,
      spend,
      start_date: startDate || null,
      end_date: endDate || null,
      target_audience: targetAudience || null,
      utm_campaign: utmCampaign || null,
    })
    .eq("id", idParsed.data.id)
    .eq("organization_id", auth.organizationId)
    .select(MARKETING_CAMPAIGN_SELECT)
    .maybeSingle();

  if (error || !updated) {
    console.error("[marketing] update failed:", error?.message);
    return { status: "error", error: errors.notFound };
  }

  revalidatePath("/marketing");
  return {
    status: "success",
    campaign: toMarketingCampaignRow(
      updated as unknown as MarketingCampaignJoinRow
    ),
  };
}

export type DeleteCampaignResult =
  | { status: "success"; id: string }
  | { status: "error"; error: string };

/**
 * Deletes a campaign (cascade removes its assets). Requires
 * `marketing.manage`. Scoped to the caller's organization.
 */
export async function deleteCampaign(id: string): Promise<DeleteCampaignResult> {
  const auth = await requireMarketingPermission("marketing.manage");
  if (!auth.ok) return { status: "error", error: auth.error };

  const dict = await getDictionary();
  const errors = dict.platform.marketing.errors;

  const idParsed = campaignIdSchema(errors.invalidId).safeParse({ id });
  if (!idParsed.success) {
    return { status: "error", error: errors.invalidId };
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("marketing_campaigns")
    .delete()
    .eq("id", idParsed.data.id)
    .eq("organization_id", auth.organizationId);

  if (error) {
    console.error("[marketing] delete failed:", error.message);
    return { status: "error", error: errors.deleteFailed };
  }

  revalidatePath("/marketing");
  return { status: "success", id: idParsed.data.id };
}

/** One channel in the distribution summary. */
export interface MarketingChannelRow {
  channel: string;
  count: number;
  budget: number;
  spend: number;
}

/** Aggregates computed from all the org's campaigns. */
export interface MarketingMetrics {
  /** Campaigns currently in the "active" status. */
  activeCampaigns: number;
  /** Sum of budgets across active campaigns. */
  allocatedBudget: number;
  /** Sum of spend across every campaign. */
  spendToDate: number;
  /** Total campaigns in the organization. */
  totalCampaigns: number;
  /** Per-channel count/budget/spend (for the distribution strip). */
  channels: MarketingChannelRow[];
}

/**
 * Computes the marketing KPIs (active campaigns, allocated budget, spend
 * to date, channel distribution) for the current organization. Requires
 * `marketing.view`. The aggregation is small (single org) and computed in
 * the server action so the client never needs raw rows for the cards.
 */
export async function getMarketingMetrics(): Promise<MarketingMetrics | null> {
  const auth = await requireMarketingPermission("marketing.view");
  if (!auth.ok) return null;

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("marketing_campaigns")
    .select("status, budget, spend, channel")
    .eq("organization_id", auth.organizationId);

  if (error) {
    console.error("[marketing] metrics failed:", error.message);
    return null;
  }

  const rows = data ?? [];
  const activeRows = rows.filter((row) => row.status === "active");

  const channelMap = new Map<string, MarketingChannelRow>();
  for (const row of rows) {
    const entry =
      channelMap.get(row.channel) ?? {
        channel: row.channel,
        count: 0,
        budget: 0,
        spend: 0,
      };
    entry.count += 1;
    entry.budget += Number(row.budget ?? 0);
    entry.spend += Number(row.spend ?? 0);
    channelMap.set(row.channel, entry);
  }

  return {
    activeCampaigns: activeRows.length,
    allocatedBudget: activeRows.reduce(
      (sum, row) => sum + Number(row.budget ?? 0),
      0
    ),
    spendToDate: rows.reduce((sum, row) => sum + Number(row.spend ?? 0), 0),
    totalCampaigns: rows.length,
    channels: Array.from(channelMap.values()).sort(
      (a, b) => b.count - a.count
    ),
  };
}