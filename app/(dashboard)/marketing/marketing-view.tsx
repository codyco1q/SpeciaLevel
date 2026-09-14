"use client";

import { useState, useTransition } from "react";
import {
  Megaphone,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  deleteCampaign,
  getCampaigns,
  getMarketingMetrics,
  type MarketingCampaignRow,
  type MarketingMetrics,
} from "@/lib/actions/marketing";
import {
  MARKETING_CHANNEL_BADGE_CLASSES,
  MARKETING_STATUS_BADGE_CLASSES,
  formatCampaignDateRange,
  formatCampaignMoney,
} from "./marketing-meta";
import { MarketingDialog } from "./marketing-dialog";
import type {
  MarketingChannel,
  MarketingStatus,
} from "@/lib/validations/marketing";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
}

/** Summary card styled like the dashboard's metric cards. */
function MetricCard({ icon: Icon, label, value, hint }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{label}</h3>
      </div>
      <p className="text-3xl font-bold tracking-tight tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

const STATUS_FILTERS: ("all" | MarketingStatus)[] = [
  "all",
  "draft",
  "active",
  "paused",
  "completed",
];

interface MarketingViewProps {
  initialCampaigns: MarketingCampaignRow[];
  initialMetrics: MarketingMetrics;
  canManage: boolean;
  /** Localized copy for the current render. */
  platform: Dictionary["platform"];
  locale: Locale;
}

/**
 * Marketing orchestrator: KPI cards, channel distribution strip, status
 * filter, the campaigns table (channel badge + status pill + budget-vs-spend
 * progress bar + actions menu), and the create/edit dialog. Mutations run
 * through the server actions and the list + metrics are refetched
 * afterwards — the same "revalidate + refetch" pattern as the other modules.
 */
export function MarketingView({
  initialCampaigns,
  initialMetrics,
  canManage,
  platform,
  locale,
}: MarketingViewProps) {
  const t = platform.marketing;
  const common = platform.common;

  const [campaigns, setCampaigns] = useState<MarketingCampaignRow[]>(
    initialCampaigns
  );
  const [metrics, setMetrics] = useState<MarketingMetrics>(initialMetrics);
  const [statusFilter, setStatusFilter] = useState<"all" | MarketingStatus>(
    "all"
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MarketingCampaignRow | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  /** Refetch the campaign list + KPIs after any mutation. */
  async function refreshAll() {
    const [list, nextMetrics] = await Promise.all([
      getCampaigns(),
      getMarketingMetrics(),
    ]);
    if (list) setCampaigns(list);
    if (nextMetrics) setMetrics(nextMetrics);
  }

  function openCreate() {
    setActionError(null);
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(row: MarketingCampaignRow) {
    setActionError(null);
    setEditing(row);
    setDialogOpen(true);
  }

  function handleSaved() {
    setDialogOpen(false);
    setEditing(null);
    setActionError(null);
    void refreshAll();
  }

  /** Row-level two-step delete: first click arms, second click deletes. */
  function handleRowDeleteClick(row: MarketingCampaignRow) {
    setActionError(null);
    if (confirmDeleteId === row.id) {
      setConfirmDeleteId(null);
      startTransition(async () => {
        const result = await deleteCampaign(row.id);
        if (result.status === "error") {
          setActionError(result.error);
          return;
        }
        setCampaigns((current) =>
          current.filter((item) => item.id !== row.id)
        );
        void refreshAll();
      });
    } else {
      setConfirmDeleteId(row.id);
    }
  }

  const visibleCampaigns =
    statusFilter === "all"
      ? campaigns
      : campaigns.filter((campaign) => campaign.status === statusFilter);

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        {canManage && (
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            {t.newCampaign}
          </Button>
        )}
      </div>

      {actionError && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {actionError}
        </div>
      )}

      {/* KPI summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          icon={Megaphone}
          label={t.metrics.activeCampaigns}
          value={String(metrics.activeCampaigns)}
          hint={t.metrics.activeCampaignsHint}
        />
        <MetricCard
          icon={Wallet}
          label={t.metrics.allocatedBudget}
          value={formatCampaignMoney(metrics.allocatedBudget, locale)}
          hint={t.metrics.allocatedBudgetHint}
        />
        <MetricCard
          icon={TrendingUp}
          label={t.metrics.spendToDate}
          value={formatCampaignMoney(metrics.spendToDate, locale)}
          hint={t.metrics.spendToDateHint}
        />
      </div>

      {/* Channel distribution strip */}
      {metrics.channels.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="me-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t.channelsLabel}
          </span>
          {metrics.channels.map((row) => (
            <span
              key={row.channel}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
                MARKETING_CHANNEL_BADGE_CLASSES[
                  row.channel as MarketingChannel
                ] ??
                  MARKETING_CHANNEL_BADGE_CLASSES.other
              )}
            >
              {t.channels[row.channel as keyof typeof t.channels] ?? row.channel}
              <span className="font-semibold tabular-nums">{row.count}</span>
            </span>
          ))}
        </div>
      )}

      {/* Status filter */}
      <div className="mb-4 mt-6 flex flex-wrap items-center gap-1.5">
        {STATUS_FILTERS.map((filter) => {
          const isActive = statusFilter === filter;
          return (
            <button
              key={filter}
              type="button"
              onClick={() => setStatusFilter(filter)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                isActive
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-accent"
              )}
            >
              {filter === "all" ? t.allStatuses : t.statuses[filter]}
            </button>
          );
        })}
      </div>

      {/* Campaigns table */}
      {campaigns.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <Megaphone className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
          <p className="text-sm font-medium text-muted-foreground">
            {t.noCampaignsYet}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {canManage ? t.noCampaignsHintManage : t.noCampaignsHintView}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.table.name}</TableHead>
                <TableHead>{t.table.channel}</TableHead>
                <TableHead>{t.table.status}</TableHead>
                <TableHead>{t.table.budget}</TableHead>
                <TableHead>{t.table.dateRange}</TableHead>
                <TableHead className="text-end">{common.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleCampaigns.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    {t.noCampaignsYet}
                  </TableCell>
                </TableRow>
              ) : (
                visibleCampaigns.map((campaign) => {
                  const percent =
                    campaign.budget > 0
                      ? Math.min(100, (campaign.spend / campaign.budget) * 100)
                      : 0;
                  return (
                    <TableRow key={campaign.id}>
                      <TableCell>
                        <div className="max-w-[260px]">
                          <p className="font-medium">{campaign.name}</p>
                          {campaign.targetAudience && (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {campaign.targetAudience}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "px-2 py-0.5 text-xs",
                            MARKETING_CHANNEL_BADGE_CLASSES[
                              campaign.channel as MarketingChannel
                            ] ?? MARKETING_CHANNEL_BADGE_CLASSES.other
                          )}
                        >
                          {t.channels[campaign.channel as keyof typeof t.channels] ??
                            campaign.channel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "px-2 py-0.5 text-xs",
                            MARKETING_STATUS_BADGE_CLASSES[
                              campaign.status as MarketingStatus
                            ]
                          )}
                        >
                          {t.statuses[campaign.status as MarketingStatus]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div
                          className="min-w-[150px]"
                          title={t.table.spentLabel
                            .replace(
                              "{spend}",
                              formatCampaignMoney(campaign.spend, locale)
                            )
                            .replace(
                              "{budget}",
                              formatCampaignMoney(campaign.budget, locale)
                            )}
                        >
                          <div className="flex items-baseline justify-between gap-3 text-xs">
                            <span className="font-medium tabular-nums">
                              {formatCampaignMoney(campaign.spend, locale)}
                            </span>
                            <span className="tabular-nums text-muted-foreground">
                              / {formatCampaignMoney(campaign.budget, locale)}
                            </span>
                          </div>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary transition-[width]"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatCampaignDateRange(
                          campaign.startDate,
                          campaign.endDate,
                          locale
                        )}
                      </TableCell>
                      <TableCell className="text-end">
                        {canManage && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                aria-label={common.actions}
                              >
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>
                                {campaign.name}
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onSelect={() => openEdit(campaign)}
                              >
                                <Pencil />
                                {common.edit}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => handleRowDeleteClick(campaign)}
                              >
                                <Trash2 />
                                {confirmDeleteId === campaign.id
                                  ? common.confirmDelete
                                  : common.delete}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {confirmDeleteId && (
        <p className="mt-3 text-xs text-muted-foreground">
          {t.errors.deleteConfirmBody}
        </p>
      )}

      <MarketingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        campaign={editing}
        onSaved={handleSaved}
        platform={platform}
      />
    </div>
  );
}