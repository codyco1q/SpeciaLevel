"use client";

import { AlertCircle, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RichTextBlock } from "@/types/database";

export interface BlockItemProps {
  block: RichTextBlock;
  index: number;
  readOnly?: boolean;
  placeholder?: string;
  onContentChange: (i: number, v: string) => void;
  onCheckToggle: (i: number) => void;
  onAddBlock: (i: number, t?: RichTextBlock["type"]) => void;
  onDeleteBlock: (i: number) => void;
}

export function BlockItem({
  block,
  index,
  readOnly,
  placeholder,
  onContentChange,
  onCheckToggle,
  onAddBlock,
  onDeleteBlock,
}: BlockItemProps) {
  const b = "w-full bg-transparent placeholder:text-muted-foreground/50 focus:outline-none";

  return (
    <div className="group relative flex items-start gap-1.5 rounded-md px-1 py-0.5 hover:bg-muted/40 transition-colors">
      {!readOnly && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pt-1 text-muted-foreground">
          <button type="button" onClick={() => onAddBlock(index)} className="rounded p-0.5 hover:bg-muted" title="Add">
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => onDeleteBlock(index)} className="rounded p-0.5 hover:bg-destructive/10 hover:text-destructive" title="Delete">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="flex-1 min-w-0">
        {block.type.startsWith("heading") && (
          <input
            type="text"
            disabled={readOnly}
            value={block.content}
            placeholder={`Heading ${block.type.replace("heading", "")}`}
            onChange={(e) => onContentChange(index, e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAddBlock(index, "paragraph"); } }}
            className={cn(b, "font-bold text-foreground", block.type === "heading1" ? "text-xl" : block.type === "heading2" ? "text-lg" : "text-base")}
          />
        )}
        {block.type === "paragraph" && (
          <textarea
            disabled={readOnly}
            value={block.content}
            placeholder={index === 0 ? placeholder : "Type '/' for commands..."}
            rows={1}
            onChange={(e) => {
              onContentChange(index, e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onAddBlock(index, "paragraph"); } }}
            className={cn(b, "resize-none text-sm leading-relaxed text-foreground")}
          />
        )}
        {block.type === "bulletList" && (
          <div className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground" />
            <input
              type="text"
              disabled={readOnly}
              value={block.content}
              placeholder="List item..."
              onChange={(e) => onContentChange(index, e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAddBlock(index, "bulletList"); } }}
              className={cn(b, "text-sm text-foreground")}
            />
          </div>
        )}
        {block.type === "numberedList" && (
          <div className="flex items-start gap-2">
            <span className="mt-0.5 text-xs font-semibold text-muted-foreground">{index + 1}.</span>
            <input
              type="text"
              disabled={readOnly}
              value={block.content}
              placeholder="Numbered item..."
              onChange={(e) => onContentChange(index, e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAddBlock(index, "numberedList"); } }}
              className={cn(b, "text-sm text-foreground")}
            />
          </div>
        )}
        {block.type === "todoList" && (
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={Boolean(block.checked)}
              onChange={() => onCheckToggle(index)}
              disabled={readOnly}
              className="mt-1 h-3.5 w-3.5 rounded border-border text-primary cursor-pointer"
            />
            <input
              type="text"
              disabled={readOnly}
              value={block.content}
              placeholder="To-do item..."
              onChange={(e) => onContentChange(index, e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAddBlock(index, "todoList"); } }}
              className={cn(b, "text-sm text-foreground", block.checked && "line-through text-muted-foreground")}
            />
          </div>
        )}
        {block.type === "quote" && (
          <div className="border-l-2 border-primary/60 pl-3 italic text-muted-foreground">
            <textarea
              disabled={readOnly}
              value={block.content}
              placeholder="Quote text..."
              rows={1}
              onChange={(e) => {
                onContentChange(index, e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              className={cn(b, "resize-none text-sm italic")}
            />
          </div>
        )}
        {block.type === "code" && (
          <div className="rounded-md bg-zinc-950 p-2 font-mono text-xs text-emerald-400 border border-border/40">
            <textarea
              disabled={readOnly}
              value={block.content}
              placeholder="// Code..."
              rows={2}
              onChange={(e) => {
                onContentChange(index, e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              className={cn(b, "resize-none font-mono text-xs")}
            />
          </div>
        )}
        {block.type === "callout" && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-sm text-amber-900 dark:text-amber-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
            <textarea
              disabled={readOnly}
              value={block.content}
              placeholder="Notice..."
              rows={1}
              onChange={(e) => {
                onContentChange(index, e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              className={cn(b, "resize-none text-sm")}
            />
          </div>
        )}
        {block.type === "divider" && <div className="my-2 border-t border-border" />}
      </div>
    </div>
  );
}

