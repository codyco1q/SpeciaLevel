"use client";

import { useState, useEffect, useTransition } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  DollarSign,
  Layers,
  LoaderCircle,
  Palette,
  Plus,
  Sparkles,
  Trash2,
  Trophy,
  XCircle,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  createPipeline,
  updatePipeline,
  deletePipeline,
  duplicatePipeline,
  type PipelineRow,
} from "@/lib/actions/crm";
import {
  PRESET_STAGE_COLORS,
  PIPELINE_TEMPLATES,
  getStageColor,
  getStageBadgeStyle,
  formatCurrency,
} from "./crm-meta";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";
import { cn } from "@/lib/utils";

interface EditableStage {
  id?: string;
  name: string;
  color: string;
  stageType: "open" | "won" | "lost";
  orderIndex: number;
  probability: number;
  staleDays: number;
}

interface PipelineManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelines: PipelineRow[];
  activePipelineId?: string;
  onPipelineSelect?: (pipelineId: string) => void;
  onSaved: () => void;
  platform: Dictionary["platform"];
  locale?: Locale;
}

export function PipelineManagerDialog({
  open,
  onOpenChange,
  pipelines,
  activePipelineId,
  onPipelineSelect,
  onSaved,
  platform,
  locale = "en",
}: PipelineManagerDialogProps) {
  const t = platform.crm;
  const pDict = t.pipelines;
  const common = platform.common;

  const [selectedPipeId, setSelectedPipeId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [pipelineName, setPipelineName] = useState("");
  const [pipelineColor, setPipelineColor] = useState("#6366f1");
  const [pipelineDesc, setPipelineDesc] = useState("");
  const [pipelineTarget, setPipelineTarget] = useState<string>("");
  const [isDefault, setIsDefault] = useState(false);
  const [stages, setStages] = useState<EditableStage[]>([]);

  // Quick Add Stage State
  const [newStageName, setNewStageName] = useState("");
  const [newStageColor, setNewStageColor] = useState("#3b82f6");
  const [newStageType, setNewStageType] = useState<"open" | "won" | "lost">("open");
  const [newStageProb, setNewStageProb] = useState(50);
  const [newStageStale, setNewStageStale] = useState(14);

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
    if (initialId && !isCreatingNew) {
      loadPipeline(initialId);
    } else if (!initialId) {
      startNewPipeline();
    }
  }, [open, activePipelineId, pipelines]);

  function loadPipeline(id: string) {
    const pipe = pipelines.find((p) => p.id === id);
    if (!pipe) return;

    setSelectedPipeId(pipe.id);
    setIsCreatingNew(false);
    setPipelineName(pipe.name);
    setPipelineColor(pipe.color || "#6366f1");
    setPipelineDesc(pipe.description || "");
    setPipelineTarget(pipe.targetAmount ? String(pipe.targetAmount) : "");
    setIsDefault(pipe.isDefault);
    setStages(
      pipe.stages.map((s, idx) => ({
        id: s.id,
        name: s.name,
        color: s.color || getStageColor(s.name, null, s.probability),
        stageType: s.stageType || (s.probability === 100 ? "won" : s.probability === 0 ? "lost" : "open"),
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
    setPipelineColor("#6366f1");
    setPipelineDesc("");
    setPipelineTarget("");
    setIsDefault(pipelines.length === 0);
    applyTemplate("standard");
    setErrorMessage(null);
    setSuccessMessage(null);
    setConfirmDeleteId(null);
  }

  function applyTemplate(templateId: string) {
    const tmpl = PIPELINE_TEMPLATES.find((t) => t.id === templateId) || PIPELINE_TEMPLATES[0];
    if (isCreatingNew && !pipelineName.trim()) {
      setPipelineName(tmpl.name);
      setPipelineColor(tmpl.color);
      setPipelineDesc(tmpl.description);
    }
    setStages(
      tmpl.stages.map((s, idx) => ({
        name: s.name,
        color: s.color,
        stageType: s.stageType,
        orderIndex: idx,
        probability: s.probability,
        staleDays: s.staleDays,
      }))
    );
  }

  function handleAddStage() {
    if (!newStageName.trim()) return;

    const prob =
      newStageType === "won" ? 100 : newStageType === "lost" ? 0 : Number(newStageProb) || 50;

    setStages((prev) => [
      ...prev,
      {
        name: newStageName.trim(),
        color: newStageColor,
        stageType: newStageType,
        orderIndex: prev.length,
        probability: prob,
        staleDays: Math.max(1, Number(newStageStale) || 14),
      },
    ]);

    setNewStageName("");
    setNewStageColor("#3b82f6");
    setNewStageType("open");
    setNewStageProb(50);
    setNewStageStale(14);
  }

  function handleRemoveStage(index: number) {
    if (stages.length <= 1) return;
    setStages((prev) => {
      const next = prev.filter((_, idx) => idx !== index);
      return next.map((s, idx) => ({ ...s, orderIndex: idx }));
    });
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
      const updated = { ...next[index], [key]: val };

      // Synchronize outcome type with probability & suggested colors
      if (key === "stageType") {
        if (val === "won") {
          updated.probability = 100;
          if (!updated.color || updated.color === "#3b82f6") updated.color = "#10b981";
        } else if (val === "lost") {
          updated.probability = 0;
          if (!updated.color || updated.color === "#3b82f6") updated.color = "#ef4444";
        }
      }

      next[index] = updated;
      return next;
    });
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
          color: pipelineColor,
          description: pipelineDesc.trim() || undefined,
          targetAmount: pipelineTarget.trim() ? Number(pipelineTarget) : undefined,
          isDefault,
          orderIndex: isCreatingNew ? pipelines.length : (selectedPipe?.orderIndex ?? 0),
          stages: stages.map((s, idx) => ({
            id: isCreatingNew ? undefined : s.id,
            name: s.name.trim(),
            color: s.color,
            stageType: s.stageType,
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
            setSelectedPipeId(newId);
            setIsCreatingNew(false);
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

  function handleDuplicate(pipeId: string) {
    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      try {
        const res = await duplicatePipeline(pipeId);
        if (res.status === "error") {
          setErrorMessage(res.error || "Failed to duplicate pipeline");
          return;
        }
        setSuccessMessage(pDict.pipelineDuplicated || "Pipeline duplicated successfully.");
        onSaved();
        if (res.data && typeof res.data === "object" && "id" in (res.data as Record<string, unknown>)) {
          const newId = String((res.data as Record<string, unknown>).id);
          setSelectedPipeId(newId);
          setIsCreatingNew(false);
          onPipelineSelect?.(newId);
        }
      } catch {
        setErrorMessage("An unexpected error occurred during duplication.");
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
      <DialogContent className="max-w-5xl lg:max-w-6xl w-[96vw] sm:w-[92vw] max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-5 pb-4 border-b border-border bg-card/60">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className="size-8 rounded-lg flex items-center justify-center text-white shadow-xs"
                style={{ backgroundColor: pipelineColor || "#6366f1" }}
              >
                <Layers className="size-4" />
              </div>
              <div>
                <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
                  {pDict.managePipelines}
                  {selectedPipe && !isCreatingNew && (
                    <span className="text-xs font-normal text-muted-foreground">
                      ({selectedPipe.stages.length} {pDict.stages})
                    </span>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground line-clamp-1">
                  {pDict.manageHint}
                </DialogDescription>
              </div>
            </div>

            {/* Quick Template Picker */}
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <Sparkles className="size-3 text-amber-500" />
                {pDict.templates}:
              </span>
              {PIPELINE_TEMPLATES.map((tmpl) => (
                <Button
                  key={tmpl.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyTemplate(tmpl.id)}
                  className="h-7 text-[11px] px-2 gap-1 rounded-md"
                  title={tmpl.description}
                  disabled={isPending}
                >
                  <span
                    className="size-2 rounded-full shrink-0"
                    style={{ backgroundColor: tmpl.color }}
                  />
                  {tmpl.name.split(" ")[0]}
                </Button>
              ))}
            </div>
          </div>
        </DialogHeader>

        {/* Two-Pane Body */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-[480px]">
          {/* Left Sidebar: Pipeline List */}
          <div className="w-full md:w-[260px] lg:w-[290px] border-b md:border-b-0 md:border-e border-border bg-muted/25 p-3.5 space-y-3 overflow-y-auto flex flex-col justify-between shrink-0">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  {pDict.pipelines}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1 shadow-2xs"
                  onClick={startNewPipeline}
                  disabled={isPending}
                >
                  <Plus className="size-3.5" />
                  {pDict.createPipeline}
                </Button>
              </div>

              <div className="space-y-1.5">
                {pipelines.map((pipe) => {
                  const isSelected = !isCreatingNew && selectedPipeId === pipe.id;
                  const pColor = pipe.color || "#6366f1";
                  return (
                    <div
                      key={pipe.id}
                      className={cn(
                        "group rounded-lg border transition-all flex items-center justify-between p-2.5 cursor-pointer text-start",
                        isSelected
                          ? "bg-card border-primary/40 shadow-xs ring-1 ring-primary/20"
                          : "bg-card/60 hover:bg-card border-border/80 text-foreground/80 hover:border-border"
                      )}
                      onClick={() => loadPipeline(pipe.id)}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span
                          className="size-3 rounded-full shrink-0 shadow-2xs"
                          style={{ backgroundColor: pColor }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs sm:text-sm font-semibold truncate leading-none">
                              {pipe.name}
                            </span>
                            {pipe.isDefault && (
                              <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5">
                                {pDict.isDefault}
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {pipe.stages.length} {pDict.stages}
                            {pipe.targetAmount ? ` • ${formatCurrency(pipe.targetAmount, "USD", locale)}` : ""}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100 shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                          title={pDict.duplicatePipeline}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicate(pipe.id);
                          }}
                          disabled={isPending}
                        >
                          <Copy className="size-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {isCreatingNew && (
                  <div className="p-2.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary border border-primary/40 flex items-center gap-2">
                    <Plus className="size-3.5 shrink-0" />
                    <span className="truncate">{pipelineName || pDict.createPipeline}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Templates Info for mobile */}
            <div className="sm:hidden pt-2 border-t border-border">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                {pDict.templates}:
              </span>
              <div className="grid grid-cols-2 gap-1 mt-1.5">
                {PIPELINE_TEMPLATES.map((tmpl) => (
                  <Button
                    key={tmpl.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyTemplate(tmpl.id)}
                    className="h-6 text-[10px] px-1.5 justify-start truncate"
                    disabled={isPending}
                  >
                    <span className="size-1.5 rounded-full me-1" style={{ backgroundColor: tmpl.color }} />
                    {tmpl.name}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Area: Active Pipeline & Stages Customizer */}
          <div className="flex-1 p-5 md:p-6 overflow-y-auto space-y-5">
            {/* Top Settings Form */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-4 shadow-2xs">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-start">
                {/* Pipeline Name */}
                <div className="md:col-span-5 space-y-1.5">
                  <Label htmlFor="pipe-name" className="text-xs font-semibold">
                    {pDict.pipelineName}
                  </Label>
                  <Input
                    id="pipe-name"
                    value={pipelineName}
                    onChange={(e) => setPipelineName(e.target.value)}
                    placeholder={pDict.pipelineNamePlaceholder}
                    className="h-9 text-xs sm:text-sm font-medium"
                  />
                </div>

                {/* Pipeline Theme Color */}
                <div className="md:col-span-3 space-y-1.5">
                  <Label className="text-xs font-semibold">{pDict.pipelineColor}</Label>
                  <div className="flex items-center gap-1.5">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="h-9 px-2.5 rounded-md border border-border bg-background flex items-center gap-2 hover:bg-muted/50 transition-colors w-full cursor-pointer"
                        >
                          <span
                            className="size-4 rounded-full border border-black/10 shrink-0"
                            style={{ backgroundColor: pipelineColor }}
                          />
                          <span className="text-xs font-mono truncate">{pipelineColor}</span>
                          <Palette className="size-3.5 text-muted-foreground ms-auto shrink-0" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-56 p-2.5 space-y-2" align="start">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                          {pDict.colorPalette}
                        </span>
                        <div className="grid grid-cols-7 gap-1.5">
                          {PRESET_STAGE_COLORS.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setPipelineColor(c)}
                              className="size-6 rounded-full border border-black/15 transition hover:scale-110 flex items-center justify-center cursor-pointer"
                              style={{ backgroundColor: c }}
                            >
                              {pipelineColor === c && <Check className="size-3 text-white" />}
                            </button>
                          ))}
                        </div>
                        <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground">{pDict.customColor}:</span>
                          <input
                            type="color"
                            value={pipelineColor}
                            onChange={(e) => setPipelineColor(e.target.value)}
                            className="size-7 rounded-md cursor-pointer border-0 bg-transparent p-0"
                          />
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Revenue Target */}
                <div className="md:col-span-4 space-y-1.5">
                  <Label htmlFor="pipe-target" className="text-xs font-semibold">
                    {pDict.pipelineTarget}
                  </Label>
                  <div className="relative">
                    <DollarSign className="absolute start-2.5 top-2.5 size-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      id="pipe-target"
                      type="number"
                      min={0}
                      value={pipelineTarget}
                      onChange={(e) => setPipelineTarget(e.target.value)}
                      placeholder={pDict.pipelineTargetPlaceholder}
                      className="h-9 ps-8 text-xs sm:text-sm font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Description & Default Checkbox */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                <div className="flex-1 min-w-0">
                  <Input
                    value={pipelineDesc}
                    onChange={(e) => setPipelineDesc(e.target.value)}
                    placeholder={pDict.pipelineDescriptionPlaceholder}
                    className="h-8 text-xs text-muted-foreground bg-muted/20"
                  />
                </div>

                <div className="flex items-center space-x-2 rtl:space-x-reverse shrink-0">
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
            </div>

            {/* Live Funnel Visual Preview Strip */}
            <div className="rounded-lg border border-border/80 bg-muted/30 p-3 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="size-3 text-primary" />
                  {pDict.funnelPreview}
                </span>
                <span>
                  {stages.length} {pDict.stages}
                </span>
              </div>
              <div className="flex items-center gap-1 overflow-x-auto py-1">
                {stages.map((st, idx) => (
                  <div
                    key={st.id || `preview-${idx}`}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold shrink-0 border transition-all"
                    style={getStageBadgeStyle(st.color)}
                  >
                    <span
                      className="size-1.5 rounded-full"
                      style={{ backgroundColor: st.color }}
                    />
                    <span className="truncate max-w-[100px]">{st.name}</span>
                    <span className="opacity-75 font-mono text-[10px]">
                      {st.stageType === "won" ? "🏆" : st.stageType === "lost" ? "❌" : `${st.probability}%`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Stages Management Section */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-foreground">{pDict.stages}</h4>
                  <p className="text-xs text-muted-foreground">{pDict.staleDaysHint}</p>
                </div>
              </div>

              {/* Column Headers */}
              <div className="hidden sm:flex items-center gap-2.5 px-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                <span className="w-14 text-center">{platform.tasks.stages?.order || "Order"}</span>
                <span className="w-10 text-center">{pDict.stageColor}</span>
                <span className="flex-1">{pDict.stageName}</span>
                <span className="w-28 text-center">{pDict.stageType}</span>
                <span className="w-20 text-center">{pDict.probability}</span>
                <span className="w-24 text-center">{pDict.staleDays}</span>
                <span className="w-8 text-end"></span>
              </div>

              <div className="space-y-2">
                {stages.map((stage, idx) => (
                  <div
                    key={stage.id || `stage-${idx}`}
                    className="group flex flex-wrap sm:flex-nowrap items-center gap-2 p-2.5 rounded-lg border border-border bg-card shadow-2xs transition-all hover:border-primary/30"
                  >
                    {/* Move Up/Down Controls */}
                    <div className="flex items-center gap-0.5 w-14 justify-center shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMoveStage(idx, "up")}
                        disabled={idx === 0 || isPending}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground disabled:opacity-20"
                        title={pDict.moveUp}
                      >
                        <ArrowUp className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMoveStage(idx, "down")}
                        disabled={idx === stages.length - 1 || isPending}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground disabled:opacity-20"
                        title={pDict.moveDown}
                      >
                        <ArrowDown className="size-3.5" />
                      </Button>
                    </div>

                    {/* Color Swatch Picker */}
                    <div className="w-10 flex justify-center shrink-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="size-7 rounded-full border border-black/20 shadow-2xs transition hover:scale-110 flex items-center justify-center shrink-0 cursor-pointer"
                            style={{ backgroundColor: stage.color }}
                            title={pDict.stageColor}
                          >
                            <span className="size-1.5 rounded-full bg-white/70" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56 p-2.5 space-y-2" align="start">
                          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                            {pDict.stageColor}
                          </span>
                          <div className="grid grid-cols-7 gap-1.5">
                            {PRESET_STAGE_COLORS.map((c) => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => handleStageChange(idx, "color", c)}
                                className="size-6 rounded-full border border-black/15 transition hover:scale-110 flex items-center justify-center cursor-pointer"
                                style={{ backgroundColor: c }}
                              >
                                {stage.color === c && <Check className="size-3 text-white" />}
                              </button>
                            ))}
                          </div>
                          <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
                            <span className="text-xs text-muted-foreground">{pDict.customColor}:</span>
                            <input
                              type="color"
                              value={stage.color}
                              onChange={(e) => handleStageChange(idx, "color", e.target.value)}
                              className="size-7 rounded-md cursor-pointer border-0 bg-transparent p-0"
                            />
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Stage Name */}
                    <div className="flex-1 min-w-[140px]">
                      <Input
                        value={stage.name}
                        onChange={(e) => handleStageChange(idx, "name", e.target.value)}
                        placeholder={pDict.stageName}
                        className="h-8 text-xs sm:text-sm font-semibold"
                      />
                    </div>

                    {/* Outcome / Stage Type Toggle */}
                    <div className="w-28 shrink-0 flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleStageChange(idx, "stageType", "open")}
                        className={cn(
                          "px-2 py-1 text-[11px] font-medium rounded-md transition-all border",
                          stage.stageType === "open"
                            ? "bg-primary/10 text-primary border-primary/40 font-semibold"
                            : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted"
                        )}
                        title={pDict.typeOpen}
                      >
                        Active
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStageChange(idx, "stageType", "won")}
                        className={cn(
                          "px-1.5 py-1 text-[11px] font-medium rounded-md transition-all border",
                          stage.stageType === "won"
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 font-semibold"
                            : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted"
                        )}
                        title={pDict.typeWon}
                      >
                        <Trophy className="size-3 text-emerald-500 inline" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStageChange(idx, "stageType", "lost")}
                        className={cn(
                          "px-1.5 py-1 text-[11px] font-medium rounded-md transition-all border",
                          stage.stageType === "lost"
                            ? "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/40 font-semibold"
                            : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted"
                        )}
                        title={pDict.typeLost}
                      >
                        <XCircle className="size-3 text-red-500 inline" />
                      </button>
                    </div>

                    {/* Probability % */}
                    <div className="w-20 shrink-0">
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
                          disabled={stage.stageType === "won" || stage.stageType === "lost"}
                          className="h-8 text-xs pe-5 text-end font-mono"
                        />
                        <span className="absolute end-1.5 top-2 text-[11px] text-muted-foreground pointer-events-none">
                          %
                        </span>
                      </div>
                    </div>

                    {/* Stale Threshold */}
                    <div className="w-24 shrink-0">
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
                          className="h-8 text-xs pe-5 text-end font-mono"
                        />
                        <span className="absolute end-1.5 top-2 text-[11px] text-muted-foreground pointer-events-none">
                          d
                        </span>
                      </div>
                    </div>

                    {/* Delete Stage Button */}
                    <div className="w-8 flex justify-end shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveStage(idx)}
                        disabled={stages.length <= 1 || isPending}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title={pDict.deleteStage}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick Add Stage Row */}
              <div className="mt-4 rounded-xl border border-dashed border-border p-3 bg-muted/20 space-y-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Plus className="size-3.5 text-primary" />
                  {pDict.addStage}
                </span>

                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                  {/* Color Picker for new stage */}
                  <div className="flex items-center gap-1 overflow-x-auto shrink-0 py-0.5">
                    {PRESET_STAGE_COLORS.slice(0, 5).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewStageColor(c)}
                        className="size-6 rounded-full border border-black/10 transition hover:scale-110 flex items-center justify-center shrink-0"
                        style={{ backgroundColor: c }}
                      >
                        {newStageColor === c && <Check className="size-3 text-white" />}
                      </button>
                    ))}
                    <input
                      type="color"
                      value={newStageColor}
                      onChange={(e) => setNewStageColor(e.target.value)}
                      className="size-6 cursor-pointer rounded-full border-0 bg-transparent p-0 ms-0.5 shrink-0"
                      title={pDict.stageColor}
                    />
                  </div>

                  {/* Stage Name Input */}
                  <Input
                    value={newStageName}
                    onChange={(e) => setNewStageName(e.target.value)}
                    placeholder={pDict.newStagePlaceholder}
                    className="h-8 flex-1 min-w-[160px] text-xs font-medium"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddStage();
                      }
                    }}
                  />

                  {/* Stage Type Toggle */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setNewStageType("open");
                        if (newStageProb === 100 || newStageProb === 0) setNewStageProb(50);
                      }}
                      className={cn(
                        "px-2 py-1 text-[11px] rounded-md border",
                        newStageType === "open"
                          ? "bg-primary/10 text-primary border-primary/40 font-semibold"
                          : "bg-muted/40 text-muted-foreground border-transparent"
                      )}
                    >
                      Active
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewStageType("won");
                        setNewStageProb(100);
                        setNewStageColor("#10b981");
                      }}
                      className={cn(
                        "px-1.5 py-1 text-[11px] rounded-md border",
                        newStageType === "won"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 font-semibold"
                          : "bg-muted/40 text-muted-foreground border-transparent"
                      )}
                      title={pDict.typeWon}
                    >
                      <Trophy className="size-3 text-emerald-500 inline" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewStageType("lost");
                        setNewStageProb(0);
                        setNewStageColor("#ef4444");
                      }}
                      className={cn(
                        "px-1.5 py-1 text-[11px] rounded-md border",
                        newStageType === "lost"
                          ? "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/40 font-semibold"
                          : "bg-muted/40 text-muted-foreground border-transparent"
                      )}
                      title={pDict.typeLost}
                    >
                      <XCircle className="size-3 text-red-500 inline" />
                    </button>
                  </div>

                  {/* Add Button */}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-8 gap-1 shrink-0 text-xs font-semibold"
                    onClick={handleAddStage}
                    disabled={!newStageName.trim() || isPending}
                  >
                    <Plus className="size-3.5" />
                    {pDict.addStage}
                  </Button>
                </div>
              </div>
            </div>

            {/* Error / Success feedback */}
            {errorMessage && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive flex items-center gap-2"
              >
                <AlertTriangle className="size-4 shrink-0" />
                {errorMessage}
              </p>
            )}

            {successMessage && (
              <p
                role="status"
                className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2"
              >
                <Check className="size-4 shrink-0" />
                {successMessage}
              </p>
            )}

            {/* Delete Pipeline Confirmation */}
            {confirmDeleteId && (
              <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 space-y-3">
                <h5 className="text-xs font-bold text-destructive flex items-center gap-1.5">
                  <AlertTriangle className="size-4" />
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

        {/* Footer */}
        <DialogFooter className="p-4 border-t border-border bg-card/60 flex flex-row items-center justify-between sm:justify-between">
          {!isCreatingNew && selectedPipe && !selectedPipe.isDefault && !confirmDeleteId ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 text-xs gap-1.5"
              onClick={() => setConfirmDeleteId(selectedPipe.id)}
              disabled={isPending || pipelines.length <= 1}
            >
              <Trash2 className="size-3.5" />
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
              className="h-8 text-xs"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {common.cancel}
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs font-semibold gap-1.5"
              onClick={handleSave}
              disabled={isPending}
            >
              {isPending && <LoaderCircle className="size-3.5 animate-spin" />}
              {pDict.savePipelines || common.saveChanges}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

