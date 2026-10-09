"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Contact,
  DollarSign,
  Layers,
  Percent,
  Plus,
  TrendingUp,
  Trophy,
  User,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
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
  getDeals,
  getMarketingLeads,
  getPipelines,
  updateDealStage,
  type DealRow,
  type MarketingLeadRow,
  type PipelineRow,
  type PipelineStageRow,
} from "@/lib/actions/crm";
import {
  getStageDotClass,
  getStageName,
  getStageColor,
  getStageBadgeStyle,
  LEAD_STATUS_BADGE_CLASSES,
  formatCurrency,
  formatLeadDate,
} from "./crm-meta";
import { DealDialog, type CrmMemberOption } from "./deal-dialog";
import { DealDetailDialog } from "./deal-detail-dialog";
import { PipelineManagerDialog } from "./pipeline-manager-dialog";
import { WinLossDialog } from "./win-loss-dialog";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

interface DealCardProps {
  deal: DealRow;
  stageObj?: PipelineStageRow;
  onMove: (dealId: string, stageId: string) => void;
  onSelect: (deal: DealRow) => void;
  platform: Dictionary["platform"];
  locale: Locale;
  hasPrev: boolean;
  hasNext: boolean;
  prevStageId?: string;
  nextStageId?: string;
  canManage?: boolean;
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent, deal: DealRow) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

function DealCard({
  deal,
  stageObj,
  onMove,
  onSelect,
  platform,
  locale,
  hasPrev,
  hasNext,
  prevStageId,
  nextStageId,
  canManage,
  isDragging,
  onDragStart,
  onDragEnd,
}: DealCardProps) {
  const t = platform.crm;
  const daysSinceUpdate = Math.floor(
    (Date.now() - new Date(deal.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  const isStale =
    stageObj &&
    stageObj.probability > 0 &&
    stageObj.probability < 100 &&
    daysSinceUpdate >= stageObj.staleDays;

  const isWon = deal.wonReason !== null || deal.stage.toLowerCase() === "won";
  const isLost = deal.lostReason !== null || deal.stage.toLowerCase() === "lost";

  return (
    <div
      draggable={canManage}
      onDragStart={(e) => {
        if (!canManage) return;
        e.dataTransfer.setData(
          "application/json",
          JSON.stringify({ dealId: deal.id, sourceStageId: stageObj?.id })
        );
        e.dataTransfer.setData("text/plain", deal.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.(e, deal);
      }}
      onDragEnd={onDragEnd}
      onClick={() => onSelect(deal)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(deal);
        }
      }}
      className={cn(
        "cursor-pointer rounded-lg border border-border bg-card p-3 shadow-xs transition-all hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring select-none",
        isDragging && "shadow-2xl rotate-1 scale-[1.02] opacity-75 ring-2 ring-primary/50 border-primary transition-transform"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-snug text-foreground line-clamp-2">
          {deal.title}
        </p>
        {isWon && (
          <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] px-1 py-0 shrink-0">
            <Trophy className="size-2.5 me-0.5" />
            {t.stages.won}
          </Badge>
        )}
        {isLost && (
          <Badge variant="outline" className="border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] px-1 py-0 shrink-0">
            <XCircle className="size-2.5 me-0.5" />
            {t.stages.lost}
          </Badge>
        )}
        {!isWon && !isLost && (stageObj || deal.stageObj) && (
          <span
            className="text-[10px] px-1.5 py-0.2 rounded font-semibold border shrink-0"
            style={getStageBadgeStyle((stageObj || deal.stageObj)?.color)}
          >
            {getStageName((stageObj || deal.stageObj)!.name, t.stages as Record<string, string>)}
          </span>
        )}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {deal.contact && (
          <span className="inline-flex min-w-0 items-center gap-1">
            <Building2 className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {deal.contact.company || deal.contact.name}
            </span>
          </span>
        )}
        {deal.assignee && (
          <span className="inline-flex min-w-0 items-center gap-1">
            <User className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {deal.assignee.fullName ?? deal.assignee.email ?? t.member}
            </span>
          </span>
        )}
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <p className="text-sm font-bold tracking-tight tabular-nums text-foreground">
          {formatCurrency(deal.value, deal.currency, locale)}
        </p>

        {isStale && (
          <Badge
            variant="outline"
            className="border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400 gap-1 text-[10px] px-1.5 py-0 shrink-0"
          >
            <Clock className="size-2.5" />
            {t.pipelines.staleBadge} {daysSinceUpdate}d
          </Badge>
        )}
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-1 border-t border-border/60 pt-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!hasPrev || !prevStageId}
          onClick={(e) => {
            e.stopPropagation();
            if (prevStageId) onMove(deal.id, prevStageId);
          }}
          className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
          aria-label={t.movePrevious}
          title={t.movePrevious}
        >
          <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" />
        </Button>
        <span className="text-[10px] text-muted-foreground/60 tabular-nums">
          {stageObj ? `${stageObj.probability}%` : ""}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!hasNext || !nextStageId}
          onClick={(e) => {
            e.stopPropagation();
            if (nextStageId) onMove(deal.id, nextStageId);
          }}
          className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
          aria-label={t.moveNext}
          title={t.moveNext}
        >
          <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
        </Button>
      </div>
    </div>
  );
}

interface CrmViewProps {
  initialPipelines: PipelineRow[];
  initialDeals: DealRow[];
  initialLeads: MarketingLeadRow[];
  members: CrmMemberOption[];
  canManage: boolean;
  platform: Dictionary["platform"];
  locale: Locale;
  packageLabels: Record<string, string>;
  initialTab?: string;
  initialPipelineId?: string;
}

export function CrmView({
  initialPipelines,
  initialDeals,
  initialLeads,
  members,
  canManage,
  platform,
  locale,
  packageLabels,
  initialTab,
  initialPipelineId,
}: CrmViewProps) {
  const t = platform.crm;
  const pDict = t.pipelines;
  const common = platform.common;
  const router = useRouter();
  const searchParams = useSearchParams();

  const [pipelines, setPipelines] = useState<PipelineRow[]>(initialPipelines);
  const fallbackPipelineId = initialPipelineId || initialPipelines[0]?.id || "";
  const [activePipelineId, setActivePipelineId] = useState<string>(
    searchParams.get("pipelineId") || fallbackPipelineId
  );

  const [deals, setDeals] = useState<DealRow[]>(initialDeals);
  const [leads, setLeads] = useState<MarketingLeadRow[]>(initialLeads);
  const [tab, setTab] = useState<string>(
    searchParams.get("tab") === "leads" && canManage ? "leads" : "pipeline"
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [convertingLead, setConvertingLead] = useState<MarketingLeadRow | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<DealRow | null>(null);
  const [editingDeal, setEditingDeal] = useState<DealRow | null>(null);

  const [winLossModalOpen, setWinLossModalOpen] = useState(false);
  const [winLossDeal, setWinLossDeal] = useState<DealRow | null>(null);
  const [winLossStatus, setWinLossStatus] = useState<"won" | "lost">("won");
  const [winLossTargetStageId, setWinLossTargetStageId] = useState<string | undefined>(undefined);

  const [draggingDealId, setDraggingDealId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);

  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const activePipeline =
    pipelines.find((p) => p.id === activePipelineId) || pipelines[0];
  const activeStages = activePipeline?.stages || [];

  const handlePipelineChange = (newPipelineId: string) => {
    setActivePipelineId(newPipelineId);
    const params = new URLSearchParams(searchParams.toString());
    params.set("pipelineId", newPipelineId);
    router.replace(`/crm?${params.toString()}`, { scroll: false });
  };

  const handleTabChange = (nextTab: string) => {
    setTab(nextTab);
    const params = new URLSearchParams(searchParams.toString());
    if (nextTab === "pipeline") {
      params.delete("tab");
    } else {
      params.set("tab", nextTab);
    }
    router.replace(`/crm?${params.toString()}`, { scroll: false });
  };

  async function refreshData() {
    startTransition(async () => {
      const [newPipelines, newDeals, newLeads] = await Promise.all([
        getPipelines(),
        getDeals(),
        canManage ? getMarketingLeads() : Promise.resolve([]),
      ]);
      if (newPipelines && newPipelines.length > 0) setPipelines(newPipelines);
      if (newDeals) {
        setDeals(newDeals);
        if (selectedDeal) {
          const matched = newDeals.find((d) => d.id === selectedDeal.id);
          if (matched) setSelectedDeal(matched);
        }
      }
      if (newLeads) setLeads(newLeads);
    });
  }

  function handleStageMove(dealId: string, stageId: string) {
    const deal = deals.find((d) => d.id === dealId);
    if (!deal) return;

    const targetStage = activeStages.find((s) => s.id === stageId);
    if (targetStage && (targetStage.probability === 100 || targetStage.name.toLowerCase() === "won" || targetStage.stageType === "won")) {
      setWinLossDeal(deal);
      setWinLossStatus("won");
      setWinLossTargetStageId(stageId);
      setWinLossModalOpen(true);
      return;
    }
    if (targetStage && (targetStage.probability === 0 || targetStage.name.toLowerCase() === "lost" || targetStage.stageType === "lost")) {
      setWinLossDeal(deal);
      setWinLossStatus("lost");
      setWinLossTargetStageId(stageId);
      setWinLossModalOpen(true);
      return;
    }

    // Optimistically update local board state
    setDeals((prev) =>
      prev.map((d) => {
        if (d.id !== dealId) return d;
        return {
          ...d,
          stageId,
          stage: targetStage ? targetStage.name : d.stage,
          stageObj: targetStage || d.stageObj,
          updatedAt: new Date().toISOString(),
        };
      })
    );

    startTransition(async () => {
      setActionError(null);
      const res = await updateDealStage(dealId, stageId);
      if (res.status === "error") {
        setActionError(res.error || t.errors.updateFailed);
        refreshData();
        return;
      }
    });
  }

  function handlePromptWinLoss(deal: DealRow, status: "won" | "lost", stageId?: string) {
    setWinLossDeal(deal);
    setWinLossStatus(status);
    setWinLossTargetStageId(stageId);
    setWinLossModalOpen(true);
  }

  const pipelineDeals = deals.filter(
    (d) => !d.pipelineId || (activePipeline && d.pipelineId === activePipeline.id)
  );

  const totalPipelineValue = pipelineDeals
    .filter((d) => d.stage.toLowerCase() !== "lost" && !d.lostReason)
    .reduce((sum, d) => sum + (Number(d.value) || 0), 0);

  const weightedValue = pipelineDeals.reduce((sum, d) => {
    const stage = activeStages.find((s) => s.id === d.stageId) || d.stageObj;
    const prob = stage
      ? stage.probability
      : d.stage.toLowerCase() === "won"
        ? 100
        : d.stage.toLowerCase() === "lost"
          ? 0
          : 50;
    return sum + (Number(d.value) || 0) * (prob / 100);
  }, 0);

  const activeDealsCount = pipelineDeals.filter((d) => {
    const stage = activeStages.find((s) => s.id === d.stageId) || d.stageObj;
    const isClosed =
      d.closedAt !== null ||
      d.wonReason !== null ||
      d.lostReason !== null ||
      d.stage.toLowerCase() === "won" ||
      d.stage.toLowerCase() === "lost" ||
      (stage && (stage.probability === 100 || stage.probability === 0));
    return !isClosed;
  }).length;

  const wonDeals = pipelineDeals.filter(
    (d) => d.wonReason !== null || d.stage.toLowerCase() === "won"
  );
  const wonTotalValue = wonDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
  const activeCurrency = pipelineDeals[0]?.currency || "USD";

  const getDealsForStage = (stage: PipelineStageRow) => {
    return pipelineDeals.filter((d) => {
      if (d.stageId) return d.stageId === stage.id;
      return d.stage.toLowerCase() === stage.name.toLowerCase();
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header with Pipeline Switcher & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Layers className="size-6 text-primary shrink-0" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
              <p className="text-xs text-muted-foreground">{t.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 ms-0 sm:ms-4">
            <Select value={activePipeline?.id || ""} onValueChange={handlePipelineChange}>
              <SelectTrigger className="h-9 w-[190px] text-xs font-semibold bg-card">
                <SelectValue placeholder={pDict.switchPipeline} />
              </SelectTrigger>
              <SelectContent>
                {pipelines.map((pipe) => (
                  <SelectItem key={pipe.id} value={pipe.id} className="text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className="size-2 rounded-full shrink-0"
                        style={{ backgroundColor: pipe.color || "#6366f1" }}
                      />
                      <span className="font-medium">{pipe.name}</span>
                      {pipe.isDefault && (
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5">
                          {pDict.isDefault}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {canManage && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 text-xs gap-1.5"
                onClick={() => setManagerOpen(true)}
              >
                <Layers className="size-3.5" />
                <span>{pDict.managePipelines}</span>
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canManage && (
            <Button size="sm" className="h-9 text-xs gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              <span>{t.newDeal}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Metrics Bar */}
      {tab === "pipeline" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">{pDict.totalValue}</span>
              <DollarSign className="size-4" />
            </div>
            <p className="mt-2 text-xl font-bold tracking-tight text-foreground tabular-nums">
              {formatCurrency(totalPipelineValue, activeCurrency, locale)}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">{pDict.weightedValue}</span>
              <Percent className="size-4" />
            </div>
            <p className="mt-2 text-xl font-bold tracking-tight text-foreground tabular-nums">
              {formatCurrency(weightedValue, activeCurrency, locale)}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">{pDict.activeDeals}</span>
              <TrendingUp className="size-4" />
            </div>
            <p className="mt-2 text-xl font-bold tracking-tight text-foreground tabular-nums">
              {activeDealsCount}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold">{pDict.closedWon}</span>
              <Trophy className="size-4 text-emerald-500" />
            </div>
            <p className="mt-2 text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">
              {wonDeals.length} <span className="text-xs font-normal text-muted-foreground">({formatCurrency(wonTotalValue, activeCurrency, locale)})</span>
            </p>
          </div>
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive flex items-center gap-2"
        >
          <AlertTriangle className="size-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
        <TabsList>
          <TabsTrigger value="pipeline">{t.tabs.pipeline}</TabsTrigger>
          {canManage && <TabsTrigger value="leads">{t.tabs.inboundLeads}</TabsTrigger>}
        </TabsList>

        {/* ── Dynamic Pipeline Kanban Board ──────────────────── */}
        <TabsContent value="pipeline" className="mt-4">
          {activeStages.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-10 text-center">
              <p className="text-sm font-medium">{pDict.mustHaveOneStage}</p>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4 pt-1">
              {activeStages.map((stage, sIdx) => {
                const stageDeals = getDealsForStage(stage);
                const stageTotalVal = stageDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
                const hasPrev = sIdx > 0;
                const hasNext = sIdx < activeStages.length - 1;
                const prevStageId = hasPrev ? activeStages[sIdx - 1].id : undefined;
                const nextStageId = hasNext ? activeStages[sIdx + 1].id : undefined;

                return (
                  <div key={stage.id} className="w-72 shrink-0 flex flex-col">
                    {/* Column Header with Custom Stage Accent */}
                    <div
                      className="mb-2 flex items-center justify-between px-2.5 py-2 rounded-lg border bg-card/70 shadow-2xs"
                      style={{
                        borderTopColor: stage.color || undefined,
                        borderTopWidth: "3px",
                      }}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="size-2 rounded-full shrink-0 shadow-2xs"
                          style={{ backgroundColor: stage.color || undefined }}
                        />
                        <p className="text-xs sm:text-sm font-bold truncate">
                          {getStageName(stage.name, t.stages as Record<string, string>)}
                        </p>
                        <span
                          className="text-[10px] px-1.5 py-0.2 rounded font-mono font-semibold border"
                          style={getStageBadgeStyle(stage.color)}
                        >
                          {stage.stageType === "won" ? "🏆" : stage.stageType === "lost" ? "❌" : `${stage.probability}%`}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                        <span className="font-semibold tabular-nums">
                          {stageDeals.length}
                        </span>
                        <span>•</span>
                        <span className="tabular-nums font-medium">
                          {formatCurrency(stageTotalVal, activeCurrency, locale)}
                        </span>
                      </div>
                    </div>

                    {/* Column Cards Container */}
                    <div
                      onDragOver={(e) => {
                        if (!canManage) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        if (dragOverStageId !== stage.id) {
                          setDragOverStageId(stage.id);
                        }
                      }}
                      onDragEnter={(e) => {
                        if (!canManage) return;
                        e.preventDefault();
                        setDragOverStageId(stage.id);
                      }}
                      onDragLeave={(e) => {
                        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                        if (dragOverStageId === stage.id) {
                          setDragOverStageId(null);
                        }
                      }}
                      onDrop={(e) => {
                        if (!canManage) return;
                        e.preventDefault();
                        setDragOverStageId(null);
                        setDraggingDealId(null);

                        let droppedDealId = draggingDealId;
                        if (!droppedDealId) {
                          try {
                            const payload = JSON.parse(
                              e.dataTransfer.getData("application/json") || "{}"
                            );
                            droppedDealId = payload.dealId;
                          } catch {
                            droppedDealId = e.dataTransfer.getData("text/plain");
                          }
                        }
                        if (!droppedDealId) return;

                        const currentDeal = deals.find((d) => d.id === droppedDealId);
                        if (!currentDeal) return;
                        const currentStageId =
                          currentDeal.stageId ||
                          activeStages.find(
                            (s) => s.name.toLowerCase() === currentDeal.stage.toLowerCase()
                          )?.id;
                        if (currentStageId === stage.id) return;

                        handleStageMove(droppedDealId, stage.id);
                      }}
                      className={cn(
                        "space-y-2 rounded-xl bg-muted/40 p-2 min-h-[140px] flex-1 transition-all border-2 border-transparent",
                        dragOverStageId === stage.id &&
                          "ring-2 ring-primary/70 bg-primary/10 border-dashed border-primary/50 shadow-inner"
                      )}
                    >
                      {stageDeals.length === 0 ? (
                        <p className="py-8 text-center text-xs text-muted-foreground/60 italic">
                          {t.noDealsInColumn}
                        </p>
                      ) : (
                        stageDeals.map((deal) => (
                          <DealCard
                            key={deal.id}
                            deal={deal}
                            stageObj={stage}
                            onMove={handleStageMove}
                            onSelect={setSelectedDeal}
                            platform={platform}
                            locale={locale}
                            hasPrev={hasPrev}
                            hasNext={hasNext}
                            prevStageId={prevStageId}
                            nextStageId={nextStageId}
                            canManage={canManage}
                            isDragging={draggingDealId === deal.id}
                            onDragStart={() => setDraggingDealId(deal.id)}
                            onDragEnd={() => {
                              setDraggingDealId(null);
                              setDragOverStageId(null);
                            }}
                          />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Inbound leads table ─────────────────────────────── */}
        {canManage && (
          <TabsContent value="leads" className="mt-4">
            {leads.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-10 text-center">
                <Contact className="mx-auto size-8 text-muted-foreground/60" />
                <p className="mt-3 text-sm font-medium">{t.noLeadsYet}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t.noLeadsYetHint}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.leadName}</TableHead>
                      <TableHead>{t.leadCompany}</TableHead>
                      <TableHead>{t.leadEmail}</TableHead>
                      <TableHead>{t.packageOfInterest}</TableHead>
                      <TableHead>{t.status}</TableHead>
                      <TableHead>{t.received}</TableHead>
                      <TableHead className="text-end">
                        {common.actions}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell className="font-medium">
                          {lead.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {lead.company || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {lead.email}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {lead.packageOfInterest
                            ? packageLabels[lead.packageOfInterest] ??
                              lead.packageOfInterest
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "px-1.5 py-0 text-[10px]",
                              LEAD_STATUS_BADGE_CLASSES[lead.status]
                            )}
                          >
                            {t.statuses[lead.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatLeadDate(lead.createdAt, locale)}
                        </TableCell>
                        <TableCell className="text-end">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setActionError(null);
                              setConvertingLead(lead);
                            }}
                          >
                            {t.convertToDeal}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        )}

      </Tabs>

      {/* Deal Detail Dialog */}
      <DealDetailDialog
        deal={selectedDeal}
        open={selectedDeal !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedDeal(null);
        }}
        canManage={canManage}
        members={members}
        pipelines={pipelines}
        platform={platform}
        locale={locale}
        onStageChange={async (dealId, stageId) => {
          handleStageMove(dealId, stageId);
        }}
        onWinLossPrompt={handlePromptWinLoss}
        onEdit={(deal) => {
          setEditingDeal(deal);
        }}
        onDeleted={refreshData}
      />

      {/* Deal Dialog */}
      <DealDialog
        open={createOpen || convertingLead !== null || editingDeal !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setConvertingLead(null);
            setEditingDeal(null);
          }
        }}
        lead={convertingLead}
        deal={editingDeal}
        members={members}
        pipelines={pipelines}
        activePipelineId={activePipeline?.id}
        onSaved={refreshData}
        platform={platform}
      />

      {/* Pipeline Manager Dialog */}
      <PipelineManagerDialog
        open={managerOpen}
        onOpenChange={setManagerOpen}
        pipelines={pipelines}
        activePipelineId={activePipeline?.id}
        onPipelineSelect={handlePipelineChange}
        onSaved={refreshData}
        platform={platform}
      />

      {/* Win/Loss Modal */}
      <WinLossDialog
        open={winLossModalOpen}
        onOpenChange={setWinLossModalOpen}
        deal={winLossDeal}
        status={winLossStatus}
        targetStageId={winLossTargetStageId}
        onSaved={refreshData}
        platform={platform}
      />
    </div>
  );
}