"use client";

import { useState, useTransition } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Layers,
  LoaderCircle,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createTaskStage,
  deleteTaskStage,
  updateTaskStages,
} from "@/lib/actions/tasks-powerhouse";
import type { TaskStage } from "@/types/database";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

const PRESET_COLORS = [
  "#64748b",
  "#3b82f6",
  "#6366f1",
  "#a855f7",
  "#ec4899",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#10b981",
  "#14b8a6",
];

interface ManageTaskStagesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: TaskStage[];
  onStagesUpdated: () => void;
  platform: Dictionary["platform"];
}

export function ManageTaskStagesDialog({
  open,
  onOpenChange,
  stages: initialStages,
  onStagesUpdated,
  platform,
}: ManageTaskStagesDialogProps) {
  const t = platform.tasks;
  const ts = t.stages || {
    manageStages: "Manage Custom Stages",
    addStage: "Add Stage",
    stageName: "Stage Name",
    stageColor: "Stage Color",
    isDoneStage: "Mark as Completed Stage",
    deleteStage: "Delete Stage",
    deleteStageConfirm: "Are you sure you want to delete this stage?",
    saveStages: "Save Stages",
    order: "Order",
    noStages: "No custom stages defined.",
    newStagePlaceholder: "Stage Name (e.g. Quality Assurance)",
  };

  const [stages, setStages] = useState<TaskStage[]>(initialStages);
  const [newStageName, setNewStageName] = useState("");
  const [newStageColor, setNewStageColor] = useState("#3b82f6");
  const [newStageIsDone, setNewStageIsDone] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setStages(initialStages);
      setErrorMessage(null);
    }
    onOpenChange(isOpen);
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= stages.length) return;

    const copy = [...stages];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;

    const updated = copy.map((s, idx) => ({ ...s, order_index: idx }));
    setStages(updated);
  };

  const handleUpdateStageProp = (
    index: number,
    field: keyof TaskStage,
    value: string | boolean | number
  ) => {
    setStages((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleSaveAll = () => {
    setErrorMessage(null);
    startTransition(async () => {
      const payload = stages.map((s, idx) => ({
        id: s.id,
        name: s.name,
        color: s.color,
        orderIndex: idx,
        isDoneStage: s.is_done_stage,
      }));

      const res = await updateTaskStages(payload);
      if (res.status === "error") {
        setErrorMessage(res.error ?? "Failed to save stages");
        return;
      }

      onStagesUpdated();
      onOpenChange(false);
    });
  };

  const handleAddNew = () => {
    if (!newStageName.trim()) return;
    setErrorMessage(null);

    startTransition(async () => {
      const res = await createTaskStage(newStageName, newStageColor, newStageIsDone);
      if (res.status === "error") {
        setErrorMessage(res.error ?? "Failed to create stage");
        return;
      }

      setNewStageName("");
      setNewStageColor("#3b82f6");
      setNewStageIsDone(false);
      onStagesUpdated();
    });
  };

  const handleDelete = (stageId: string) => {
    if (stages.length <= 1) {
      setErrorMessage("At least one stage must remain in the workflow.");
      return;
    }

    if (!window.confirm(ts.deleteStageConfirm)) return;

    setErrorMessage(null);
    startTransition(async () => {
      const res = await deleteTaskStage(stageId);
      if (res.status === "error") {
        setErrorMessage(res.error ?? "Failed to delete stage");
        return;
      }

      onStagesUpdated();
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            {ts.manageStages}
          </DialogTitle>
          <DialogDescription>
            Customize your workflow columns, colors, and completed stage markers.
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive font-medium">
            {errorMessage}
          </div>
        )}

        <div className="flex-1 overflow-y-auto pr-1 space-y-3 py-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
            Current Workflow Stages ({stages.length})
          </div>

          <div className="space-y-2">
            {stages.map((stage, idx) => (
              <div
                key={stage.id}
                className="flex items-center gap-2 rounded-lg border border-border/80 bg-card p-2.5 transition hover:border-border"
              >
                <div className="flex flex-col gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-muted-foreground hover:text-foreground"
                    disabled={idx === 0 || isPending}
                    onClick={() => handleMove(idx, "up")}
                  >
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-muted-foreground hover:text-foreground"
                    disabled={idx === stages.length - 1 || isPending}
                    onClick={() => handleMove(idx, "down")}
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                </div>

                <input
                  type="color"
                  value={stage.color}
                  onChange={(e) => handleUpdateStageProp(idx, "color", e.target.value)}
                  className="h-7 w-7 cursor-pointer rounded-full border-0 bg-transparent p-0"
                  title={ts.stageColor}
                />

                <Input
                  value={stage.name}
                  onChange={(e) => handleUpdateStageProp(idx, "name", e.target.value)}
                  className="h-8 flex-1 text-sm font-medium"
                  placeholder={ts.stageName}
                />

                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none px-1">
                  <Checkbox
                    checked={stage.is_done_stage}
                    onCheckedChange={(checked) =>
                      handleUpdateStageProp(idx, "is_done_stage", Boolean(checked))
                    }
                  />
                  <span>Done</span>
                </label>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  disabled={stages.length <= 1 || isPending}
                  onClick={() => handleDelete(stage.id)}
                  title={ts.deleteStage}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-lg border border-dashed border-border p-3.5 bg-muted/20 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {ts.addStage}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <Input
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                placeholder={ts.newStagePlaceholder}
                className="h-9 flex-1 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddNew();
                  }
                }}
              />

              <div className="flex items-center gap-1 overflow-x-auto py-1">
                {PRESET_COLORS.slice(0, 5).map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewStageColor(color)}
                    className="h-6 w-6 rounded-full border border-black/10 transition hover:scale-110 flex items-center justify-center shrink-0"
                    style={{ backgroundColor: color }}
                  >
                    {newStageColor === color && <Check className="h-3.5 w-3.5 text-white" />}
                  </button>
                ))}
                <input
                  type="color"
                  value={newStageColor}
                  onChange={(e) => setNewStageColor(e.target.value)}
                  className="h-6 w-6 cursor-pointer rounded-full border-0 bg-transparent p-0 ml-1 shrink-0"
                  title={ts.stageColor}
                />
              </div>

              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                <Checkbox
                  checked={newStageIsDone}
                  onCheckedChange={(c) => setNewStageIsDone(Boolean(c))}
                />
                <span className="whitespace-nowrap">Done</span>
              </label>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-9 gap-1 shrink-0"
                onClick={handleAddNew}
                disabled={!newStageName.trim() || isPending}
              >
                <Plus className="h-4 w-4" />
                {ts.addStage}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-2 pt-2 border-t border-border flex items-center justify-between sm:justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSaveAll}
            disabled={isPending}
            className="gap-2"
          >
            {isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {ts.saveStages}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

