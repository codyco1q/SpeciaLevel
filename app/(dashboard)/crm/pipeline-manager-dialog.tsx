"use client";

import { useState, useEffect, useTransition } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  Layers,
  LoaderCircle,
  Plus,
  Trash2,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  createPipeline,
  updatePipeline,
  deletePipeline,
  type PipelineRow,
} from "@/lib/actions/crm";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { cn } from "@/lib/utils";

interface PipelineManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelines: PipelineRow[];
  activePipelineId?: string;
  onPipelineSelect?: (pipelineId: string) => void;
  onSaved: () => void;
  platform: Dictionary["platform"];
}

export function PipelineManagerDialog({
  open,
  onOpenChange,
  pipelines,
  activePipelineId,
  onPipelineSelect,
  onSaved,
  platform,
}: PipelineManagerDialogProps) {
  const t = platform.crm;
  const pDict = t.pipelines;
  const common = platform.common;

  const [selectedPipeId, setSelectedPipeId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [pipelineName, setPipelineName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [stages, setStages] = useState<EditableStage[]>([]);
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    setConfirmDeleteId(null);

    const initialId = activePipelineId || pipelines[0]?.id || null;
    if (initialId) {
      loadPipeline(initialId);
    } else {
      startNewPipeline();
    }
  }, [open, activePipelineId, pipelines]);

  function loadPipeline(id: string) {
    const pipe = pipelines.find((p) => p.id === id);
    if (!pipe) return;

    setSelectedPipeId(pipe.id);
    setIsCreatingNew(false);
    setPipelineName(pipe.name);
    setIsDefault(pipe.isDefault);
    setStages(
      pipe.stages.map((s, idx) => ({
        id: s.id,
        name: s.name,
        orderIndex: idx,
        probability: s.probability,
        staleDays: s.staleDays,
      }))
    );
    setErrorMessage(null);
    setSuccessMessage(null);
    setConfirmDeleteId(null);
  }

  function startNewPipeline() {
    setIsCreatingNew(true);
    setSelectedPipeId(null);
    setPipelineName("");
    setIsDefault(pipelines.length === 0);
    setStages([
      { name: "Lead", orderIndex: 0, probability: 10, staleDays: 14 },
      { name: "Qualified", orderIndex: 1, probability: 30, staleDays: 14 },
      { name: "Proposal", orderIndex: 2, probability: 60, staleDays: 14 },
      { name: "Negotiation", orderIndex: 3, probability: 80, staleDays: 14 },
      { name: "Won", orderIndex: 4, probability: 100, staleDays: 30 },
      { name: "Lost", orderIndex: 5, probability: 0, staleDays: 30 },
    ]);
    setErrorMessage(null);
    setSuccessMessage(null);
    setConfirmDeleteId(null);
  }

  function handleAddStage() {
    setStages((prev) => [
      ...prev,
      {
        name: "New Stage",
        orderIndex: prev.length,
        probability: 50,
        staleDays: 14,
      },
    ]);
  }

  function handleRemoveStage(index: number) {
    if (stages.length <= 1) return;
    setStages((prev) => prev.filter((_, idx) => idx !== index));
  }

  function handleMoveStage(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= stages.length) return;

    setStages((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next.map((s, idx) => ({ ...s, orderIndex: idx }));
    });
  }

  function handleStageChange<K extends keyof EditableStage>(
    index: number,
    key: K,
    val: EditableStage[K]
  ) {
    setStages((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: val };
      return next;
    });
  }

interface EditableStage {
  id?: string;
  name: string;
  orderIndex: number;
  probability: number;
  staleDays: number;
}

  function handleSave() {
    if (!pipelineName.trim()) {
      setErrorMessage(pDict.pipelineName);
      return;
    }
    if (stages.length === 0) {
      setErrorMessage(pDict.mustHaveOneStage);
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      try {
        const payload = {
          name: pipelineName.trim(),
          isDefault,
          orderIndex: isCreatingNew ? pipelines.length : (selectedPipe?.orderIndex ?? 0),
          stages: stages.map((s, idx) => ({
            id: s.id,
            name: s.name.trim(),
            orderIndex: idx,
            probability: Number(s.probability) || 0,
            staleDays: Number(s.staleDays) || 14,
          })),
        };

        if (isCreatingNew) {
          const res = await createPipeline(payload);
          if (res.status === "error") {
            setErrorMessage(res.error || "Failed to create pipeline");
            return;
          }
          setSuccessMessage(pDict.stageUpdated || "Pipeline saved");
          onSaved();
          if (res.data && typeof res.data === "object" && "id" in (res.data as Record<string, unknown>)) {
            const newId = String((res.data as Record<string, unknown>).id);
            onPipelineSelect?.(newId);
          }
        } else if (selectedPipeId) {
          const res = await updatePipeline(selectedPipeId, payload);
          if (res.status === "error") {
            setErrorMessage(res.error || "Failed to update pipeline");
            return;
          }
          setSuccessMessage(pDict.stageUpdated || "Pipeline saved");
          onSaved();
        }
      } catch {
        setErrorMessage("An unexpected error occurred.");
      }
    });
  }

  function handleDeletePipeline(pipeId: string) {
    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      try {
        const res = await deletePipeline(pipeId);
        if (res.status === "error") {
          setErrorMessage(res.error || "Failed to delete pipeline");
          setConfirmDeleteId(null);
          return;
        }
        setConfirmDeleteId(null);
        onSaved();
        const remaining = pipelines.filter((p) => p.id !== pipeId);
        if (remaining[0]) {
          loadPipeline(remaining[0].id);
          onPipelineSelect?.(remaining[0].id);
        } else {
          startNewPipeline();
        }
      } catch {
        setErrorMessage("An unexpected error occurred while deleting.");
        setConfirmDeleteId(null);
      }
    });
  }

  const selectedPipe = pipelines.find((p) => p.id === selectedPipeId);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[90vw] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Layers className="size-5 text-primary" />
            <DialogTitle className="text-xl font-bold">{pDict.managePipelines}</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            {pDict.manageHint}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-[440px]">
          {/* Left Sidebar: Pipelines list */}
          <div className="w-full md:w-1/3 md:min-w-[240px] md:max-w-[320px] border-b md:border-b-0 md:border-e border-border bg-muted/20 p-4 space-y-3 overflow-y-auto flex flex-col justify-between shrink-0">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {pDict.pipelines}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={startNewPipeline}
                  disabled={isPending}
                >
                  <Plus className="size-3.5" />
                  {pDict.createPipeline}
                </Button>
              </div>

              <div className="space-y-1.5 mt-2">
                {pipelines.map((pipe) => {
                  const isSelected = !isCreatingNew && selectedPipeId === pipe.id;
                  return (
                    <button
                      key={pipe.id}
                      type="button"
                      onClick={() => loadPipeline(pipe.id)}
                      className={cn(
                        "w-full text-start px-3 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-between border",
                        isSelected
                          ? "bg-primary/10 text-primary border-primary/30 shadow-xs"
                          : "bg-card hover:bg-muted/60 border-border text-foreground/80"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate">{pipe.name}</span>
                        {pipe.isDefault && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                            {pDict.isDefault}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground ms-2 shrink-0">
                        {pipe.stages.length} {pDict.stages}
                      </span>
                    </button>
                  );
                })}

                {isCreatingNew && (
                  <div className="px-3 py-2.5 rounded-lg text-sm font-semibold bg-primary/10 text-primary border border-primary/40 flex items-center gap-2">
                    <Plus className="size-4 shrink-0" />
                    <span className="truncate">{pipelineName || pDict.createPipeline}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Area: Active pipeline editor */}
          <div className="flex-1 p-6 overflow-y-auto space-y-6">
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="pipe-name" className="text-sm font-semibold">
                  {pDict.pipelineName}
                </Label>
                <Input
                  id="pipe-name"
                  value={pipelineName}
                  onChange={(e) => setPipelineName(e.target.value)}
                  placeholder={pDict.pipelineNamePlaceholder}
                  className="max-w-md text-sm"
                />
              </div>

              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <Checkbox
                  id="pipe-default"
                  checked={isDefault}
                  onCheckedChange={(checked) => setIsDefault(Boolean(checked))}
                  disabled={selectedPipe?.isDefault && pipelines.length === 1}
                />
                <Label htmlFor="pipe-default" className="text-xs font-medium cursor-pointer">
                  {pDict.setAsDefault}
                </Label>
              </div>
            </div>

            {/* Stages Section */}
            <div className="space-y-3 pt-3 border-t border-border">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">{pDict.stages}</h4>
                  <p className="text-xs text-muted-foreground">{pDict.staleDaysHint}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1"
                  onClick={handleAddStage}
                  disabled={isPending}
                >
                  <Plus className="size-3.5" />
                  {pDict.addStage}
                </Button>
              </div>

              <div className="space-y-2.5">
                {stages.map((stage, idx) => (
                  <div
                    key={stage.id || `temp-${idx}`}
                    className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 p-3 rounded-lg border border-border bg-card shadow-xs transition-all hover:border-foreground/20"
                  >
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleMoveStage(idx, "up")}
                        disabled={idx === 0 || isPending}
                        className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                        title="Move Up"
                      >
                        <ArrowUp className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveStage(idx, "down")}
                        disabled={idx === stages.length - 1 || isPending}
                        className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                        title="Move Down"
                      >
                        <ArrowDown className="size-3.5" />
                      </button>
                    </div>

                    <div className="flex-1 min-w-[160px]">
                      <Input
                        value={stage.name}
                        onChange={(e) => handleStageChange(idx, "name", e.target.value)}
                        placeholder={pDict.stageName}
                        className="h-8 text-xs font-medium"
                      />
                    </div>

                    <div className="w-24 shrink-0">
                      <div className="relative">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={stage.probability}
                          onChange={(e) =>
                            handleStageChange(
                              idx,
                              "probability",
                              Math.min(100, Math.max(0, Number(e.target.value) || 0))
                            )
                          }
                          className="h-8 text-xs pe-6 text-end font-mono"
                        />
                        <span className="absolute end-2 top-2 text-[10px] text-muted-foreground pointer-events-none">
                          %
                        </span>
                      </div>
                    </div>

                    <div className="w-28 shrink-0">
                      <div className="relative">
                        <Input
                          type="number"
                          min={1}
                          max={365}
                          value={stage.staleDays}
                          onChange={(e) =>
                            handleStageChange(
                              idx,
                              "staleDays",
                              Math.max(1, Number(e.target.value) || 14)
                            )
                          }
                          className="h-8 text-xs pe-7 text-end font-mono"
                        />
                        <span className="absolute end-2 top-2 text-[10px] text-muted-foreground pointer-events-none">
                          d
                        </span>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveStage(idx)}
                      disabled={stages.length <= 1 || isPending}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0"
                      title={pDict.deleteStage}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {errorMessage && (
              <p
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive flex items-center gap-1.5"
              >
                <AlertTriangle className="size-4 shrink-0" />
                {errorMessage}
              </p>
            )}

            {successMessage && (
              <p
                role="status"
                className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5"
              >
                <Check className="size-4 shrink-0" />
                {successMessage}
              </p>
            )}

            {confirmDeleteId && (
              <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5 space-y-3">
                <h5 className="text-xs font-bold text-destructive">
                  {pDict.deletePipeline}
                </h5>
                <p className="text-xs text-muted-foreground">
                  {pDict.deletePipelineConfirm}
                </p>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setConfirmDeleteId(null)}
                    disabled={isPending}
                  >
                    {common.cancel}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handleDeletePipeline(confirmDeleteId)}
                    disabled={isPending}
                  >
                    {isPending && <LoaderCircle className="size-3 animate-spin me-1" />}
                    {pDict.deletePipeline}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="p-4 border-t border-border flex flex-row items-center justify-between sm:justify-between">
          {!isCreatingNew && selectedPipe && !selectedPipe.isDefault && !confirmDeleteId ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive h-9 text-xs"
              onClick={() => setConfirmDeleteId(selectedPipe.id)}
              disabled={isPending || pipelines.length <= 1}
            >
              <Trash2 className="size-3.5 me-1" />
              {pDict.deletePipeline}
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
              disabled={isPending}
            >
              {common.cancel}
            </Button>
            <Button type="button" size="sm" onClick={handleSave} disabled={isPending}>
              {isPending && <LoaderCircle className="size-3.5 animate-spin me-1.5" />}
              {pDict.savePipelines || common.saveChanges}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

