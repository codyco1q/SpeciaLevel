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
  FileText,
  Layout,
  Image as ImageIcon,
  FileDown,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createBrowserClient } from "@/lib/supabase/client";
import type { RichTextBlock, RichTextBlockType, WorkspaceDoc, WorkspaceWhiteboard } from "@/types/database";
import { BlockItem } from "./block-item";

interface BlockEditorProps {
  blocks: RichTextBlock[];
  onChange: (blocks: RichTextBlock[]) => void;
  readOnly?: boolean;
  placeholder?: string;
  availableDocs?: WorkspaceDoc[];
  availableWhiteboards?: WorkspaceWhiteboard[];
  onOpenDoc?: (docId: string) => void;
  onOpenWhiteboard?: (whiteboardId: string) => void;
}

const BLOCK_TYPES: {
  type: RichTextBlockType;
  label: string;
  category: "basic" | "embed";
  icon: any;
  description: string;
}[] = [
  { type: "paragraph", label: "Text", category: "basic", icon: Type, description: "Plain paragraph text" },
  { type: "heading1", label: "Heading 1", category: "basic", icon: Heading1, description: "Large section header" },
  { type: "heading2", label: "Heading 2", category: "basic", icon: Heading2, description: "Medium section header" },
  { type: "heading3", label: "Heading 3", category: "basic", icon: Heading3, description: "Small section header" },
  { type: "bulletList", label: "Bulleted list", category: "basic", icon: List, description: "Unordered bullet point" },
  { type: "numberedList", label: "Numbered list", category: "basic", icon: ListOrdered, description: "Sequential numbered item" },
  { type: "todoList", label: "To-do item", category: "basic", icon: CheckSquare, description: "Interactive task checklist" },
  { type: "quote", label: "Quote", category: "basic", icon: Quote, description: "Callout quote block" },
  { type: "code", label: "Code block", category: "basic", icon: Code, description: "Monospaced code snippet" },
  { type: "callout", label: "Callout box", category: "basic", icon: AlertCircle, description: "Highlighted notice box" },
  { type: "divider", label: "Divider", category: "basic", icon: Minus, description: "Visual horizontal divider" },
  { type: "doc_link", label: "Link Document Page", category: "embed", icon: FileText, description: "Interactive workspace document link" },
  { type: "whiteboard_link", label: "Embed Whiteboard", category: "embed", icon: Layout, description: "Interactive visual whiteboard canvas" },
  { type: "image", label: "Image", category: "embed", icon: ImageIcon, description: "Upload or embed image preview" },
  { type: "file", label: "File Attachment", category: "embed", icon: FileDown, description: "Downloadable file attachment" },
];

function generateId(): string {
  return "b_" + Math.random().toString(36).substring(2, 9);
}

export function BlockEditor({
  blocks = [],
  onChange,
  readOnly = false,
  placeholder = "Type '/' for block menu or start writing...",
  availableDocs = [],
  availableWhiteboards = [],
  onOpenDoc,
  onOpenWhiteboard,
}: BlockEditorProps) {
  const [internalBlocks, setInternalBlocks] = useState<RichTextBlock[]>(() => {
    if (blocks && blocks.length > 0) return blocks;
    return [{ id: generateId(), type: "paragraph", content: "" }];
  });

  const [slashMenuIndex, setSlashMenuIndex] = useState<number | null>(null);
  const [slashFilter, setSlashFilter] = useState("");
  const [paletteIndex, setPaletteIndex] = useState<number | null>(null);
  const [palettePosition, setPalettePosition] = useState<{ top: number; left: number } | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const paletteRef = useRef<HTMLDivElement>(null);
  const isInternalUpdateRef = useRef(false);

  useEffect(() => {
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false;
      return;
    }
    if (blocks && blocks.length > 0) {
      setInternalBlocks(blocks);
    }
  }, [blocks]);

  useEffect(() => {
    if (slashMenuIndex === null && paletteIndex === null) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setSlashMenuIndex(null);
      }
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) {
        setPaletteIndex(null);
        setPalettePosition(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [slashMenuIndex, paletteIndex]);

  const updateParent = (next: RichTextBlock[]) => {
    isInternalUpdateRef.current = true;
    setInternalBlocks(next);
    onChange(next);
  };

  const handleFileUpload = async (
    file: File
  ): Promise<{ url: string; fileName: string; fileSize?: number } | null> => {
    try {
      const supabase = createBrowserClient();
      const ext = file.name.split(".").pop() || "bin";
      const filePath = `doc_uploads/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;

      const { data, error } = await supabase.storage
        .from("project_assets")
        .upload(filePath, file, { cacheControl: "3600", upsert: false });

      if (error) {
        console.warn("[block-editor] Storage upload fallback:", error.message);
        return {
          url: URL.createObjectURL(file),
          fileName: file.name,
          fileSize: file.size,
        };
      }

      const { data: publicUrlData } = supabase.storage
        .from("project_assets")
        .getPublicUrl(data.path);

      return {
        url: publicUrlData.publicUrl,
        fileName: file.name,
        fileSize: file.size,
      };
    } catch (err) {
      console.error("[block-editor] Upload failed:", err);
      return {
        url: URL.createObjectURL(file),
        fileName: file.name,
        fileSize: file.size,
      };
    }
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

  const handleMetaChange = (
    index: number,
    meta: Record<string, any>,
    extra?: Partial<RichTextBlock>
  ) => {
    const next = [...internalBlocks];
    next[index] = {
      ...next[index],
      meta: { ...(next[index].meta || {}), ...meta },
      ...extra,
    };
    updateParent(next);
  };

  const handleCheckToggle = (index: number) => {
    const next = [...internalBlocks];
    next[index] = { ...next[index], checked: !next[index].checked };
    updateParent(next);
  };

  const handleAddBlock = (
    afterIndex: number,
    type: RichTextBlockType = "paragraph",
    meta?: Record<string, any>
  ) => {
    const newBlock: RichTextBlock = {
      id: generateId(),
      type,
      content: "",
      checked: type === "todoList" ? false : undefined,
      meta,
    };
    const next = [
      ...internalBlocks.slice(0, afterIndex + 1),
      newBlock,
      ...internalBlocks.slice(afterIndex + 1),
    ];
    updateParent(next);
    setSlashMenuIndex(null);
    setPaletteIndex(null);
    setPalettePosition(null);
  };

  const handleDeleteBlock = (index: number) => {
    if (internalBlocks.length <= 1) {
      updateParent([{ id: generateId(), type: "paragraph", content: "" }]);
      return;
    }
    const next = internalBlocks.filter((_, i) => i !== index);
    updateParent(next);
    setSlashMenuIndex(null);
    setPaletteIndex(null);
  };

  const handleChangeType = (
    index: number,
    type: RichTextBlockType,
    meta?: Record<string, any>
  ) => {
    const next = [...internalBlocks];
    let content = next[index].content ?? "";
    if (content.startsWith("/")) content = "";
    next[index] = {
      ...next[index],
      type,
      content,
      checked: type === "todoList" ? false : undefined,
      meta: meta ? { ...(next[index].meta || {}), ...meta } : next[index].meta,
    };
    updateParent(next);
    setSlashMenuIndex(null);
    setPaletteIndex(null);
    setPalettePosition(null);
  };

  const handleDuplicateBlock = (index: number) => {
    const target = internalBlocks[index];
    const duplicated: RichTextBlock = {
      ...target,
      id: generateId(),
    };
    const next = [
      ...internalBlocks.slice(0, index + 1),
      duplicated,
      ...internalBlocks.slice(index + 1),
    ];
    updateParent(next);
  };

  const handleMoveBlock = (sourceIdx: number, targetIdx: number) => {
    if (targetIdx < 0 || targetIdx >= internalBlocks.length) return;
    const next = [...internalBlocks];
    const [moved] = next.splice(sourceIdx, 1);
    next.splice(targetIdx, 0, moved);
    updateParent(next);
  };

  // Drag and Drop
  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = (e: React.DragEvent, index: number) => {
    if (dragOverIndex === index) {
      setDragOverIndex(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    handleMoveBlock(dragIndex, targetIndex);
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleOpenPalette = (index: number, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPalettePosition({
      top: rect.bottom + 4,
      left: rect.left,
    });
    setPaletteIndex(index);
    setSlashFilter("");
  };

  const filteredMenuItems = BLOCK_TYPES.filter(
    (b) =>
      b.label.toLowerCase().includes(slashFilter) ||
      b.type.toLowerCase().includes(slashFilter) ||
      b.description.toLowerCase().includes(slashFilter)
  );

  return (
    <div className="relative space-y-1 py-1">
      {internalBlocks.map((block, index) => {
        const isSlashOpen = slashMenuIndex === index;

        return (
          <div key={block.id || index} className="relative">
            <BlockItem
              block={block}
              index={index}
              readOnly={readOnly}
              placeholder={placeholder}
              availableDocs={availableDocs}
              availableWhiteboards={availableWhiteboards}
              onContentChange={handleBlockChange}
              onMetaChange={handleMetaChange}
              onCheckToggle={handleCheckToggle}
              onAddBlock={handleAddBlock}
              onDeleteBlock={handleDeleteBlock}
              onChangeType={handleChangeType}
              onDuplicateBlock={handleDuplicateBlock}
              onMoveBlock={handleMoveBlock}
              onOpenPalette={handleOpenPalette}
              onOpenDoc={onOpenDoc}
              onOpenWhiteboard={onOpenWhiteboard}
              onUploadFile={handleFileUpload}
              isDragging={dragIndex === index}
              isDragOver={dragOverIndex === index}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
            />

            {/* Slash Command Popover */}
            {isSlashOpen && !readOnly && (
              <div
                ref={menuRef}
                className="absolute left-6 top-8 z-50 w-72 rounded-xl border border-border bg-popover/95 p-1.5 shadow-2xl backdrop-blur animate-in fade-in zoom-in-95 duration-100"
              >
                <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                  <span>Insert Block</span>
                  <Sparkles className="size-3 text-primary" />
                </div>
                <div className="max-h-64 overflow-y-auto space-y-0.5 pr-0.5">
                  {filteredMenuItems.length === 0 ? (
                    <p className="px-2 py-2 text-xs text-muted-foreground">
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
                          className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted"
                        >
                          <div className="flex h-6 w-6 items-center justify-center rounded border border-border bg-background shrink-0">
                            <Icon className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">{item.label}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{item.description}</p>
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

      {/* Floating (+) Insert Popover */}
      {paletteIndex !== null && !readOnly && (
        <div
          ref={paletteRef}
          style={{
            position: "fixed",
            top: palettePosition ? Math.min(palettePosition.top, window.innerHeight - 340) : 200,
            left: palettePosition ? Math.min(palettePosition.left, window.innerWidth - 300) : 100,
          }}
          className="z-50 w-72 rounded-xl border border-border bg-popover/95 p-1.5 shadow-2xl backdrop-blur animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between border-b border-border/50 pb-1.5 mb-1">
            <span>Insert Block Below</span>
            <Plus className="size-3 text-primary" />
          </div>
          <div className="max-h-64 overflow-y-auto space-y-0.5 pr-0.5">
            {BLOCK_TYPES.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => handleAddBlock(paletteIndex, item.type)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded border border-border bg-background shrink-0">
                    <Icon className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{item.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

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
