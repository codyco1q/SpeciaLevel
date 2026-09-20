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
  Trash2,
  User,
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
import {
  deleteDeal,
  type DealRow,
} from "@/lib/actions/crm";
import type { CrmStage } from "@/types/database";
import {
  CRM_STAGES,
  CRM_STAGE_DOT_CLASSES,
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
  platform: Dictionary["platform"];
  locale: Locale;
  onEdit: (deal: DealRow) => void;
  onDeleted: () => void;
  onStageChange: (dealId: string, stage: CrmStage) => Promise<void>;
}

export function DealDetailDialog({
  deal,
  open,
  onOpenChange,
  canManage,
  platform,
  locale,
  onEdit,
  onDeleted,
  onStageChange,
}: DealDetailDialogProps) {
  const t = platform.crm;
  const common = platform.common;
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isUpdatingStage, setIsUpdatingStage] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!deal) return null;

  async function handleQuickStageChange(newStage: CrmStage) {
    if (!deal) return;
    setIsUpdatingStage(true);
    setErrorMessage(null);
    try {
      await onStageChange(deal.id, newStage);
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
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "size-2.5 shrink-0 rounded-full",
                  CRM_STAGE_DOT_CLASSES[deal.stage]
                )}
                aria-hidden="true"
              />
              <Badge variant="outline" className="text-xs capitalize">
                {t.stages[deal.stage]}
              </Badge>
            </div>
            <p className="text-lg font-bold tracking-tight tabular-nums">
              {formatCurrency(deal.value, deal.currency, locale)}
            </p>
          </div>
          <DialogTitle className="text-xl font-bold">{deal.title}</DialogTitle>
          <DialogDescription className="sr-only">
            {deal.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Quick stage selector */}
          <div className="rounded-lg border border-border bg-muted/30 p-3.5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <label
                htmlFor="deal-quick-stage"
                className="text-xs font-medium text-muted-foreground"
              >
                {t.dealDetail.stage}
              </label>
              <div className="flex items-center gap-2">
                <Select
                  value={deal.stage}
                  onValueChange={(val) =>
                    handleQuickStageChange(val as CrmStage)
                  }
                  disabled={isUpdatingStage}
                >
                  <SelectTrigger
                    id="deal-quick-stage"
                    className="h-8 w-44 text-xs font-medium"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CRM_STAGES.map((stage) => (
                      <SelectItem key={stage} value={stage} className="text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "size-2 rounded-full",
                              CRM_STAGE_DOT_CLASSES[stage]
                            )}
                          />
                          <span>{t.stages[stage]}</span>
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
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1 px-2 text-primary"
                >
                  <Link href={`/crm/contacts/${deal.contact.id}`}>
                    <span>{t.dealDetail.viewContact}</span>
                    <ExternalLink className="size-3 rtl:rotate-180" />
                  </Link>
                </Button>
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