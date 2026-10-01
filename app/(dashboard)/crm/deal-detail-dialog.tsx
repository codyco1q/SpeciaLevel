"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Building2,
  Calendar,
  Clock,
  ExternalLink,
  LoaderCircle,
  Mail,
  Pencil,
  Phone,
  RotateCcw,
  Trash2,
  Trophy,
  User,
  XCircle,
  PhoneCall,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { openGlobalDialer } from "@/lib/stores/dialer-store";
import {
  deleteDeal,
  updateDealStatus,
  type DealRow,
  type PipelineRow,
} from "@/lib/actions/crm";
import {
  getStageDotClass,
  getStageName,
  getStageBadgeStyle,
  formatCurrency,
  formatLeadDate,
} from "./crm-meta";
import type { CrmMemberOption } from "./deal-dialog";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

interface DealDetailDialogProps {
  deal: DealRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManage: boolean;
  members: CrmMemberOption[];
  pipelines?: PipelineRow[];
  platform: Dictionary["platform"];
  locale: Locale;
  onEdit: (deal: DealRow) => void;
  onDeleted: () => void;
  onStageChange: (dealId: string, stageId: string) => Promise<void>;
  onWinLossPrompt?: (deal: DealRow, status: "won" | "lost", stageId?: string) => void;
}

export function DealDetailDialog({
  deal,
  open,
  onOpenChange,
  canManage,
  pipelines = [],
  platform,
  locale,
  onEdit,
  onDeleted,
  onStageChange,
  onWinLossPrompt,
}: DealDetailDialogProps) {
  const t = platform.crm;
  const wl = t.winLoss;
  const common = platform.common;
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isUpdatingStage, setIsUpdatingStage] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!deal) return null;

  const currentPipeline = pipelines.find((p) => p.id === deal.pipelineId) || pipelines[0];
  const availableStages = currentPipeline?.stages || [];
  const activeStage = availableStages.find((s) => s.id === deal.stageId) || deal.stageObj;

  const daysSinceUpdate = Math.floor(
    (Date.now() - new Date(deal.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  const isStale =
    activeStage &&
    activeStage.probability > 0 &&
    activeStage.probability < 100 &&
    daysSinceUpdate >= activeStage.staleDays;

  const isWon = deal.wonReason !== null || deal.stage.toLowerCase() === "won";
  const isLost = deal.lostReason !== null || deal.stage.toLowerCase() === "lost";
  const isClosed = Boolean(deal.closedAt) || isWon || isLost;

  async function handleQuickStageChange(newStageId: string) {
    if (!deal) return;
    const targetStage = availableStages.find((s) => s.id === newStageId);
    if (targetStage && (targetStage.probability === 100 || targetStage.name.toLowerCase() === "won")) {
      onOpenChange(false);
      onWinLossPrompt?.(deal, "won", newStageId);
      return;
    }
    if (targetStage && (targetStage.probability === 0 || targetStage.name.toLowerCase() === "lost")) {
      onOpenChange(false);
      onWinLossPrompt?.(deal, "lost", newStageId);
      return;
    }

    setIsUpdatingStage(true);
    setErrorMessage(null);
    try {
      await onStageChange(deal.id, newStageId);
    } catch {
      setErrorMessage(t.errors.updateFailed);
    } finally {
      setIsUpdatingStage(false);
    }
  }

  async function handleReopen() {
    if (!deal) return;
    setIsUpdatingStage(true);
    setErrorMessage(null);
    try {
      const res = await updateDealStatus(deal.id, "open");
      if (res.status === "error") {
        setErrorMessage(res.error || "Failed to reopen deal");
        return;
      }
      await onStageChange(deal.id, availableStages[0]?.id || deal.stage);
    } catch {
      setErrorMessage(t.errors.updateFailed);
    } finally {
      setIsUpdatingStage(false);
    }
  }

  async function handleDelete() {
    if (!deal) return;
    setIsDeleting(true);
    setErrorMessage(null);
    try {
      const result = await deleteDeal(deal.id);
      if (result.status === "error") {
        setErrorMessage(result.error ?? t.errors.updateFailed);
        setIsDeleting(false);
        return;
      }
      onDeleted();
      onOpenChange(false);
    } catch {
      setErrorMessage(t.errors.updateFailed);
      setIsDeleting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setConfirmDelete(false);
          setErrorMessage(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] sm:max-w-xl overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2 pe-6">
            <div className="flex flex-wrap items-center gap-2">
              {activeStage ? (
                <span
                  className="text-xs px-2.5 py-0.5 rounded-md font-semibold border flex items-center gap-1.5 shadow-2xs"
                  style={getStageBadgeStyle(activeStage.color)}
                >
                  <span
                    className="size-2 rounded-full shrink-0"
                    style={{ backgroundColor: activeStage.color || "#3b82f6" }}
                  />
                  <span>{getStageName(activeStage.name, t.stages as Record<string, string>)}</span>
                  <span className="font-mono text-[11px] opacity-80">
                    {activeStage.stageType === "won" ? "🏆" : activeStage.stageType === "lost" ? "❌" : `${activeStage.probability}%`}
                  </span>
                </span>
              ) : (
                <Badge variant="outline" className="text-xs font-semibold">
                  {getStageName(deal.stage, t.stages as Record<string, string>)}
                </Badge>
              )}
              {isStale && (
                <Badge variant="outline" className="border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400 gap-1 text-[10px] px-1.5 py-0">
                  <Clock className="size-3" />
                  {t.pipelines.staleDaysAgo.replace("{days}", String(daysSinceUpdate))}
                </Badge>
              )}
            </div>
            <p className="text-lg font-bold tracking-tight tabular-nums">
              {formatCurrency(deal.value, deal.currency, locale)}
            </p>
          </div>
          <DialogTitle className="text-xl font-bold mt-1">{deal.title}</DialogTitle>
          <DialogDescription className="sr-only">
            {deal.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Closed outcome alert card */}
          {isClosed && (
            <div
              className={cn(
                "rounded-lg border p-3.5 space-y-2",
                isWon
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
                  : "border-red-500/30 bg-red-500/10 text-red-900 dark:text-red-200"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-xs">
                  {isWon ? (
                    <Trophy className="size-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <XCircle className="size-4 text-red-600 dark:text-red-400" />
                  )}
                  <span>{isWon ? wl.wonTitle : wl.lostTitle}</span>
                </div>
                {deal.closedAt && (
                  <span className="text-[10px] text-muted-foreground">
                    {wl.closedAt} {formatLeadDate(deal.closedAt, locale)}
                  </span>
                )}
              </div>
              {(deal.wonReason || deal.lostReason) && (
                <p className="text-xs text-foreground/90 font-medium">
                  <span className="font-bold text-muted-foreground me-1.5">
                    {isWon ? wl.wonReason : wl.lostReason}:
                  </span>
                  {deal.wonReason || deal.lostReason}
                </p>
              )}
              {canManage && (
                <div className="pt-1 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] gap-1 px-2"
                    onClick={handleReopen}
                    disabled={isUpdatingStage}
                  >
                    <RotateCcw className="size-3" />
                    {wl.markOpen}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Quick stage selector & Won/Lost Buttons */}
          <div className="rounded-lg border border-border bg-muted/30 p-3.5 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <label
                htmlFor="deal-quick-stage"
                className="text-xs font-medium text-muted-foreground"
              >
                {t.dealDetail.stage}
              </label>
              <div className="flex items-center gap-2">
                <Select
                  value={deal.stageId || availableStages[0]?.id || ""}
                  onValueChange={handleQuickStageChange}
                  disabled={isUpdatingStage}
                >
                  <SelectTrigger
                    id="deal-quick-stage"
                    className="h-8 w-48 text-xs font-medium"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableStages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id} className="text-xs">
                        <div className="flex items-center justify-between w-full gap-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="size-2 rounded-full shrink-0"
                              style={{ backgroundColor: stage.color || "#3b82f6" }}
                            />
                            <span>{getStageName(stage.name, t.stages as Record<string, string>)}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {stage.stageType === "won" ? "🏆 100%" : stage.stageType === "lost" ? "❌ 0%" : `${stage.probability}%`}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isUpdatingStage && (
                  <LoaderCircle className="size-3.5 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>

            {/* Quick Won/Lost action buttons if open */}
            {!isClosed && canManage && (
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-500/10 border-red-200 dark:border-red-900/50"
                  onClick={() => {
                    onOpenChange(false);
                    onWinLossPrompt?.(deal, "lost");
                  }}
                  disabled={isUpdatingStage}
                >
                  <XCircle className="size-3.5 me-1" />
                  {wl.markLost}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 border-emerald-200 dark:border-emerald-900/50"
                  onClick={() => {
                    onOpenChange(false);
                    onWinLossPrompt?.(deal, "won");
                  }}
                  disabled={isUpdatingStage}
                >
                  <Trophy className="size-3.5 me-1" />
                  {wl.markWon}
                </Button>
              </div>
            )}
          </div>

          {/* Core metadata grid */}
          <div className="grid gap-3 sm:grid-cols-2 text-xs">
            {/* Assignee */}
            <div className="rounded-md border border-border/80 bg-card p-3">
              <span className="text-muted-foreground block mb-1">
                {t.dealDetail.assignee}
              </span>
              <div className="flex items-center gap-2 font-medium">
                <User className="size-4 text-muted-foreground shrink-0" />
                <span className="truncate">
                  {deal.assignee
                    ? deal.assignee.fullName ?? deal.assignee.email ?? t.member
                    : t.dealDetail.unassigned}
                </span>
              </div>
            </div>

            {/* Created / Updated */}
            <div className="rounded-md border border-border/80 bg-card p-3">
              <span className="text-muted-foreground block mb-1">
                {t.dealDetail.created}
              </span>
              <div className="flex items-center gap-2 font-medium">
                <Calendar className="size-4 text-muted-foreground shrink-0" />
                <span>{formatLeadDate(deal.createdAt, locale)}</span>
              </div>
            </div>
          </div>

          {/* Linked Contact Card */}
          <div className="rounded-lg border border-border p-4 bg-card">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Building2 className="size-3.5" />
                {t.dealDetail.contact}
              </h4>
              {deal.contact && (
                <div className="flex items-center gap-1">
                  {deal.contact.phone && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        openGlobalDialer({
                          destinationNumber: deal.contact?.phone || "",
                          contactName: deal.contact?.name,
                          contactId: deal.contact?.id,
                        })
                      }
                      className="h-7 text-xs gap-1 px-2 text-primary"
                      title={platform.dialer.call}
                    >
                      <PhoneCall className="size-3" />
                      <span>{platform.dialer.call}</span>
                    </Button>
                  )}
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1 px-2 text-primary"
                  >
                    <Link href={`/contacts/${deal.contact.id}`}>
                      <span>{t.dealDetail.viewContact}</span>
                      <ExternalLink className="size-3 rtl:rotate-180" />
                    </Link>
                  </Button>
                </div>
              )}
            </div>

            {deal.contact ? (
              <div className="space-y-1.5 pt-1">
                <p className="text-sm font-semibold">{deal.contact.name}</p>
                {deal.contact.company && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Building2 className="size-3 shrink-0" />
                    <span>{deal.contact.company}</span>
                  </p>
                )}
                {deal.contact.email && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Mail className="size-3 shrink-0" />
                    <span>{deal.contact.email}</span>
                  </p>
                )}
                {deal.contact.phone && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Phone className="size-3 shrink-0" />
                    <span dir="ltr">{deal.contact.phone}</span>
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-1">
                {t.dealDetail.noContact}
              </p>
            )}
          </div>

          {/* Description / Notes */}
          <div className="rounded-lg border border-border p-4 bg-card">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Clock className="size-3.5" />
              {t.dealDetail.notes}
            </h4>
            {deal.notes ? (
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">
                {deal.notes}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                {t.dealDetail.noNotes}
              </p>
            )}
          </div>

          {errorMessage && (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {errorMessage}
            </p>
          )}

          {/* Confirm delete panel */}
          {confirmDelete && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
              <h4 className="text-sm font-semibold text-destructive">
                {t.dealDetail.deleteConfirmTitle}
              </h4>
              <p className="text-xs text-muted-foreground">
                {t.dealDetail.deleteConfirmDescription.replace(
                  "{title}",
                  deal.title
                )}
              </p>
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmDelete(false)}
                  disabled={isDeleting}
                >
                  {common.cancel}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting && (
                    <LoaderCircle className="size-3.5 animate-spin me-1.5" />
                  )}
                  {t.dealDetail.deleteConfirm}
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-row items-center justify-between sm:justify-between gap-2 border-t pt-4">
          {canManage && !confirmDelete ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
              disabled={isDeleting}
            >
              <Trash2 className="size-3.5 me-1.5" />
              {t.dealDetail.deleteDeal}
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              {common.cancel}
            </Button>
            {canManage && !confirmDelete && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onEdit(deal);
                }}
              >
                <Pencil className="size-3.5 me-1.5" />
                {t.dealDetail.editDeal}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}