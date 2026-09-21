"use client";

import { useState, useTransition } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  parseCsvContent,
  autoDetectFieldMapping,
  type ParsedCsv,
  type ContactFieldKey,
} from "./csv-parser";
import { ImportStepUpload } from "./import-step-upload";
import { ImportStepMapping } from "./import-step-mapping";
import { ImportStepSettings, type DuplicateStrategy } from "./import-step-settings";
import { ImportStepPreview } from "./import-step-preview";
import {
  importContactsAction,
  type ContactImportRecord,
  type ContactImportResult,
} from "@/lib/actions/contacts";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { cn } from "@/lib/utils";

interface ImportContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportCompleted: () => void;
  platform: Dictionary["platform"];
}

type Step = 1 | 2 | 3 | 4;

export function ImportContactsDialog({
  open,
  onOpenChange,
  onImportCompleted,
  platform,
}: ImportContactsDialogProps) {
  const t = platform.contacts?.import!;
  const common = platform.common;

  const [step, setStep] = useState<Step>(1);
  const [parsedCsv, setParsedCsv] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<Record<string, ContactFieldKey>>({});
  const [strategy, setStrategy] = useState<DuplicateStrategy>("update");
  const [batchTags, setBatchTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const [importResult, setImportResult] = useState<ContactImportResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const resetState = () => {
    setStep(1);
    setParsedCsv(null);
    setMapping({});
    setStrategy("update");
    setBatchTags([]);
    setTagInput("");
    setImportResult(null);
    setUploadError(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetState();
    onOpenChange(next);
  };

  const handleFileProcess = (file: File) => {
    setUploadError(null);
    if (!file.name.endsWith(".csv") && !file.name.endsWith(".txt")) {
      setUploadError("Please upload a .csv or .txt file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File size exceeds the 5MB limit.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = (e.target?.result as string) || "";
      const parsed = parseCsvContent(content);
      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        setUploadError("The file contains no readable headers or data rows.");
        return;
      }
      setParsedCsv(parsed);
      setMapping(autoDetectFieldMapping(parsed.headers));
      setStep(2);
    };
    reader.onerror = () => setUploadError("Failed to read file.");
    reader.readAsText(file, "UTF-8");
  };

  const handleAddBatchTag = () => {
    const trimmed = tagInput.trim().replace(/^,+|,+$/g, "");
    if (!trimmed) return;
    const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
    setBatchTags((prev) => Array.from(new Set([...prev, ...parts])));
    setTagInput("");
  };

  const buildRecords = (): ContactImportRecord[] => {
    if (!parsedCsv) return [];
    return parsedCsv.rows.map((row) => {
      const record: Partial<ContactImportRecord> = { tags: [] };
      parsedCsv.headers.forEach((header, idx) => {
        const field = mapping[header];
        const val = row[idx] || "";
        if (!field || field === "__ignore__" || !val) return;

        if (field === "tags") {
          const rowTags = val.split(",").map((s) => s.trim()).filter(Boolean);
          record.tags = Array.from(new Set([...(record.tags || []), ...rowTags]));
        } else {
          record[field] = val;
        }
      });

      return {
        name: record.name || "",
        email: record.email || "",
        company: record.company || undefined,
        phone: record.phone || undefined,
        title: record.title || undefined,
        address: record.address || undefined,
        notes: record.notes || undefined,
        tags: record.tags || [],
      };
    });
  };

  const hasEmailMapped = Object.values(mapping).includes("email");
  const records = buildRecords();
  const previewSample = records.slice(0, 5);

  const handleExecuteImport = () => {
    startTransition(async () => {
      const res = await importContactsAction({
        contacts: records,
        duplicateStrategy: strategy,
        batchTags,
      });
      setImportResult(res);
      if (res.status === "success") {
        onImportCompleted();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border">
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
          <div className="grid grid-cols-4 gap-2 pt-3">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={cn(
                  "h-1.5 rounded-full transition-colors",
                  step >= s ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 && (
            <ImportStepUpload
              onFileProcessed={handleFileProcess}
              uploadError={uploadError}
              t={t}
              downloadTemplateLabel={platform.contacts?.downloadTemplate ?? "Download Template"}
            />
          )}

          {step === 2 && parsedCsv && (
            <ImportStepMapping
              parsedCsv={parsedCsv}
              mapping={mapping}
              onMappingChange={(h, f) => setMapping((prev) => ({ ...prev, [h]: f }))}
              hasEmailMapped={hasEmailMapped}
              t={t}
            />
          )}

          {step === 3 && (
            <ImportStepSettings
              strategy={strategy}
              onStrategyChange={setStrategy}
              batchTags={batchTags}
              tagInput={tagInput}
              onTagInputChange={setTagInput}
              onAddBatchTag={handleAddBatchTag}
              onRemoveBatchTag={(tag) => setBatchTags((prev) => prev.filter((t) => t !== tag))}
              t={t}
            />
          )}

          {step === 4 && (
            <ImportStepPreview
              records={records}
              previewSample={previewSample}
              batchTags={batchTags}
              isPending={isPending}
              importResult={importResult}
              t={t}
            />
          )}
        </div>

        <DialogFooter className="p-4 border-t border-border bg-muted/10 flex items-center justify-between sm:justify-between">
          {importResult ? (
            <Button
              type="button"
              className="ms-auto"
              onClick={() => {
                onOpenChange(false);
                resetState();
              }}
            >
              {t.finish}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (step > 1) setStep((s) => (s - 1) as Step);
                  else onOpenChange(false);
                }}
                disabled={isPending}
              >
                {step === 1 ? common.cancel : t.back}
              </Button>

              <div className="flex items-center gap-2">
                {step < 4 ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setStep((s) => (s + 1) as Step)}
                    disabled={
                      (step === 1 && !parsedCsv) ||
                      (step === 2 && !hasEmailMapped) ||
                      isPending
                    }
                  >
                    {t.next}
                    <ArrowRight className="size-3.5 ms-1.5" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleExecuteImport}
                    disabled={isPending || records.length === 0}
                  >
                    {isPending && (
                      <LoaderCircle className="size-3.5 animate-spin me-2" />
                    )}
                    {t.startImport}
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

