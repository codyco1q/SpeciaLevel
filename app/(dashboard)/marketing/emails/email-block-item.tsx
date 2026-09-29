"use client";

import { ArrowUp, ArrowDown, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { WORKFLOW_TEMPLATE_VARIABLES } from "@/lib/validations/automations";
import type { EmailBlock } from "@/types/database";

interface EmailBlockItemProps {
  block: EmailBlock;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updated: EmailBlock) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}

export function EmailBlockItem({
  block,
  isSelected,
  onSelect,
  onUpdate,
  onMoveUp,
  onMoveDown,
  onDelete,
}: EmailBlockItemProps) {
  const align = block.style?.textAlign || "left";

  const handleInsertVariable = (varKey: string) => {
    const curText = block.content.text || "";
    onUpdate({
      ...block,
      content: { ...block.content, text: `${curText}${curText ? " " : ""}${varKey}` },
    });
  };

  return (
    <div
      onClick={onSelect}
      className={`relative p-3 rounded-lg border transition-all cursor-pointer group ${
        isSelected
          ? "border-primary ring-2 ring-primary/20 bg-primary/2 shadow-xs"
          : "border-border/60 hover:border-border bg-background"
      }`}
    >
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-card/90 rounded-md border p-0.5 shadow-xs">
        <button type="button" onClick={(e) => { e.stopPropagation(); onMoveUp(); }} className="size-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground">
          <ArrowUp className="size-3" />
        </button>
        <button type="button" onClick={(e) => { e.stopPropagation(); onMoveDown(); }} className="size-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground">
          <ArrowDown className="size-3" />
        </button>
        <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="size-5 flex items-center justify-center rounded hover:bg-destructive/10 text-destructive">
          <Trash2 className="size-3" />
        </button>
      </div>

      {block.type === "header" && (
        <div style={{ textAlign: align }}>
          <Input
            value={block.content.text || ""}
            onChange={(e) => onUpdate({ ...block, content: { ...block.content, text: e.target.value } })}
            placeholder="Heading..."
            className="font-bold border-none shadow-none focus-visible:ring-0 p-0 text-base"
            style={{ color: block.style?.textColor || "#0f172a", fontSize: `${block.style?.fontSize || 24}px`, textAlign: align }}
          />
        </div>
      )}

      {block.type === "text" && (
        <div style={{ textAlign: align }}>
          <Textarea
            value={block.content.text || ""}
            onChange={(e) => onUpdate({ ...block, content: { ...block.content, text: e.target.value } })}
            placeholder="Type message..."
            className="border-none shadow-none focus-visible:ring-0 p-0 text-sm resize-none min-h-[60px]"
            style={{ color: block.style?.textColor || "#334155", fontSize: `${block.style?.fontSize || 15}px`, textAlign: align }}
          />
          {isSelected && (
            <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-dashed">
              {WORKFLOW_TEMPLATE_VARIABLES.slice(0, 4).map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleInsertVariable(v.key); }}
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted hover:bg-primary/10 border text-muted-foreground hover:text-primary transition-colors"
                >
                  {v.key}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {block.type === "button" && (
        <div style={{ textAlign: align }}>
          <span
            className="inline-block px-4 py-2 rounded font-semibold text-sm"
            style={{
              backgroundColor: block.style?.buttonColor || "#2563eb",
              color: block.style?.buttonTextColor || "#ffffff",
              borderRadius: `${block.style?.borderRadius ?? 6}px`,
            }}
          >
            {block.content.buttonText || "Button CTA"}
          </span>
        </div>
      )}

      {block.type === "image" && (
        <div style={{ textAlign: align }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={block.content.imageUrl || "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=800&q=80"}
            alt={block.content.imageAlt || "Visual"}
            className="rounded-lg max-h-[140px] object-cover inline-block border"
          />
        </div>
      )}

      {block.type === "divider" && (
        <hr style={{ borderTop: `1px solid ${block.content.dividerColor || "#e2e8f0"}` }} className="my-1 border-0" />
      )}

      {block.type === "spacer" && (
        <div style={{ height: `${block.content.spacerHeight || 24}px` }} className="border border-dashed rounded flex items-center justify-center text-[10px] text-muted-foreground font-mono">
          Spacer ({block.content.spacerHeight || 24}px)
        </div>
      )}
    </div>
  );
}
