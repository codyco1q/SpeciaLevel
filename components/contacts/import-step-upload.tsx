"use client";

import { useId } from "react";
import { Upload, FileSpreadsheet, AlertCircle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateCsvTemplate } from "./csv-parser";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

interface ImportStepUploadProps {
  onFileProcessed: (file: File) => void;
  uploadError: string | null;
  t: NonNullable<Dictionary["platform"]["contacts"]>["import"];
  downloadTemplateLabel: string;
}

export function ImportStepUpload({
  onFileProcessed,
  uploadError,
  t,
  downloadTemplateLabel,
}: ImportStepUploadProps) {
  const fileInputId = useId();

  const handleDownloadTemplate = () => {
    const template = generateCsvTemplate();
    const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contacts_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) onFileProcessed(file);
        }}
        className="border-2 border-dashed border-border hover:border-primary/50 transition-colors rounded-xl p-8 flex flex-col items-center justify-center text-center gap-3 bg-muted/20"
      >
        <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <Upload className="size-6" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{t.uploadTitle}</p>
          <p className="text-xs text-muted-foreground mt-1">{t.uploadSubtitle}</p>
        </div>
        <input
          id={fileInputId}
          type="file"
          accept=".csv,text/csv,text/plain"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFileProcessed(file);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => document.getElementById(fileInputId)?.click()}
        >
          <FileSpreadsheet className="size-4 me-2" />
          {t.dragDropText}
        </Button>
      </div>

      {uploadError && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <span className="text-xs text-muted-foreground">{t.sampleHint}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleDownloadTemplate}
          className="text-xs gap-1.5"
        >
          <Download className="size-3.5" />
          {downloadTemplateLabel}
        </Button>
      </div>
    </div>
  );
}
