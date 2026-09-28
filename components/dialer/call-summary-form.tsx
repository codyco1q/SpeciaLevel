"use client";

import React, { useState } from "react";
import { Clock, FileText, Check, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCallDuration } from "@/app/(dashboard)/telecom/telecom-meta";
import { completeCall } from "@/lib/actions/dialer";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

interface CallSummaryFormProps {
  callId: string | null;
  duration: number;
  contactId: string | null;
  notes: string;
  outcome: string;
  onSetNotes: (notes: string) => void;
  onSetOutcome: (outcome: string) => void;
  onReset: () => void;
  platform: Dictionary["platform"];
}

export function CallSummaryForm({
  callId,
  duration,
  contactId,
  notes,
  outcome,
  onSetNotes,
  onSetOutcome,
  onReset,
  platform,
}: CallSummaryFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const t = platform.dialer;

  const handleSaveSummary = async () => {
    if (!callId) {
      onReset();
      return;
    }
    setIsSaving(true);
    try {
      await completeCall({
        callId,
        durationSeconds: duration,
        notes,
        outcome,
        contactId,
      });
      setIsSaved(true);
      setTimeout(() => onReset(), 900);
    } catch {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/40 p-2.5">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">{t.callDuration}</span>
        </div>
        <span className="font-mono text-sm font-bold text-foreground">
          {formatCallDuration(duration)}
        </span>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <CheckCircle2 className="size-3.5 text-primary" />
          {t.outcome}
        </label>
        <Select value={outcome} onValueChange={onSetOutcome}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="completed" className="text-xs">{t.outcomes.completed}</SelectItem>
            <SelectItem value="interested" className="text-xs">{t.outcomes.interested}</SelectItem>
            <SelectItem value="follow-up" className="text-xs">{t.outcomes.followUp}</SelectItem>
            <SelectItem value="no-answer" className="text-xs">{t.outcomes.noAnswer}</SelectItem>
            <SelectItem value="left-voicemail" className="text-xs">{t.outcomes.leftVoicemail}</SelectItem>
            <SelectItem value="busy" className="text-xs">{t.outcomes.busy}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <FileText className="size-3.5 text-primary" />
          {t.postCallSummary}
        </label>
        <Textarea
          value={notes}
          onChange={(e) => onSetNotes(e.target.value)}
          placeholder={t.notesPlaceholder}
          rows={3}
          className="text-xs resize-none"
        />
      </div>

      <div className="mt-1 flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onReset}
          className="flex-1 text-xs"
        >
          {platform.common.cancel}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={isSaving || isSaved}
          onClick={handleSaveSummary}
          className="flex-1 text-xs gap-1.5"
        >
          {isSaved ? (
            <>
              <Check className="size-3.5 text-emerald-500" />
              {t.savedSuccess}
            </>
          ) : isSaving ? (
            t.saving
          ) : (
            t.saveSummary
          )}
        </Button>
      </div>
    </div>
  );
}
