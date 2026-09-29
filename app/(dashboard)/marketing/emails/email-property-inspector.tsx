"use client";

import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Sliders,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { EmailBlock } from "@/types/database";

interface EmailPropertyInspectorProps {
  selectedBlock: EmailBlock | null;
  onUpdateBlock: (updated: EmailBlock) => void;
}

export function EmailPropertyInspector({
  selectedBlock,
  onUpdateBlock,
}: EmailPropertyInspectorProps) {
  if (!selectedBlock) {
    return (
      <div className="w-72 border-l bg-card/50 p-6 flex flex-col items-center justify-center text-center text-muted-foreground shrink-0">
        <Sliders className="size-8 mb-2 opacity-30" />
        <p className="text-xs font-medium">Select a block on canvas to configure styling and attributes.</p>
      </div>
    );
  }

  const updateContent = (fields: Partial<EmailBlock["content"]>) => {
    onUpdateBlock({
      ...selectedBlock,
      content: { ...selectedBlock.content, ...fields },
    });
  };

  const updateStyle = (fields: Partial<NonNullable<EmailBlock["style"]>>) => {
    onUpdateBlock({
      ...selectedBlock,
      style: { ...(selectedBlock.style || {}), ...fields },
    });
  };

  const style = selectedBlock.style || {};

  return (
    <div className="w-72 border-l bg-card/50 p-4 space-y-4 overflow-y-auto shrink-0">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground pb-2 border-b">
        <Sliders className="size-3.5 text-primary" />
        <span>Block Inspector ({selectedBlock.type})</span>
      </div>

      {["header", "text", "button", "image"].includes(selectedBlock.type) && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Alignment</Label>
          <div className="flex rounded-lg border bg-muted/40 p-0.5">
            {(["left", "center", "right"] as const).map((align) => (
              <button
                key={align}
                type="button"
                onClick={() => updateStyle({ textAlign: align })}
                className={`flex-1 flex items-center justify-center py-1 rounded text-xs transition-all ${
                  (style.textAlign || "left") === align
                    ? "bg-background shadow-xs text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {align === "left" && <AlignLeft className="size-3.5" />}
                {align === "center" && <AlignCenter className="size-3.5" />}
                {align === "right" && <AlignRight className="size-3.5" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedBlock.type === "header" && (
        <div className="space-y-2.5">
          <div className="space-y-1">
            <Label className="text-xs font-medium">Heading Level</Label>
            <div className="grid grid-cols-3 gap-1">
              {([1, 2, 3] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => updateContent({ level: lvl })}
                  className={`py-1 rounded text-xs border ${
                    (selectedBlock.content.level || 1) === lvl
                      ? "border-primary bg-primary/10 text-primary font-bold"
                      : "border-border/60 text-muted-foreground"
                  }`}
                >
                  H{lvl}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium">Font Size (px)</Label>
            <Input
              type="number"
              value={style.fontSize || 24}
              onChange={(e) => updateStyle({ fontSize: Number(e.target.value) })}
              className="text-xs font-mono h-8"
            />
          </div>
        </div>
      )}

      {selectedBlock.type === "text" && (
        <div className="space-y-2.5">
          <div className="space-y-1">
            <Label className="text-xs font-medium">Font Size (px)</Label>
            <Input
              type="number"
              value={style.fontSize || 15}
              onChange={(e) => updateStyle({ fontSize: Number(e.target.value) })}
              className="text-xs font-mono h-8"
            />
          </div>
        </div>
      )}

      {selectedBlock.type === "button" && (
        <div className="space-y-2.5">
          <div className="space-y-1">
            <Label className="text-xs font-medium">Button Label</Label>
            <Input
              value={selectedBlock.content.buttonText || ""}
              onChange={(e) => updateContent({ buttonText: e.target.value })}
              className="text-xs h-8"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium">Target URL</Label>
            <Input
              value={selectedBlock.content.buttonUrl || ""}
              onChange={(e) => updateContent({ buttonUrl: e.target.value })}
              className="text-xs font-mono h-8"
            />
          </div>
        </div>
      )}

      {selectedBlock.type === "image" && (
        <div className="space-y-2.5">
          <div className="space-y-1">
            <Label className="text-xs font-medium">Image URL</Label>
            <Input
              value={selectedBlock.content.imageUrl || ""}
              onChange={(e) => updateContent({ imageUrl: e.target.value })}
              className="text-xs font-mono h-8"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium">Alt Text</Label>
            <Input
              value={selectedBlock.content.imageAlt || ""}
              onChange={(e) => updateContent({ imageAlt: e.target.value })}
              className="text-xs h-8"
            />
          </div>
        </div>
      )}

      {selectedBlock.type === "spacer" && (
        <div className="space-y-1">
          <Label className="text-xs font-medium">Height (px)</Label>
          <Input
            type="number"
            value={selectedBlock.content.spacerHeight || 24}
            onChange={(e) => updateContent({ spacerHeight: Number(e.target.value) })}
            min={8}
            max={120}
            className="text-xs font-mono h-8"
          />
        </div>
      )}
    </div>
  );
}
