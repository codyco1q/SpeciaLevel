"use client";

import { CheckCircle2, AlertCircle, LoaderCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ContactImportRecord, ContactImportResult } from "@/lib/actions/contacts";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

interface ImportStepPreviewProps {
  records: ContactImportRecord[];
  previewSample: ContactImportRecord[];
  batchTags: string[];
  isPending: boolean;
  importResult: ContactImportResult | null;
  t: NonNullable<Dictionary["platform"]["contacts"]>["import"];
}

export function ImportStepPreview({
  records,
  previewSample,
  batchTags,
  isPending,
  importResult,
  t,
}: ImportStepPreviewProps) {
  if (isPending) {
    return (
      <div className="py-8 flex flex-col items-center justify-center gap-3">
        <LoaderCircle className="size-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-foreground">{t.importing}</p>
      </div>
    );
  }

  if (importResult) {
    return (
      <div className="space-y-4 py-2">
        <div
          className={cn(
            "p-4 rounded-xl border flex items-center gap-3",
            importResult.status === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
              : "bg-destructive/10 border-destructive/30 text-destructive"
          )}
        >
          {importResult.status === "success" ? (
            <CheckCircle2 className="size-6 shrink-0" />
          ) : (
            <AlertCircle className="size-6 shrink-0" />
          )}
          <div>
            <p className="text-sm font-semibold">
              {importResult.status === "success" ? t.importSuccess : t.importFailed}
            </p>
            {importResult.error && (
              <p className="text-xs opacity-90">{importResult.error}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          <div className="border border-border rounded-lg p-2.5 bg-card">
            <p className="text-xl font-bold text-foreground">{importResult.createdCount ?? 0}</p>
            <p className="text-[11px] text-muted-foreground">{t.resultsCreated}</p>
          </div>
          <div className="border border-border rounded-lg p-2.5 bg-card">
            <p className="text-xl font-bold text-foreground">{importResult.updatedCount ?? 0}</p>
            <p className="text-[11px] text-muted-foreground">{t.resultsUpdated}</p>
          </div>
          <div className="border border-border rounded-lg p-2.5 bg-card">
            <p className="text-xl font-bold text-foreground">{importResult.skippedCount ?? 0}</p>
            <p className="text-[11px] text-muted-foreground">{t.resultsSkipped}</p>
          </div>
          <div className="border border-border rounded-lg p-2.5 bg-card">
            <p className="text-xl font-bold text-destructive">{importResult.errorCount ?? importResult.errors?.length ?? 0}</p>
            <p className="text-[11px] text-muted-foreground">{t.resultsErrors}</p>
          </div>
        </div>

        {importResult.errors && importResult.errors.length > 0 && (
          <div className="border border-border rounded-lg p-3 space-y-2 bg-muted/20">
            <p className="text-xs font-semibold text-foreground">{t.errorLog}</p>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {importResult.errors.map((err, i: number) => {
                const text =
                  typeof err === "string"
                    ? err
                    : `${err.name || err.email || `Row ${(err.index ?? err.row_index ?? i) + 1}`}: ${err.error}`;
                return (
                  <p key={i} className="text-[11px] text-destructive font-mono">
                    {text}
                  </p>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-foreground">{t.previewTitle}</h4>
          <p className="text-xs text-muted-foreground">{t.previewSubtitle}</p>
        </div>
        <Badge variant="outline" className="text-xs font-mono">
          {records.length} {t.recordsToImport}
        </Badge>
      </div>

      <div className="border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-xs text-start">
          <thead className="bg-muted/50 border-b border-border text-muted-foreground">
            <tr>
              <th className="p-2 text-start font-medium">Name</th>
              <th className="p-2 text-start font-medium">Email</th>
              <th className="p-2 text-start font-medium">Company</th>
              <th className="p-2 text-start font-medium">Tags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {previewSample.map((rec, i) => (
              <tr key={i} className="hover:bg-muted/20">
                <td className="p-2 font-medium">{rec.name || "—"}</td>
                <td className="p-2 text-muted-foreground">{rec.email || "—"}</td>
                <td className="p-2 text-muted-foreground">{rec.company || "—"}</td>
                <td className="p-2">
                  {rec.tags && rec.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {rec.tags.map((tg: string) => (
                        <Badge key={tg} variant="outline" className="text-[10px] px-1 py-0">
                          {tg}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {batchTags.length > 0 && (
        <p className="text-xs text-muted-foreground">
          + Batch tags: <span className="font-semibold text-foreground">{batchTags.join(", ")}</span>
        </p>
      )}
    </div>
  );
}
