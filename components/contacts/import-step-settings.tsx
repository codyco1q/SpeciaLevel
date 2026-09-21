"use client";

import { X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

export type DuplicateStrategy = "update" | "skip" | "create";

interface ImportStepSettingsProps {
  strategy: DuplicateStrategy;
  onStrategyChange: (strategy: DuplicateStrategy) => void;
  batchTags: string[];
  tagInput: string;
  onTagInputChange: (val: string) => void;
  onAddBatchTag: () => void;
  onRemoveBatchTag: (tag: string) => void;
  t: NonNullable<Dictionary["platform"]["contacts"]>["import"];
}

export function ImportStepSettings({
  strategy,
  onStrategyChange,
  batchTags,
  tagInput,
  onTagInputChange,
  onAddBatchTag,
  onRemoveBatchTag,
  t,
}: ImportStepSettingsProps) {
  return (
    <div className="space-y-5">
      <div>
        <h4 className="text-sm font-semibold text-foreground">{t.settingsTitle}</h4>
        <p className="text-xs text-muted-foreground">{t.settingsSubtitle}</p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold">{t.strategyTitle}</Label>
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            { key: "update", title: t.strategyUpdate, desc: t.strategyUpdateDesc },
            { key: "skip", title: t.strategySkip, desc: t.strategySkipDesc },
            { key: "create", title: t.strategyCreate, desc: t.strategyCreateDesc },
          ].map((item) => {
            const selected = strategy === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onStrategyChange(item.key as DuplicateStrategy)}
                className={cn(
                  "p-3 text-start rounded-lg border transition-all text-xs flex flex-col justify-between",
                  selected
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border bg-card hover:border-muted-foreground/40"
                )}
              >
                <span className="font-semibold text-foreground block mb-1">
                  {item.title}
                </span>
                <span className="text-[11px] text-muted-foreground block">
                  {item.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold">{t.batchTagsTitle}</Label>
        <p className="text-xs text-muted-foreground">{t.batchTagsDesc}</p>
        <div className="flex gap-2">
          <Input
            value={tagInput}
            onChange={(e) => onTagInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAddBatchTag();
              }
            }}
            placeholder={t.batchTagsPlaceholder}
            className="h-8 text-xs"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAddBatchTag}
            className="h-8 text-xs"
          >
            <Plus className="size-3.5 me-1" />
            Add
          </Button>
        </div>

        {batchTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {batchTags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="text-xs py-0.5 px-2 flex items-center gap-1"
              >
                <span>{tag}</span>
                <button
                  type="button"
                  onClick={() => onRemoveBatchTag(tag)}
                  className="hover:text-destructive"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
