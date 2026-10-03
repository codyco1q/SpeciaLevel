"use client";

import {
  ArrowRight,
  Circle as CircleIcon,
  Copy,
  Diamond,
  Eraser,
  Hand,
  Highlighter,
  Layers,
  MousePointer,
  Minus,
  Pencil,
  Square,
  StickyNote,
  Trash2,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WhiteboardElement, WhiteboardTool } from "@/types/database";
import {
  SHAPE_FILL_PRESETS,
  STICKY_COLOR_PRESETS,
  STICKY_SIZES,
  STROKE_COLOR_PRESETS,
} from "./whiteboard-types";
import { WhiteboardColorPicker } from "./whiteboard-color-picker";

interface WhiteboardToolbarProps {
  tool: WhiteboardTool;
  setTool: (tool: WhiteboardTool) => void;
  selectedElement: WhiteboardElement | null;
  selectedCount?: number;
  stickyColor: string;
  setStickyColor: (color: string) => void;
  shapeFillColor: string;
  setShapeFillColor: (color: string) => void;
  shapeStrokeColor: string;
  setShapeStrokeColor: (color: string) => void;
  textColor: string;
  setTextColor: (color: string) => void;
  pencilColor: string;
  setPencilColor: (color: string) => void;
  pencilWidth: number;
  setPencilWidth: (w: number) => void;
  strokeWidth: number;
  setStrokeWidth: (w: number) => void;
  onUpdateSelected: (updates: Partial<WhiteboardElement>) => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
  onLayerChange: (direction: "front" | "back") => void;
}

export function WhiteboardToolbar({
  tool,
  setTool,
  selectedElement,
  selectedCount = 0,
  stickyColor,
  setStickyColor,
  shapeFillColor,
  setShapeFillColor,
  shapeStrokeColor,
  setShapeStrokeColor,
  textColor,
  setTextColor,
  pencilColor,
  setPencilColor,
  pencilWidth,
  setPencilWidth,
  strokeWidth,
  setStrokeWidth,
  onUpdateSelected,
  onDuplicateSelected,
  onDeleteSelected,
  onLayerChange,
}: WhiteboardToolbarProps) {
  const tools: { id: WhiteboardTool; label: string; icon: React.ReactNode }[] = [
    { id: "select", label: "Select (V)", icon: <MousePointer className="h-4 w-4" /> },
    { id: "hand", label: "Hand / Pan (H)", icon: <Hand className="h-4 w-4" /> },
    { id: "sticky", label: "Sticky Note (S)", icon: <StickyNote className="h-4 w-4 text-amber-500" /> },
    { id: "text", label: "Text Box (T)", icon: <Type className="h-4 w-4" /> },
    { id: "rectangle", label: "Rectangle (R)", icon: <Square className="h-4 w-4 text-blue-500" /> },
    { id: "circle", label: "Circle (O)", icon: <CircleIcon className="h-4 w-4 text-emerald-500" /> },
    { id: "diamond", label: "Diamond (D)", icon: <Diamond className="h-4 w-4 text-purple-500" /> },
    { id: "arrow", label: "Smart Arrow (A)", icon: <ArrowRight className="h-4 w-4 text-cyan-500" /> },
    { id: "line", label: "Line (L)", icon: <Minus className="h-4 w-4" /> },
    { id: "pencil", label: "Pencil (P)", icon: <Pencil className="h-4 w-4 text-pink-500" /> },
    { id: "highlighter", label: "Highlighter", icon: <Highlighter className="h-4 w-4 text-yellow-500" /> },
    { id: "eraser", label: "Eraser (E)", icon: <Eraser className="h-4 w-4 text-rose-400" /> },
  ];

  const isShape = selectedElement && ["rectangle", "circle", "diamond"].includes(selectedElement.type);
  const isSticky = selectedElement?.type === "sticky";
  const isText = selectedElement?.type === "text";
  const isArrow = selectedElement?.type === "arrow";
  const isPencil = selectedElement && ["pencil", "highlighter", "pen"].includes(selectedElement.type);

  return (
    <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 pointer-events-auto">
      <div className="flex items-center gap-1 p-1.5 rounded-xl border border-border/80 bg-background/95 backdrop-blur shadow-xl">
        {tools.map((t) => (
          <Button
            key={t.id}
            type="button"
            size="sm"
            variant={tool === t.id ? "default" : "ghost"}
            className={cn("h-8 w-8 p-0", tool === t.id && "scale-105 shadow-xs")}
            onClick={() => setTool(t.id)}
            title={t.label}
          >
            {t.icon}
          </Button>
        ))}
      </div>

      {selectedCount > 1 ? (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border/80 bg-background/95 backdrop-blur shadow-lg text-xs">
          <span className="bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded text-[11px]">
            {selectedCount} elements selected
          </span>
          <div className="h-4 w-[1px] bg-border mx-1" />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => onLayerChange("front")}
            title="Bring Forward"
          >
            <Layers className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={onDuplicateSelected}
            title="Duplicate Selected (Ctrl+D)"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
            onClick={onDeleteSelected}
            title="Delete Selected (Delete/Backspace)"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (selectedElement || (tool !== "select" && tool !== "hand" && tool !== "eraser")) ? (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border/80 bg-background/95 backdrop-blur shadow-lg text-xs">
          {(isSticky || (!selectedElement && tool === "sticky")) && (
            <>
              <span className="text-muted-foreground font-semibold text-[11px]">Color:</span>
              <WhiteboardColorPicker
                color={selectedElement?.color || stickyColor}
                onChange={(c) => {
                  setStickyColor(c);
                  if (selectedElement) onUpdateSelected({ color: c });
                }}
                presets={STICKY_COLOR_PRESETS}
                title="Sticky Color"
              />
              <div className="h-4 w-[1px] bg-border mx-1" />
              <span className="text-muted-foreground font-semibold text-[11px]">Size:</span>
              {(Object.keys(STICKY_SIZES) as (keyof typeof STICKY_SIZES)[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    if (selectedElement) onUpdateSelected({ width: STICKY_SIZES[k].width, height: STICKY_SIZES[k].height });
                  }}
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[11px] font-medium border transition",
                    selectedElement?.width === STICKY_SIZES[k].width
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border hover:text-foreground"
                  )}
                >
                  {STICKY_SIZES[k].label}
                </button>
              ))}
            </>
          )}

          {(isShape || (!selectedElement && ["rectangle", "circle", "diamond"].includes(tool))) && (
            <>
              <span className="text-muted-foreground font-semibold text-[11px]">Fill:</span>
              <WhiteboardColorPicker
                color={selectedElement?.fillColor || shapeFillColor}
                onChange={(c) => {
                  setShapeFillColor(c);
                  if (selectedElement) onUpdateSelected({ fillColor: c });
                }}
                presets={SHAPE_FILL_PRESETS}
                allowTransparent={true}
                title="Fill Color"
              />
              <span className="text-muted-foreground font-semibold text-[11px]">Border:</span>
              <WhiteboardColorPicker
                color={selectedElement?.strokeColor || shapeStrokeColor}
                onChange={(c) => {
                  setShapeStrokeColor(c);
                  if (selectedElement) onUpdateSelected({ strokeColor: c });
                }}
                presets={STROKE_COLOR_PRESETS}
                title="Border Color"
              />
              <div className="h-4 w-[1px] bg-border mx-1" />
              {[1, 2, 4, 6].map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => {
                    setStrokeWidth(w);
                    if (selectedElement) onUpdateSelected({ strokeWidth: w });
                  }}
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[11px] font-medium border transition",
                    (selectedElement?.strokeWidth || strokeWidth) === w
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border hover:text-foreground"
                  )}
                >
                  {w}px
                </button>
              ))}
            </>
          )}

          {(isText || (!selectedElement && tool === "text")) && (
            <>
              <span className="text-muted-foreground font-semibold text-[11px]">Text Color:</span>
              <WhiteboardColorPicker
                color={selectedElement?.color || textColor}
                onChange={(c) => {
                  setTextColor(c);
                  if (selectedElement) onUpdateSelected({ color: c });
                }}
                presets={STROKE_COLOR_PRESETS}
                title="Text Color"
              />
              <div className="h-4 w-[1px] bg-border mx-1" />
              {[14, 20, 32, 48].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    if (selectedElement) onUpdateSelected({ fontSize: s });
                  }}
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[11px] font-medium border transition",
                    (selectedElement?.fontSize || 20) === s
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border hover:text-foreground"
                  )}
                >
                  {s}px
                </button>
              ))}
            </>
          )}

          {(tool === "pencil" || tool === "highlighter" || isPencil) && (
            <>
              <span className="text-muted-foreground font-semibold text-[11px]">Pencil Color:</span>
              <WhiteboardColorPicker
                color={selectedElement?.strokeColor || pencilColor}
                onChange={(c) => {
                  setPencilColor(c);
                  if (selectedElement) onUpdateSelected({ strokeColor: c });
                }}
                presets={STROKE_COLOR_PRESETS}
                title="Pencil Color"
              />
              {[2, 4, 8, 14].map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => {
                    setPencilWidth(w);
                    if (selectedElement) onUpdateSelected({ strokeWidth: w });
                  }}
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[11px] font-medium border transition",
                    (selectedElement?.strokeWidth || pencilWidth) === w
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border hover:text-foreground"
                  )}
                >
                  {w}px
                </button>
              ))}
            </>
          )}

          {(isArrow || (!selectedElement && tool === "arrow")) && (
            <>
              <span className="text-muted-foreground font-semibold text-[11px]">Arrow:</span>
              <WhiteboardColorPicker
                color={selectedElement?.strokeColor || shapeStrokeColor}
                onChange={(c) => {
                  setShapeStrokeColor(c);
                  if (selectedElement) onUpdateSelected({ strokeColor: c });
                }}
                presets={STROKE_COLOR_PRESETS}
                title="Arrow Color"
              />
              {(['straight', 'curved', 'orthogonal'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    if (selectedElement) onUpdateSelected({ arrowStyle: st });
                  }}
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[11px] capitalize font-medium border transition",
                    (selectedElement?.arrowStyle || "straight") === st
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border hover:text-foreground"
                  )}
                >
                  {st}
                </button>
              ))}
            </>
          )}

          {selectedElement && (
            <>
              <div className="h-4 w-[1px] bg-border mx-1" />
              <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onLayerChange("front")} title="Bring Forward">
                <Layers className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onDuplicateSelected} title="Duplicate">
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10" onClick={onDeleteSelected} title="Delete">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
