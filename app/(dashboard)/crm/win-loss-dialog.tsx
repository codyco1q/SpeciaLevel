"use client";

import { useState, useEffect, useTransition } from "react";
import { Check, LoaderCircle, Trophy, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateDealStatus, type DealRow } from "@/lib/actions/crm";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { cn } from "@/lib/utils";

interface WinLossDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: DealRow | null;
  status: "won" | "lost";
  targetStageId?: string;
  onSaved: () => void;
  platform: Dictionary["platform"];
}

export function WinLossDialog({
  open,
  onOpenChange,
  deal,
  status,
  targetStageId,
  onSaved,
  platform,
}: WinLossDialogProps) {
  const t = platform.crm;
  const wl = t.winLoss;
  const common = platform.common;

  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isWon = status === "won";
  const quickTags = (isWon ? wl.quickTagsWon : wl.quickTagsLost) || {};

  useEffect(() => {
    if (!open || !deal) return;
    setReason(isWon ? (deal.wonReason ?? "") : (deal.lostReason ?? ""));
    setNotes("");
    setSelectedTag(null);
    setErrorMessage(null);
  }, [open, deal, isWon]);

  function handleSelectTag(tagText: string) {
    if (selectedTag === tagText) {
      setSelectedTag(null);
      setReason("");
    } else {
      setSelectedTag(tagText);
      setReason(tagText);
    }
  }

  function handleConfirm() {
    if (!deal) return;
    setErrorMessage(null);

    startTransition(async () => {
      try {
        const fullReason = [reason.trim(), notes.trim()]
          .filter(Boolean)
          .join(" — ");

        const res = await updateDealStatus(
          deal.id,
          status,
          fullReason || undefined,
          targetStageId
        );

        if (res.status === "error") {
          setErrorMessage(res.error || "Failed to update deal");
          return;
        }

        onSaved();
        onOpenChange(false);
      } catch {
        setErrorMessage("An unexpected error occurred.");
      }
    });
  }

  if (!deal) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {isWon ? (
              <div className="size-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Trophy className="size-4" />
              </div>
            ) : (
              <div className="size-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-600 dark:text-red-400">
                <XCircle className="size-4" />
              </div>
            )}
            <DialogTitle className="text-lg font-bold">
              {isWon ? wl.wonTitle : wl.lostTitle}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            {isWon ? wl.wonDescription : wl.lostDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Quick Tags */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">
              {wl.reasonLabel}
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(quickTags).map(([key, label]) => {
                const isSelected = selectedTag === label;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSelectTag(label)}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer",
                      isSelected
                        ? isWon
                          ? "bg-emerald-500 text-white border-emerald-600 shadow-xs"
                          : "bg-red-500 text-white border-red-600 shadow-xs"
                        : "bg-card text-foreground/80 hover:bg-muted/80 border-border"
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Primary Reason Input */}
          <div className="grid gap-1.5">
            <Input
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setSelectedTag(null);
              }}
              placeholder={wl.reasonPlaceholder}
              className="text-xs"
            />
          </div>

          {/* Closing Notes */}
          <div className="grid gap-1.5">
            <Label htmlFor="closing-notes" className="text-xs font-semibold text-muted-foreground">
              {wl.notesLabel}
            </Label>
            <Textarea
              id="closing-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={wl.notesPlaceholder}
              rows={3}
              className="text-xs resize-none"
            />
          </div>

          {errorMessage && (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {errorMessage}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {common.cancel}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={isPending}
            className={cn(
              isWon
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "bg-red-600 hover:bg-red-700 text-white"
            )}
          >
            {isPending && <LoaderCircle className="size-3.5 animate-spin me-1.5" />}
            {wl.saveAndClose}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

