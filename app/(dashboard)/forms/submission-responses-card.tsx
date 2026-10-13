"use client";

import { Badge } from "@/components/ui/badge";
import { FileText, Code } from "lucide-react";

interface Props {
  formResponses: { label: string; value: unknown }[];
  rawPayload: Record<string, unknown>;
  isArabic: boolean;
}

export function SubmissionResponsesCard({
  formResponses,
  rawPayload,
  isArabic,
}: Props) {
  return (
    <>
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <FileText className="size-4 text-primary" />
          <span>{isArabic ? "إجابات الأسئلة والحقول" : "Field & Question Responses"}</span>
        </div>
        <div className="divide-y divide-border/60">
          {formResponses.map((item, idx) => (
            <div
              key={idx}
              className="py-2.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1"
            >
              <span className="text-xs font-medium text-muted-foreground sm:w-1/3 shrink-0">
                {item.label}
              </span>
              <span className="text-xs font-semibold text-foreground sm:w-2/3 break-words">
                {Array.isArray(item.value) ? (
                  <span className="flex flex-wrap gap-1">
                    {item.value.map((v, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">
                        {String(v)}
                      </Badge>
                    ))}
                  </span>
                ) : typeof item.value === "object" && item.value !== null ? (
                  <code className="text-[11px] font-mono bg-muted p-1 rounded">
                    {JSON.stringify(item.value)}
                  </code>
                ) : (
                  String(item.value || "—")
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      <details className="rounded-xl border border-border/80 bg-muted/20 p-3 text-xs group cursor-pointer">
        <summary className="font-semibold text-muted-foreground flex items-center justify-between select-none">
          <span className="flex items-center gap-1.5">
            <Code className="size-3.5" />
            {isArabic ? "عرض حمولة JSON الكاملة" : "Raw JSON Payload"}
          </span>
          <span className="text-[10px] text-muted-foreground group-open:rotate-180 transition-transform">
            ▼
          </span>
        </summary>
        <pre className="mt-3 p-3 rounded-lg bg-background border border-border font-mono text-[11px] overflow-x-auto text-foreground/80 max-h-48">
          {JSON.stringify(rawPayload, null, 2)}
        </pre>
      </details>
    </>
  );
}
