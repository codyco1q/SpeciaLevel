"use client";

import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "lucide-react";
import { SubmissionTrackingCard } from "./submission-tracking-card";
import { SubmissionContactDealCard } from "./submission-contact-deal-card";
import { SubmissionResponsesCard } from "./submission-responses-card";
import type { FormRow, FormSubmissionRow } from "@/lib/validations/forms";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

interface Props {
  submission: FormSubmissionRow | null;
  form?: FormRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platform?: Dictionary["platform"] | Dictionary["platform"]["forms"];
  locale: Locale;
}

export function SubmissionDetailDialog({
  submission,
  form,
  open,
  onOpenChange,
  locale,
}: Props) {
  const isArabic = locale === "ar";

  const { utms, formResponses } = useMemo(() => {
    if (!submission) return { utms: {} as Record<string, string>, formResponses: [] };

    const raw = submission.data || {};
    const tr =
      (raw._tracking as Record<string, unknown>) ||
      (raw.tracking as Record<string, unknown>) ||
      {};

    const utmKeys = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "referrer",
    ];
    const detected: Record<string, string> = {};
    for (const k of utmKeys) {
      const v = tr[k] ?? raw[k];
      if (v !== undefined && v !== null && String(v).trim()) {
        detected[k] = String(v);
      }
    }

    const responses: { label: string; value: unknown }[] = [];
    if (form?.fields) {
      for (const f of form.fields) {
        responses.push({
          label: f.label,
          value: raw[f.id] ?? raw[f.label] ?? "—",
        });
      }
    } else {
      for (const [k, v] of Object.entries(raw)) {
        if (!k.startsWith("_") && k !== "tracking") {
          responses.push({ label: k, value: v });
        }
      }
    }

    return { utms: detected, formResponses: responses };
  }, [submission, form]);

  if (!submission) return null;

  const dateStr = new Date(submission.createdAt).toLocaleString(
    isArabic ? "ar-SA" : "en-US",
    { dateStyle: "medium", timeStyle: "short" }
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border/80 bg-muted/20">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
              {submission.form?.title || form?.title || "Lead Submission"}
            </Badge>
            <span className="text-[11px] font-mono text-muted-foreground">
              #{submission.id.slice(0, 8)}
            </span>
          </div>
          <DialogTitle className="text-lg font-bold">
            {isArabic ? "تفاصيل الرد والبيانات المقدمة" : "Submission Payload & Details"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
            <Calendar className="size-3" />
            <span>{dateStr}</span>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 p-6">
          <div className="space-y-5">
            <SubmissionTrackingCard utms={utms} isArabic={isArabic} />
            <SubmissionContactDealCard submission={submission} isArabic={isArabic} />
            <SubmissionResponsesCard
              formResponses={formResponses}
              rawPayload={submission.data || {}}
              isArabic={isArabic}
            />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
