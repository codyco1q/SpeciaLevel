"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, Minus, RotateCcw, MousePointerClick, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TriggerNode } from "./trigger-node";
import { StepNode } from "./step-node";
import type {
  WorkflowTriggerType,
  WorkflowStep,
} from "@/lib/validations/automations";
import type { AutomationConfigOptions } from "@/lib/actions/automations";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { cn } from "@/lib/utils";

interface StudioCanvasProps {
  triggerType: WorkflowTriggerType;
  triggerConfig: Record<string, any>;
  steps: WorkflowStep[];
  canManage: boolean;
  configOptions: AutomationConfigOptions;
  onOpenTriggerConfig: () => void;
  onInsertStep: (index: number) => void;
  onSelectStepConfig: (step: WorkflowStep) => void;
  onMoveStep?: (index: number, direction: "up" | "down") => void;
  onReorderSteps?: (fromIndex: number, toIndex: number) => void;
  onDeleteStep: (stepId: string) => void;
  platform: Dictionary["platform"];
}

export function StudioCanvas({
  triggerType,
  triggerConfig,
  steps,
  canManage,
  configOptions,
  onOpenTriggerConfig,
  onInsertStep,
  onSelectStepConfig,
  onMoveStep,
  onReorderSteps,
  onDeleteStep,
  platform,
}: StudioCanvasProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.08 : -0.08;
        setZoom((prev) => Math.min(1.8, Math.max(0.4, Number((prev + delta).toFixed(2)))));
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 2 || e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - startPan.x, y: e.clientY - startPan.y });
    }
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
    }
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleDragStart = (index: number, e: React.DragEvent) => {
    setDraggedIndex(index);
    e.dataTransfer.setData("text/plain", String(index));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (index: number, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (targetIndex: number, e: React.DragEvent) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== targetIndex) {
      if (onReorderSteps) {
        onReorderSteps(draggedIndex, targetIndex);
      } else if (onMoveStep) {
        onMoveStep(draggedIndex, targetIndex > draggedIndex ? "down" : "up");
      }
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const bgDotSize = 20 * zoom;
  const bgOffsetX = ((pan.x % bgDotSize) + bgDotSize) % bgDotSize;
  const bgOffsetY = ((pan.y % bgDotSize) + bgDotSize) % bgDotSize;
  return (
    <div
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        "flex-1 relative w-full h-full overflow-hidden select-none",
        isPanning ? "cursor-grabbing" : "cursor-default"
      )}
      style={{
        backgroundImage: `radial-gradient(circle, var(--color-border) 1px, transparent 1px)`,
        backgroundSize: `${bgDotSize}px ${bgDotSize}px`,
        backgroundPosition: `${bgOffsetX}px ${bgOffsetY}px`,
      }}
    >
      {/* Scrollable / pannable transform stage */}
      <div
        className="w-full h-full overflow-y-auto overflow-x-hidden p-4 sm:p-8 flex flex-col items-center"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "center top",
          transition: isPanning ? "none" : "transform 0.05s ease-out",
        }}
      >
        <div className="w-full max-w-2xl space-y-4 pb-28">
          {/* 1. TRIGGER NODE */}
          <TriggerNode
            triggerType={triggerType}
            triggerConfig={triggerConfig}
            canManage={canManage}
            configOptions={configOptions}
            onOpenConfig={onOpenTriggerConfig}
            platform={platform}
          />

          {/* Insertion Node After Trigger */}
          {canManage && (
            <div className="flex flex-col items-center my-2">
              <div className="h-6 w-0.5 bg-border" />
              <Button
                variant="outline"
                size="sm"
                onClick={() => onInsertStep(0)}
                className="h-7 text-[11px] gap-1 rounded-full px-3 shadow-2xs border-dashed border-border hover:border-primary hover:text-primary transition-all bg-card shrink-0"
              >
                <Plus className="size-3" />
                <span>Insert First Step</span>
              </Button>
              <div className="h-6 w-0.5 bg-border" />
            </div>
          )}

          {/* 2. SEQUENTIAL ACTION STEPS (Drag-and-Drop Reorderable) */}
          {steps.map((step, index) => (
            <div
              key={step.id}
              className="relative group"
              onDragOver={(e) => handleDragOver(index, e)}
              onDrop={(e) => handleDrop(index, e)}
            >
              <StepNode
                step={step}
                index={index}
                totalSteps={steps.length}
                canManage={canManage}
                onOpenConfig={() => onSelectStepConfig(step)}
                onDelete={() => onDeleteStep(step.id)}
                isDragging={draggedIndex === index}
                isDragOver={dragOverIndex === index}
                onDragStart={(e) => handleDragStart(index, e)}
                onDragOver={(e) => handleDragOver(index, e)}
                onDragLeave={() => {
                  if (dragOverIndex === index) setDragOverIndex(null);
                }}
                onDrop={(e) => handleDrop(index, e)}
                onDragEnd={handleDragEnd}
              />

              {/* Insertion Node Between Steps or at End */}
              {canManage && (
                <div className="flex flex-col items-center my-2">
                  <div className="h-6 w-0.5 bg-border" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onInsertStep(index + 1)}
                    className="h-7 text-[11px] gap-1 rounded-full px-3 shadow-2xs border-dashed border-border hover:border-primary hover:text-primary transition-all bg-card shrink-0"
                  >
                    <Plus className="size-3" />
                    <span>Insert Step</span>
                  </Button>
                  {index < steps.length - 1 && <div className="h-6 w-0.5 bg-border" />}
                </div>
              )}
            </div>
          ))}

          {/* Empty Steps State */}
          {steps.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center bg-card/40">
              <p className="text-xs text-muted-foreground">
                No action steps added yet. Click &quot;Insert First Step&quot; above to add automated responses, SMS, webhooks, or CRM tags.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Floating Canvas Viewport Navigation Toolbar */}
      <div className="absolute end-4 bottom-4 z-20 flex items-center gap-1.5 p-1.5 rounded-xl bg-card/95 border border-border shadow-md backdrop-blur-xs">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.1).toFixed(2))))}
          className="size-7 text-muted-foreground hover:text-foreground"
          title="Zoom out"
        >
          <Minus className="size-3.5" />
        </Button>

        <button
          type="button"
          onClick={handleResetView}
          className="px-2 py-0.5 text-[11px] font-mono font-medium rounded hover:bg-muted text-foreground transition-colors"
          title="Click to reset zoom to 100%"
        >
          {Math.round(zoom * 100)}%
        </button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setZoom((z) => Math.min(1.8, Number((z + 0.1).toFixed(2))))}
          className="size-7 text-muted-foreground hover:text-foreground"
          title="Zoom in"
        >
          <Plus className="size-3.5" />
        </Button>

        <div className="h-3.5 w-px bg-border shrink-0 mx-0.5" />

        <Button
          variant="ghost"
          size="icon"
          onClick={handleResetView}
          className="size-7 text-muted-foreground hover:text-foreground"
          title="Reset canvas pan & zoom"
        >
          <RotateCcw className="size-3" />
        </Button>

        <div className="hidden lg:flex items-center gap-1.5 ms-1.5 pe-1 text-[10px] text-muted-foreground font-medium border-s border-border ps-2">
          <Navigation className="size-3 text-primary rotate-45" />
          <span>Right-click drag to pan</span>
          <span className="text-border">•</span>
          <MousePointerClick className="size-3 text-primary" />
          <span>Ctrl + scroll to zoom</span>
        </div>
      </div>
    </div>
  );
}