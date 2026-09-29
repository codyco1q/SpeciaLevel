"use client";

import {
  Heading1,
  Type,
  MousePointerClick,
  Image as ImageIcon,
  Minus,
  Maximize2,
  Sparkles,
} from "lucide-react";
import type { EmailBlockType, EmailBlock } from "@/types/database";

const PALETTE_ITEMS: {
  type: EmailBlockType;
  label: string;
  description: string;
  icon: any;
  defaultBlock: () => EmailBlock;
}[] = [
  {
    type: "header",
    label: "Heading",
    description: "Title or section headline",
    icon: Heading1,
    defaultBlock: () => ({
      id: "blk_" + Math.random().toString(36).slice(2, 9),
      type: "header",
      content: { text: "Heading Title", level: 1 },
      style: { textAlign: "left", fontSize: 24, textColor: "#0f172a" },
    }),
  },
  {
    type: "text",
    label: "Text Paragraph",
    description: "Formatted message body",
    icon: Type,
    defaultBlock: () => ({
      id: "blk_" + Math.random().toString(36).slice(2, 9),
      type: "text",
      content: { text: "Hi {{contact.name}},\n\nWrite your email message here." },
      style: { fontSize: 15, textColor: "#334155", textAlign: "left" },
    }),
  },
  {
    type: "button",
    label: "Button / CTA",
    description: "Call to action link button",
    icon: MousePointerClick,
    defaultBlock: () => ({
      id: "blk_" + Math.random().toString(36).slice(2, 9),
      type: "button",
      content: { buttonText: "Click Here", buttonUrl: "https://example.com" },
      style: { textAlign: "center", buttonColor: "#2563eb", buttonTextColor: "#ffffff", borderRadius: 6 },
    }),
  },
  {
    type: "image",
    label: "Image Visual",
    description: "Header banner or product image",
    icon: ImageIcon,
    defaultBlock: () => ({
      id: "blk_" + Math.random().toString(36).slice(2, 9),
      type: "image",
      content: {
        imageUrl: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=800&q=80",
        imageAlt: "Marketing Image",
        imageWidth: 560,
      },
      style: { textAlign: "center" },
    }),
  },
  {
    type: "divider",
    label: "Divider Line",
    description: "Subtle section separator",
    icon: Minus,
    defaultBlock: () => ({
      id: "blk_" + Math.random().toString(36).slice(2, 9),
      type: "divider",
      content: { dividerColor: "#e2e8f0" },
      style: { paddingTop: 16, paddingBottom: 16 },
    }),
  },
  {
    type: "spacer",
    label: "Vertical Space",
    description: "Empty spacing gap",
    icon: Maximize2,
    defaultBlock: () => ({
      id: "blk_" + Math.random().toString(36).slice(2, 9),
      type: "spacer",
      content: { spacerHeight: 24 },
    }),
  },
];

interface EmailBlockPaletteProps {
  onAddBlock: (block: EmailBlock) => void;
}

export function EmailBlockPalette({ onAddBlock }: EmailBlockPaletteProps) {
  return (
    <div className="w-64 border-r bg-card/50 p-4 flex flex-col gap-3 shrink-0">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
        <Sparkles className="size-3.5 text-primary" />
        <span>Add Blocks</span>
      </div>

      <div className="space-y-2">
        {PALETTE_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.type}
              type="button"
              onClick={() => onAddBlock(item.defaultBlock())}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-border/70 bg-card hover:bg-primary/5 hover:border-primary/50 text-left transition-all group"
            >
              <div className="size-8 rounded-lg bg-muted text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground flex items-center justify-center transition-colors shrink-0">
                <Icon className="size-4" />
              </div>
              <div className="min-w-0">
                <h5 className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                  {item.label}
                </h5>
                <p className="text-[11px] text-muted-foreground truncate">{item.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
