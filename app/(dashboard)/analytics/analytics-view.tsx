"use client";

import { useState, useTransition } from "react";
import {
  BarChart3,
  Briefcase,
  CheckSquare2,
  Clock,
  DollarSign,
  Download,
  Percent,
  Receipt,
  TrendingDown,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getAnalyticsSummary,
  type AnalyticsRange,
  type AnalyticsSummary,
  type PipelineStageRow,
  type SeriesPoint,
  type TeamMemberRow,
} from "@/lib/actions/analytics";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

/** Range presets offered by the analytics controls header. */
const ANALYTICS_RANGES: AnalyticsRange[] = [7, 30, 90];

// ──────────────────────────────────────────────────────────────
// Locale-aware formatters
// ──────────────────────────────────────────────────────────────

function formatCurrency(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(
  value: number,
  locale: Locale,
  maxFractionDigits = 0
): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : locale, {
    maximumFractionDigits: maxFractionDigits,
  }).format(value);
}

function formatDateLabel(iso: string, locale: Locale): string {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : locale, {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatPeriodDate(iso: string, locale: Locale): string {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

/** Compact magnitudes for chart axis labels. */
function compactNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(Math.round(value));
}

// ──────────────────────────────────────────────────────────────
// Presentational building blocks
// ──────────────────────────────────────────────────────────────

/** Green/red/neutral pill for a KPI's % change vs. the previous period. */
function TrendPill({ delta }: { delta: number | null }) {
  if (delta === null) {
    // No measurable baseline (previous period flat) — universal dash.
    return (
      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        —
      </span>
    );
  }
  if (delta === 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
        0%
      </span>
    );
  }
  const isUp = delta > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
        isUp
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "bg-red-500/10 text-red-600 dark:text-red-400"
      )}
    >
      {isUp ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3 rtl:rotate-180" />
      )}
      {isUp ? "+" : ""}
      {delta}%
    </span>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  delta,
  hint,
  vsLabel,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  delta: number | null;
  hint: string;
  vsLabel: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </span>
          <h3 className="truncate text-sm font-semibold leading-tight">
            {label}
          </h3>
        </div>
        <TrendPill delta={delta} />
      </div>
      <p className="mt-3 truncate text-2xl font-bold tracking-tight tabular-nums">
        {value}
      </p>
      <p
        className="mt-1 truncate text-xs text-muted-foreground"
        title={`${vsLabel} · ${hint}`}
      >
        {vsLabel} · {hint}
      </p>
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  action,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-6 shadow-sm",
        className
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Chart blocks (dependency-free SVG / CSS — no chart library)
// ──────────────────────────────────────────────────────────────

/** Area chart of revenue billed per bucket (SVG, non-distorting strokes). */
function RevenueTrendChart({
  series,
  locale,
  legendLabel,
  noDataLabel,
}: {
  series: SeriesPoint[];
  locale: Locale;
  legendLabel: string;
  noDataLabel: string;
}) {
  if (series.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        {noDataLabel}
      </p>
    );
  }

  const values = series.map((point) => point.revenueBilled);
  const maxValue = Math.max(...values, 1);
  const W = 640;
  const H = 180;
  const PAD_X = 8;
  const PAD_Y = 12;
  const innerWidth = W - PAD_X * 2;
  const innerHeight = H - PAD_Y * 2;

  const x = (index: number) =>
    series.length === 1
      ? W / 2
      : PAD_X + (index * innerWidth) / (series.length - 1);
  const y = (value: number) => H - PAD_Y - (value / maxValue) * innerHeight;

  const linePoints = series
    .map(
      (point, index) =>
        `${x(index).toFixed(1)},${y(point.revenueBilled).toFixed(1)}`
    )
    .join(" ");

  const areaPath =
    `M ${x(0).toFixed(1)} ${y(series[0].revenueBilled).toFixed(1)} ` +
    linePoints
      .split(" ")
      .slice(1)
      .map((pair) => `L ${pair}`)
      .join(" ") +
    ` L ${x(series.length - 1).toFixed(1)} ${(H - PAD_Y).toFixed(1)}` +
    ` L ${x(0).toFixed(1)} ${(H - PAD_Y).toFixed(1)} Z`;

  // ~6 evenly-spaced x-axis labels regardless of bucket count.
  const labelCount = Math.min(6, series.length);
  const labelIndexes = new Set<number>(
    Array.from({ length: labelCount }, (_, i) =>
      Math.round((i * (series.length - 1)) / (labelCount - 1))
    )
  );

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
          {legendLabel}
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {compactNumber(maxValue)}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={legendLabel}
      >
        <defs>
          <linearGradient id="analytics-revenue-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line
          x1={PAD_X}
          y1={H - PAD_Y}
          x2={W - PAD_X}
          y2={H - PAD_Y}
          className="stroke-border"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={areaPath}
          fill="url(#analytics-revenue-fill)"
          className="text-primary"
        />
        <polyline
          points={linePoints}
          fill="none"
          className="stroke-primary"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="mt-1.5 flex w-full">
        {series.map((point, index) => (
          <span
            key={point.date}
            className="min-w-0 flex-1 truncate text-center text-[11px] tabular-nums text-muted-foreground"
          >
            {labelIndexes.has(index) ? formatDateLabel(point.date, locale) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Funnel-style per-stage breakdown rendered as scaled CSS bars. */
const STAGE_BAR_CLASSES: Record<string, string> = {
  lead: "bg-primary/70",
  contacted: "bg-primary/55",
  proposal: "bg-primary/40",
  won: "bg-emerald-500/70",
  lost: "bg-red-500/60",
};

function PipelineFunnel({
  pipeline,
  locale,
  stages,
  dealsLabel,
  noDataLabel,
}: {
  pipeline: PipelineStageRow[];
  locale: Locale;
  stages: Record<string, string>;
  dealsLabel: string;
  noDataLabel: string;
}) {
  if (pipeline.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        {noDataLabel}
      </p>
    );
  }

  const maxCount = Math.max(...pipeline.map((row) => row.count), 1);

  return (
    <ul className="space-y-4">
      {pipeline.map((row) => {
        const label = stages[row.stage] ?? row.stage;
        const width = Math.max(6, (row.count / maxCount) * 100);
        return (
          <li key={row.stage}>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">{label}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {formatNumber(row.count, locale)} {dealsLabel} ·{" "}
                {formatCurrency(row.value, locale)}
              </span>
            </div>
            <div
              className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`${label}: ${row.count}`}
            >
              <div
                className={cn(
                  "h-full rounded-full",
                  STAGE_BAR_CLASSES[row.stage] ?? "bg-primary/60"
                )}
                style={{ width: `${width}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Per-member completed-task + logged-hours rows. */
function TeamProductivity({
  team,
  locale,
  tasksLabel,
  hoursLabel,
  noDataLabel,
}: {
  team: TeamMemberRow[];
  locale: Locale;
  tasksLabel: string;
  hoursLabel: string;
  noDataLabel: string;
}) {
  if (team.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        {noDataLabel}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border/60">
      {team.map((member) => (
        <li
          key={member.profileId}
          className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
        >
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
              {(member.fullName || "?").charAt(0).toUpperCase()}
            </span>
            <p className="truncate text-sm font-medium">
              {member.fullName || "—"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-4 text-sm tabular-nums text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CheckSquare2 className="h-3.5 w-3.5" />
              {formatNumber(member.tasksCompleted, locale)}
              <span className="hidden text-xs sm:inline">{tasksLabel}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {formatNumber(member.hoursLogged, locale, 1)}
              <span className="hidden text-xs sm:inline">{hoursLabel}</span>
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
// ──────────────────────────────────────────────────────────────
// CSV export
// ──────────────────────────────────────────────────────────────

/** Builds the analytics export as a UTF-8 (BOM) CSV document. */
function buildCsv(summary: AnalyticsSummary): string {
  const lines: string[] = [
    `Period (${summary.period.days} days),${summary.period.start},${summary.period.end}`,
    "",
    "Metric,Value",
    `Total invoiced,${summary.revenue.totalInvoiced}`,
    `Collected revenue,${summary.revenue.collectedRevenue}`,
    `Outstanding balance,${summary.revenue.outstandingBalance}`,
    `Paid invoices,${summary.revenue.paidInvoiceCount}`,
    `New leads,${summary.crm.newLeads}`,
    `Deals won,${summary.crm.dealsWon}`,
    `Deals lost,${summary.crm.dealsLost}`,
    `Open deals,${summary.crm.openDeals}`,
    `Pipeline value,${summary.crm.pipelineValue}`,
    `Conversion rate,${summary.crm.conversionRate}%`,
    `Tasks completed,${summary.operations.tasksCompleted}`,
    `Tasks overdue,${summary.operations.tasksOverdue}`,
    `Hours tracked,${summary.operations.hoursTracked}`,
    `Avg completion hours,${summary.operations.avgCompletionHours}`,
    "",
    "Date,New leads,Deals closed,Revenue billed",
    ...summary.series.map(
      (point) =>
        `${point.date},${point.newLeads},${point.dealsClosed},${point.revenueBilled}`
    ),
    "",
    "Team member,Tasks completed,Hours logged",
    ...summary.team.map(
      (member) =>
        `"${member.fullName}",${member.tasksCompleted},${member.hoursLogged}`
    ),
  ];
  return lines.join("\n");
}
// ──────────────────────────────────────────────────────────────
// Analytics view orchestrator
// ──────────────────────────────────────────────────────────────

interface AnalyticsViewProps {
  initialSummary: AnalyticsSummary | null;
  initialError?: string | null;
  /** Localized copy + formatters for the current render. */
  platform: Dictionary["platform"];
  locale: Locale;
}

export function AnalyticsView({
  initialSummary,
  initialError,
  platform,
  locale,
}: AnalyticsViewProps) {
  const t = platform.analytics;

  const [range, setRange] = useState<AnalyticsRange>(30);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(
    initialSummary
  );
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [isPending, startTransition] = useTransition();

  const vsLabel = t.vsPrevious.replace(
    "{days}",
    String(summary?.period.days ?? range)
  );

  /** Fetches a different range through the getAnalyticsSummary action. */
  function loadRange(next: AnalyticsRange) {
    if (next === range && summary) return;
    startTransition(async () => {
      const result = await getAnalyticsSummary(next);
      if (result.ok) {
        setSummary(result.summary);
        setError(null);
        setRange(next);
      } else {
        setError(result.error);
      }
    });
  }

  /** Downloads the raw summary as CSV (client-side, no server round-trip). */
  function downloadCsv() {
    if (!summary) return;
    const blob = new Blob([`\uFEFF${buildCsv(summary)}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download =
      `analytics-${summary.period.start}-${summary.period.end}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      {/* Controls header */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
          {summary && (
            <p className="mt-1 text-xs tabular-nums text-muted-foreground">
              {formatPeriodDate(summary.period.start, locale)} —{" "}
              {formatPeriodDate(summary.period.end, locale)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label={t.rangeLabel}
            className="flex items-center rounded-lg border border-border bg-muted p-0.5"
          >
            {ANALYTICS_RANGES.map((option) => (
              <button
                key={option}
                type="button"
                disabled={isPending}
                onClick={() => loadRange(option)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  range === option
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                  isPending && "cursor-wait opacity-60"
                )}
              >
                {option === 7 ? t.range7 : option === 30 ? t.range30 : t.range90}
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={downloadCsv}
            disabled={!summary || isPending}
          >
            <Download className="h-4 w-4" />
            {t.export}
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          {error}
        </div>
      )}

      {/* Loading state (range switching mid-flight) */}
      {isPending && !summary && (
        <p className="py-16 text-center text-sm text-muted-foreground">
          {t.loading}
        </p>
      )}

      {summary && (
        <>
          {/* KPI summary grid */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              icon={DollarSign}
              label={t.kpis.totalRevenue}
              value={formatCurrency(summary.revenue.totalInvoiced, locale)}
              delta={summary.trends.totalInvoiced.delta}
              hint={t.kpis.totalRevenueHint}
              vsLabel={vsLabel}
            />
            <KpiCard
              icon={TrendingUp}
              label={t.kpis.pipelineValue}
              value={formatCurrency(summary.crm.pipelineValue, locale)}
              delta={summary.trends.pipelineValue.delta}
              hint={t.kpis.pipelineValueHint}
              vsLabel={vsLabel}
            />
            <KpiCard
              icon={Percent}
              label={t.kpis.conversionRate}
              value={`${formatNumber(summary.crm.conversionRate, locale, 1)}%`}
              delta={summary.trends.conversionRate.delta}
              hint={t.kpis.conversionRateHint}
              vsLabel={vsLabel}
            />
            <KpiCard
              icon={CheckSquare2}
              label={t.kpis.tasksCompleted}
              value={formatNumber(summary.operations.tasksCompleted, locale)}
              delta={summary.trends.tasksCompleted.delta}
              hint={t.kpis.tasksCompletedHint}
              vsLabel={vsLabel}
            />
          </div>

          {/* Charts: revenue trend + pipeline funnel */}
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <SectionCard icon={Receipt} title={t.charts.revenueTrend}>
              <RevenueTrendChart
                series={summary.series}
                locale={locale}
                legendLabel={t.charts.revenueTrendLegend}
                noDataLabel={t.noData}
              />
            </SectionCard>
            <SectionCard icon={TrendingUp} title={t.charts.pipelineFunnel}>
              <PipelineFunnel
                pipeline={summary.pipeline}
                locale={locale}
                stages={t.stages}
                dealsLabel={t.charts.deals}
                noDataLabel={t.noData}
              />
            </SectionCard>
          </div>

          {/* Secondary metrics by domain */}
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <SectionCard icon={DollarSign} title={t.revenue.title}>
              <DetailItem
                label={t.revenue.totalInvoiced}
                value={formatCurrency(summary.revenue.totalInvoiced, locale)}
              />
              <DetailItem
                label={t.revenue.collected}
                value={formatCurrency(summary.revenue.collectedRevenue, locale)}
              />
              <DetailItem
                label={t.revenue.outstanding}
                value={formatCurrency(
                  summary.revenue.outstandingBalance,
                  locale
                )}
              />
              <DetailItem
                label={t.revenue.paidInvoices}
                value={formatNumber(summary.revenue.paidInvoiceCount, locale)}
              />
            </SectionCard>
            <SectionCard icon={Briefcase} title={t.crm.title}>
              <DetailItem
                label={t.crm.newLeads}
                value={formatNumber(summary.crm.newLeads, locale)}
              />
              <DetailItem
                label={t.crm.won}
                value={formatNumber(summary.crm.dealsWon, locale)}
              />
              <DetailItem
                label={t.crm.lost}
                value={formatNumber(summary.crm.dealsLost, locale)}
              />
              <DetailItem
                label={t.crm.open}
                value={formatNumber(summary.crm.openDeals, locale)}
              />
            </SectionCard>
            <SectionCard icon={Clock} title={t.operations.title}>
              <DetailItem
                label={t.operations.overdue}
                value={formatNumber(summary.operations.tasksOverdue, locale)}
              />
              <DetailItem
                label={t.operations.hours}
                value={formatNumber(summary.operations.hoursTracked, locale, 1)}
              />
              <DetailItem
                label={t.operations.avgCompletion}
                value={formatNumber(
                  summary.operations.avgCompletionHours,
                  locale,
                  1
                )}
              />
            </SectionCard>
          </div>

          {/* Team productivity */}
          <div className="mt-6">
            <SectionCard icon={Users} title={t.team.title}>
              <TeamProductivity
                team={summary.team}
                locale={locale}
                tasksLabel={t.team.tasks}
                hoursLabel={t.team.hours}
                noDataLabel={t.noData}
              />
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}