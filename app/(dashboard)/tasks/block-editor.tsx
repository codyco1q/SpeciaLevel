"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckSquare,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Minus,
  Plus,
  Quote,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RichTextBlock } from "@/types/database";
import { BlockItem } from "./block-item";

interface BlockEditorProps {
  blocks: RichTextBlock[];
  onChange: (blocks: RichTextBlock[]) => void;
  readOnly?: boolean;
  placeholder?: string;
}

const BLOCK_TYPES: {
  type: RichTextBlock["type"];
  label: string;
  icon: typeof Type;
  description: string;
}[] = [
  { type: "paragraph", label: "Text", icon: Type, description: "Plain paragraph text" },
  { type: "heading1", label: "Heading 1", icon: Heading1, description: "Large section header" },
  { type: "heading2", label: "Heading 2", icon: Heading2, description: "Medium section header" },
  { type: "heading3", label: "Heading 3", icon: Heading3, description: "Small section header" },
  { type: "bulletList", label: "Bulleted list", icon: List, description: "Unordered bullet point" },
  { type: "numberedList", label: "Numbered list", icon: ListOrdered, description: "Sequential numbered item" },
  { type: "todoList", label: "To-do item", icon: CheckSquare, description: "Interactive task checklist" },
  { type: "quote", label: "Quote", icon: Quote, description: "Callout quote block" },
  { type: "code", label: "Code block", icon: Code, description: "Monospaced code snippet" },
  { type: "callout", label: "Callout box", icon: AlertCircle, description: "Highlighted notice box" },
  { type: "divider", label: "Divider", icon: Minus, description: "Visual horizontal divider" },
];

function generateId(): string {
  return "b_" + Math.random().toString(36).substring(2, 9);
}

export function BlockEditor({
  blocks = [],
  onChange,
  readOnly = false,
  placeholder = "Type '/' for block menu or start writing...",
}: BlockEditorProps) {
  const [internalBlocks, setInternalBlocks] = useState<RichTextBlock[]>(() => {
    if (blocks && blocks.length > 0) return blocks;
    return [{ id: generateId(), type: "paragraph", content: "" }];
  });

  const [slashMenuIndex, setSlashMenuIndex] = useState<number | null>(null);
  const [slashFilter, setSlashFilter] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (blocks && blocks.length > 0) {
      setInternalBlocks(blocks);
    }
  }, [blocks]);

  useEffect(() => {
    if (slashMenuIndex === null) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setSlashMenuIndex(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [slashMenuIndex]);

  const updateParent = (next: RichTextBlock[]) => {
    setInternalBlocks(next);
    onChange(next);
  };

  const handleBlockChange = (index: number, content: string) => {
    const next = [...internalBlocks];
    next[index] = { ...next[index], content };

    if (content.startsWith("/")) {
      setSlashMenuIndex(index);
      setSlashFilter(content.slice(1).toLowerCase());
    } else if (slashMenuIndex === index) {
      setSlashMenuIndex(null);
    }

    updateParent(next);
  };

  const handleCheckToggle = (index: number) => {
    const next = [...internalBlocks];
    next[index] = { ...next[index], checked: !next[index].checked };
    updateParent(next);
  };

  const handleAddBlock = (afterIndex: number, type: RichTextBlock["type"] = "paragraph") => {
    const newBlock: RichTextBlock = {
      id: generateId(),
      type,
      content: "",
      checked: type === "todoList" ? false : undefined,
    };
    const next = [
      ...internalBlocks.slice(0, afterIndex + 1),
      newBlock,
      ...internalBlocks.slice(afterIndex + 1),
    ];
    updateParent(next);
    setSlashMenuIndex(null);
  };

  const handleDeleteBlock = (index: number) => {
    if (internalBlocks.length <= 1) {
      updateParent([{ id: generateId(), type: "paragraph", content: "" }]);
      return;
    }
    const next = internalBlocks.filter((_, i) => i !== index);
    updateParent(next);
    setSlashMenuIndex(null);
  };

  const handleChangeType = (index: number, type: RichTextBlock["type"]) => {
    const next = [...internalBlocks];
    let content = next[index].content;
    if (content.startsWith("/")) content = "";
    next[index] = {
      ...next[index],
      type,
      content,
      checked: type === "todoList" ? false : undefined,
    };
    updateParent(next);
    setSlashMenuIndex(null);
  };

  const filteredMenuItems = BLOCK_TYPES.filter(
    (b) =>
      b.label.toLowerCase().includes(slashFilter) ||
      b.type.toLowerCase().includes(slashFilter) ||
      b.description.toLowerCase().includes(slashFilter)
  );

  return (
    <div className="relative space-y-1.5 py-1">
      {internalBlocks.map((block, index) => {
        const isSlashOpen = slashMenuIndex === index;

        return (
          <div key={block.id || index} className="relative">
            <BlockItem
              block={block}
              index={index}
              readOnly={readOnly}
              placeholder={placeholder}
              onContentChange={handleBlockChange}
              onCheckToggle={handleCheckToggle}
              onAddBlock={handleAddBlock}
              onDeleteBlock={handleDeleteBlock}
            />

            {isSlashOpen && !readOnly && (
              <div
                ref={menuRef}
                className="absolute left-6 top-8 z-50 w-64 rounded-lg border border-border bg-popover p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-100"
              >
                <p className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Basic Blocks
                </p>
                <div className="max-h-56 overflow-y-auto space-y-0.5">
                  {filteredMenuItems.length === 0 ? (
                    <p className="px-2 py-1.5 text-xs text-muted-foreground">
                      No matching blocks
                    </p>
                  ) : (
                    filteredMenuItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.type}
                          type="button"
                          onClick={() => handleChangeType(index, item.type)}
                          className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted"
                        >
                          <div className="flex h-6 w-6 items-center justify-center rounded border border-border bg-background">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{item.label}</p>
                            <p className="text-[10px] text-muted-foreground">{item.description}</p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {!readOnly && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => handleAddBlock(internalBlocks.length - 1, "paragraph")}
          className="mt-1 h-7 text-xs text-muted-foreground hover:text-foreground"
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add block
        </Button>
      )}
    </div>
  );
}
