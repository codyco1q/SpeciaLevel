"use server";

import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUserContext } from "@/lib/auth/session";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Analytics & BI server actions.
 *
 * Security model:
 *  - `getAnalyticsSummary` re-validates `analytics.view` server-side (the
 *    same gate as the page) before it even touches the RPC, and the RPC
 *    itself (00016, SECURITY DEFINER) scopes every aggregate to
 *    `public.current_organization_id()` and re-checks `analytics.view` —
 *    defense in depth against a miswired future caller.
 *  - The action invokes `get_organization_analytics` TWICE: once for the
 *    selected window and once shifted back by `rangeDays` for the previous
 *    comparative period, and computes percentage deltas for the headline
 *    KPIs here (server-side, so the client only renders them).
 */

/** Range presets offered by the analytics controls header. */
export type AnalyticsRange = 7 | 30 | 90;

// ──────────────────────────────────────────────────────────────
// Public shapes (camelCase) returned by getAnalyticsSummary
// ──────────────────────────────────────────────────────────────

export interface AnalyticsPeriod {
  days: number;
  offsetDays: number;
  start: string;
  end: string;
}

export interface AnalyticsRevenue {
  totalInvoiced: number;
  collectedRevenue: number;
  outstandingBalance: number;
  paidInvoiceCount: number;
}

export interface AnalyticsCrm {
  newLeads: number;
  dealsWon: number;
  dealsLost: number;
  openDeals: number;
  pipelineValue: number;
  conversionRate: number;
}

export interface AnalyticsOperations {
  tasksCompleted: number;
  tasksOverdue: number;
  hoursTracked: number;
  avgCompletionHours: number;
}

export interface PipelineStageRow {
  stage: string;
  count: number;
  value: number;
}

export interface TeamMemberRow {
  profileId: string;
  fullName: string;
  tasksCompleted: number;
  hoursLogged: number;
}

export interface SeriesPoint {
  date: string;
  newLeads: number;
  dealsClosed: number;
  revenueBilled: number;
}

/**
 * A KPI plus its previous-period value. `delta` is the rounded percentage
 * change vs. the previous period and is `null` when the previous value is
 * zero (an unmeasurable "came from nothing" jump) — the UI renders a dash.
 */
export interface AnalyticsTrend {
  value: number;
  previous: number;
  delta: number | null;
}

export interface AnalyticsSummary {
  period: AnalyticsPeriod;
  revenue: AnalyticsRevenue;
  crm: AnalyticsCrm;
  operations: AnalyticsOperations;
  pipeline: PipelineStageRow[];
  team: TeamMemberRow[];
  series: SeriesPoint[];
  trends: {
    totalInvoiced: AnalyticsTrend;
    collectedRevenue: AnalyticsTrend;
    pipelineValue: AnalyticsTrend;
    conversionRate: AnalyticsTrend;
    tasksCompleted: AnalyticsTrend;
  };
}

export type GetAnalyticsSummaryResult =
  | { ok: true; summary: AnalyticsSummary }
  | { ok: false; error: string };

// ──────────────────────────────────────────────────────────────
// Raw 00016 RPC payload shapes (jsonb -> snake_case, loose typing)
// ──────────────────────────────────────────────────────────────

interface RawAnalytics {
  period?: {
    days?: unknown;
    offset_days?: unknown;
    start?: unknown;
    end?: unknown;
  } | null;
  revenue?: {
    total_invoiced?: unknown;
    collected_revenue?: unknown;
    outstanding_balance?: unknown;
    paid_invoice_count?: unknown;
  } | null;
  crm?: {
    new_leads?: unknown;
    deals_won?: unknown;
    deals_lost?: unknown;
    open_deals?: unknown;
    pipeline_value?: unknown;
    conversion_rate?: unknown;
  } | null;
  operations?: {
    tasks_completed?: unknown;
    tasks_overdue?: unknown;
    hours_tracked?: unknown;
    avg_completion_hours?: unknown;
  } | null;
  pipeline?: { stage?: unknown; count?: unknown; value?: unknown }[] | null;
  team?: {
    profile_id?: unknown;
    full_name?: unknown;
    tasks_completed?: unknown;
    hours_logged?: unknown;
  }[] | null;
  series?: {
    date?: unknown;
    new_leads?: unknown;
    deals_closed?: unknown;
    revenue_billed?: unknown;
  }[] | null;
}

const EMPTY_RAW: RawAnalytics = {};

/** Defensive coercion — jsonb numbers are numbers, but stay robust anyway. */
function toNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Rounded percentage change; null when the previous period was zero. */
function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Maps the raw RPC payloads (current + previous) into the public summary. */
function mapSummary(
  current: RawAnalytics,
  previous: RawAnalytics
): AnalyticsSummary {
  const period: AnalyticsPeriod = {
    days: toNumber(current.period?.days),
    offsetDays: toNumber(current.period?.offset_days),
    start: toText(current.period?.start),
    end: toText(current.period?.end),
  };

  const revenue: AnalyticsRevenue = {
    totalInvoiced: toNumber(current.revenue?.total_invoiced),
    collectedRevenue: toNumber(current.revenue?.collected_revenue),
    outstandingBalance: toNumber(current.revenue?.outstanding_balance),
    paidInvoiceCount: toNumber(current.revenue?.paid_invoice_count),
  };
  const prevRevenue: AnalyticsRevenue = {
    totalInvoiced: toNumber(previous.revenue?.total_invoiced),
    collectedRevenue: toNumber(previous.revenue?.collected_revenue),
    outstandingBalance: toNumber(previous.revenue?.outstanding_balance),
    paidInvoiceCount: toNumber(previous.revenue?.paid_invoice_count),
  };

  const crm: AnalyticsCrm = {
    newLeads: toNumber(current.crm?.new_leads),
    dealsWon: toNumber(current.crm?.deals_won),
    dealsLost: toNumber(current.crm?.deals_lost),
    openDeals: toNumber(current.crm?.open_deals),
    pipelineValue: toNumber(current.crm?.pipeline_value),
    conversionRate: toNumber(current.crm?.conversion_rate),
  };
  const prevCrm: AnalyticsCrm = {
    newLeads: toNumber(previous.crm?.new_leads),
    dealsWon: toNumber(previous.crm?.deals_won),
    dealsLost: toNumber(previous.crm?.deals_lost),
    openDeals: toNumber(previous.crm?.open_deals),
    pipelineValue: toNumber(previous.crm?.pipeline_value),
    conversionRate: toNumber(previous.crm?.conversion_rate),
  };

  const operations: AnalyticsOperations = {
    tasksCompleted: toNumber(current.operations?.tasks_completed),
    tasksOverdue: toNumber(current.operations?.tasks_overdue),
    hoursTracked: toNumber(current.operations?.hours_tracked),
    avgCompletionHours: toNumber(current.operations?.avg_completion_hours),
  };
  const prevOperations: AnalyticsOperations = {
    tasksCompleted: toNumber(previous.operations?.tasks_completed),
    tasksOverdue: toNumber(previous.operations?.tasks_overdue),
    hoursTracked: toNumber(previous.operations?.hours_tracked),
    avgCompletionHours: toNumber(previous.operations?.avg_completion_hours),
  };

  return {
    period,
    revenue,
    crm,
    operations,
    pipeline: (current.pipeline ?? []).map((row) => ({
      stage: toText(row.stage),
      count: toNumber(row.count),
      value: toNumber(row.value),
    })),
    team: (current.team ?? []).map((row) => ({
      profileId: toText(row.profile_id),
      fullName: toText(row.full_name),
      tasksCompleted: toNumber(row.tasks_completed),
      hoursLogged: toNumber(row.hours_logged),
    })),
    series: (current.series ?? []).map((point) => ({
      date: toText(point.date),
      newLeads: toNumber(point.new_leads),
      dealsClosed: toNumber(point.deals_closed),
      revenueBilled: toNumber(point.revenue_billed),
    })),
    trends: {
      totalInvoiced: {
        value: revenue.totalInvoiced,
        previous: prevRevenue.totalInvoiced,
        delta: pctChange(revenue.totalInvoiced, prevRevenue.totalInvoiced),
      },
      collectedRevenue: {
        value: revenue.collectedRevenue,
        previous: prevRevenue.collectedRevenue,
        delta: pctChange(revenue.collectedRevenue, prevRevenue.collectedRevenue),
      },
      pipelineValue: {
        value: crm.pipelineValue,
        previous: prevCrm.pipelineValue,
        delta: pctChange(crm.pipelineValue, prevCrm.pipelineValue),
      },
      conversionRate: {
        value: crm.conversionRate,
        previous: prevCrm.conversionRate,
        delta: pctChange(crm.conversionRate, prevCrm.conversionRate),
      },
      tasksCompleted: {
        value: operations.tasksCompleted,
        previous: prevOperations.tasksCompleted,
        delta: pctChange(
          operations.tasksCompleted,
          prevOperations.tasksCompleted
        ),
      },
    },
  };
}

/**
 * Fetches the analytics summary for a range (7/30/90 days) including the
 * percentage deltas vs. the previous comparative period. Requires
 * `analytics.view`; error strings come from the active locale's dictionary.
 */
export async function getAnalyticsSummary(
  rangeDays: AnalyticsRange
): Promise<GetAnalyticsSummaryResult> {
  const userContext = await getCurrentUserContext();
  const dict = await getDictionary();
  const err = dict.platform.analytics.errors;

  if (!userContext) {
    return { ok: false, error: err.signedIn };
  }
  if (!userContext.organization) {
    return { ok: false, error: err.noOrg };
  }
  if (!hasPermission("analytics.view", userContext.permissions)) {
    return { ok: false, error: err.noPermissionView };
  }

  const supabase = await createServerClient();

  // Current window + previous comparative window, fetched in parallel.
  const currentCall = supabase.rpc("get_organization_analytics", {
    p_range_days: rangeDays,
    p_offset_days: 0,
  });
  const previousCall = supabase.rpc("get_organization_analytics", {
    p_range_days: rangeDays,
    p_offset_days: rangeDays,
  });

  const [currentResult, previousResult] = await Promise.all([
    currentCall,
    previousCall,
  ]);

  if (currentResult.error || !currentResult.data) {
    console.error("[analytics] load failed:", currentResult.error?.message);
    return { ok: false, error: err.loadFailed };
  }

  const summary = mapSummary(
    currentResult.data as RawAnalytics,
    (previousResult.data as RawAnalytics | null) ?? EMPTY_RAW
  );

  return { ok: true, summary };
}