"use client";

import { useState, useRef } from "react";
import {
  AlertCircle,
  Plus,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Copy,
  FileText,
  Layout,
  Image as ImageIcon,
  FileDown,
  ExternalLink,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
  Minus,
  Sparkles,
  Search,
  UploadCloud,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RichTextBlock, RichTextBlockType, WorkspaceDoc, WorkspaceWhiteboard } from "@/types/database";

export interface BlockItemProps {
  block: RichTextBlock;
  index: number;
  readOnly?: boolean;
  placeholder?: string;
  availableDocs?: WorkspaceDoc[];
  availableWhiteboards?: WorkspaceWhiteboard[];
  onContentChange: (i: number, v: string) => void;
  onMetaChange?: (i: number, meta: Record<string, any>, extra?: Partial<RichTextBlock>) => void;
  onCheckToggle: (i: number) => void;
  onAddBlock: (i: number, t?: RichTextBlockType, meta?: Record<string, any>) => void;
  onDeleteBlock: (i: number) => void;
  onChangeType?: (i: number, t: RichTextBlockType, meta?: Record<string, any>) => void;
  onDuplicateBlock?: (i: number) => void;
  onMoveBlock?: (sourceIdx: number, targetIdx: number) => void;
  onOpenPalette?: (i: number, e: React.MouseEvent) => void;
  onOpenDoc?: (docId: string) => void;
  onOpenWhiteboard?: (whiteboardId: string) => void;
  onUploadFile?: (file: File) => Promise<{ url: string; fileName: string; fileSize?: number } | null>;
  isDragging?: boolean;
  isDragOver?: boolean;
  onDragStart?: (e: React.DragEvent, index: number) => void;
  onDragOver?: (e: React.DragEvent, index: number) => void;
  onDragLeave?: (e: React.DragEvent, index: number) => void;
  onDrop?: (e: React.DragEvent, index: number) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

export function BlockItem({
  block,
  index,
  readOnly = false,
  placeholder,
  availableDocs = [],
  availableWhiteboards = [],
  onContentChange,
  onMetaChange,
  onCheckToggle,
  onAddBlock,
  onDeleteBlock,
  onChangeType,
  onDuplicateBlock,
  onMoveBlock,
  onOpenPalette,
  onOpenDoc,
  onOpenWhiteboard,
  onUploadFile,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: BlockItemProps) {
  const [docPickerOpen, setDocPickerOpen] = useState(false);
  const [docSearch, setDocSearch] = useState("");
  const [boardPickerOpen, setBoardPickerOpen] = useState(false);
  const [boardSearch, setBoardSearch] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const b = "w-full bg-transparent placeholder:text-muted-foreground/50 focus:outline-none";

  const flattenDocs = (docsList: WorkspaceDoc[]): WorkspaceDoc[] => {
    const res: WorkspaceDoc[] = [];
    const traverse = (items: WorkspaceDoc[]) => {
      for (const item of items) {
        if (item.doc_type !== "folder") res.push(item);
        if (item.children?.length) traverse(item.children);
      }
    };
    traverse(docsList);
    return res;
  };

  const allFlatDocs = flattenDocs(availableDocs);
  const filteredDocs = allFlatDocs.filter((d) =>
    d.title.toLowerCase().includes(docSearch.toLowerCase())
  );
  const filteredBoards = availableWhiteboards.filter((w) =>
    w.name.toLowerCase().includes(boardSearch.toLowerCase())
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      if (onUploadFile) {
        const res = await onUploadFile(file);
        if (res && onMetaChange) {
          onMetaChange(
            index,
            { fileName: res.fileName, fileSize: res.fileSize, fileType: file.type },
            { url: res.url, content: res.fileName }
          );
        }
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          const url = reader.result as string;
          if (onMetaChange) {
            onMetaChange(
              index,
              { fileName: file.name, fileSize: file.size, fileType: file.type },
              { url, content: file.name }
            );
          }
        };
        reader.readAsDataURL(file);
      }
    } catch (err) {
      console.error("[block-item] upload error:", err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      draggable={!readOnly}
      onDragStart={(e) => onDragStart?.(e, index)}
      onDragOver={(e) => onDragOver?.(e, index)}
      onDragLeave={(e) => onDragLeave?.(e, index)}
      onDrop={(e) => onDrop?.(e, index)}
      onDragEnd={(e) => onDragEnd?.(e)}
      className={cn(
        "group relative flex items-start gap-1 rounded-lg px-1.5 py-1 hover:bg-muted/30 transition-all border border-transparent",
        isDragging && "opacity-40 bg-muted/50 border-dashed border-primary/40",
        isDragOver && "border-t-2 border-t-primary bg-primary/5"
      )}
    >
      {!readOnly && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pt-1 text-muted-foreground shrink-0 select-none">
          <button
            type="button"
            onClick={(e) => (onOpenPalette ? onOpenPalette(index, e) : onAddBlock(index))}
            className="rounded p-1 hover:bg-muted hover:text-foreground text-muted-foreground/70 transition-colors"
            title="Insert Block Below"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="rounded p-1 hover:bg-muted hover:text-foreground text-muted-foreground/70 cursor-grab active:cursor-grabbing transition-colors"
                title="Drag to reorder or click for block options"
              >
                <GripVertical className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52 text-xs">
              {onChangeType && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="gap-2 text-xs">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    <span>Turn into</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-48 text-xs">
                    <DropdownMenuItem onClick={() => onChangeType(index, "paragraph")}>
                      <span>Text (Paragraph)</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onChangeType(index, "heading1")}>
                      <Heading1 className="h-3.5 w-3.5 mr-1" />
                      <span>Heading 1</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onChangeType(index, "heading2")}>
                      <Heading2 className="h-3.5 w-3.5 mr-1" />
                      <span>Heading 2</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onChangeType(index, "heading3")}>
                      <Heading3 className="h-3.5 w-3.5 mr-1" />
                      <span>Heading 3</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onChangeType(index, "bulletList")}>
                      <List className="h-3.5 w-3.5 mr-1" />
                      <span>Bulleted List</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onChangeType(index, "numberedList")}>
                      <ListOrdered className="h-3.5 w-3.5 mr-1" />
                      <span>Numbered List</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onChangeType(index, "todoList")}>
                      <CheckSquare className="h-3.5 w-3.5 mr-1" />
                      <span>To-do List</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onChangeType(index, "quote")}>
                      <Quote className="h-3.5 w-3.5 mr-1" />
                      <span>Quote Callout</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onChangeType(index, "code")}>
                      <Code className="h-3.5 w-3.5 mr-1" />
                      <span>Code Snippet</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onChangeType(index, "callout")}>
                      <AlertCircle className="h-3.5 w-3.5 mr-1" />
                      <span>Callout Notice</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onChangeType(index, "divider")}>
                      <Minus className="h-3.5 w-3.5 mr-1" />
                      <span>Horizontal Divider</span>
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}

              {onDuplicateBlock && (
                <DropdownMenuItem onClick={() => onDuplicateBlock(index)} className="gap-2 text-xs">
                  <Copy className="h-3.5 w-3.5" />
                  <span>Duplicate</span>
                </DropdownMenuItem>
              )}

              {onMoveBlock && (
                <>
                  <DropdownMenuItem
                    onClick={() => onMoveBlock(index, index - 1)}
                    disabled={index === 0}
                    className="gap-2 text-xs"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                    <span>Move Up</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onMoveBlock(index, index + 1)}
                    className="gap-2 text-xs"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                    <span>Move Down</span>
                  </DropdownMenuItem>
                </>
              )}

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() => onDeleteBlock(index)}
                className="gap-2 text-xs text-destructive focus:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Block</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <div className="flex-1 min-w-0">
        {/* Headings */}
        {(block.type === "heading1" || block.type === "h1") && (
          <input
            type="text"
            disabled={readOnly}
            value={block.content || ""}
            placeholder="Heading 1"
            onChange={(e) => onContentChange(index, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAddBlock(index, "paragraph");
              }
            }}
            className={cn(b, "font-bold text-2xl tracking-tight text-foreground")}
          />
        )}

        {(block.type === "heading2" || block.type === "h2") && (
          <input
            type="text"
            disabled={readOnly}
            value={block.content || ""}
            placeholder="Heading 2"
            onChange={(e) => onContentChange(index, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAddBlock(index, "paragraph");
              }
            }}
            className={cn(b, "font-bold text-xl tracking-tight text-foreground")}
          />
        )}

        {(block.type === "heading3" || block.type === "h3") && (
          <input
            type="text"
            disabled={readOnly}
            value={block.content || ""}
            placeholder="Heading 3"
            onChange={(e) => onContentChange(index, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAddBlock(index, "paragraph");
              }
            }}
            className={cn(b, "font-semibold text-base text-foreground")}
          />
        )}

        {/* Paragraph */}
        {(block.type === "paragraph" || block.type === "p") && (
          <textarea
            disabled={readOnly}
            value={block.content || ""}
            placeholder={index === 0 ? placeholder : "Type '/' for commands..."}
            rows={1}
            onChange={(e) => {
              onContentChange(index, e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onAddBlock(index, "paragraph");
              }
            }}
            className={cn(b, "resize-none text-sm leading-relaxed text-foreground py-0.5")}
          />
        )}

        {/* Bullet List */}
        {(block.type === "bulletList" || block.type === "bullet") && (
          <div className="flex items-start gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground" />
            <input
              type="text"
              disabled={readOnly}
              value={block.content || ""}
              placeholder="List item..."
              onChange={(e) => onContentChange(index, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onAddBlock(index, "bulletList");
                }
              }}
              className={cn(b, "text-sm text-foreground py-0.5")}
            />
          </div>
        )}

        {/* Numbered List */}
        {block.type === "numberedList" && (
          <div className="flex items-start gap-2">
            <span className="mt-0.5 text-xs font-semibold text-muted-foreground w-4 text-right shrink-0">
              {index + 1}.
            </span>
            <input
              type="text"
              disabled={readOnly}
              value={block.content || ""}
              placeholder="Numbered item..."
              onChange={(e) => onContentChange(index, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onAddBlock(index, "numberedList");
                }
              }}
              className={cn(b, "text-sm text-foreground py-0.5")}
            />
          </div>
        )}

        {/* To-do List */}
        {(block.type === "todoList" || block.type === "todo") && (
          <div className="flex items-start gap-2.5">
            <input
              type="checkbox"
              checked={Boolean(block.checked)}
              onChange={() => onCheckToggle(index)}
              disabled={readOnly}
              className="mt-1 h-3.5 w-3.5 rounded border-border text-primary cursor-pointer accent-primary"
            />
            <input
              type="text"
              disabled={readOnly}
              value={block.content || ""}
              placeholder="To-do task..."
              onChange={(e) => onContentChange(index, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onAddBlock(index, "todoList");
                }
              }}
              className={cn(
                b,
                "text-sm text-foreground py-0.5",
                block.checked && "line-through text-muted-foreground/70"
              )}
            />
          </div>
        )}
        {/* Quote */}
        {block.type === "quote" && (
          <div className="border-l-2 border-primary/70 pl-3.5 py-0.5 my-1 italic text-muted-foreground">
            <textarea
              disabled={readOnly}
              value={block.content || ""}
              placeholder="Quote text..."
              rows={1}
              onChange={(e) => {
                onContentChange(index, e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              className={cn(b, "resize-none text-sm italic leading-relaxed text-foreground/90")}
            />
          </div>
        )}

        {/* Code Snippet */}
        {block.type === "code" && (
          <div className="rounded-lg bg-zinc-950 dark:bg-zinc-900/90 p-3 font-mono text-xs text-emerald-400 border border-border/40 shadow-xs my-1">
            <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-zinc-800 text-[10px] text-zinc-500 uppercase tracking-wider font-semibold select-none">
              <span>Code Block</span>
              <span>{block.language || "plaintext"}</span>
            </div>
            <textarea
              disabled={readOnly}
              value={block.content || ""}
              placeholder="// Paste or write code snippet..."
              rows={2}
              onChange={(e) => {
                onContentChange(index, e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              className={cn(b, "resize-none font-mono text-xs text-emerald-400 bg-transparent")}
            />
          </div>
        )}

        {/* Callout Box */}
        {block.type === "callout" && (
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-sm text-amber-900 dark:text-amber-200 my-1">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
            <textarea
              disabled={readOnly}
              value={block.content || ""}
              placeholder="Highlighted notice or tip..."
              rows={1}
              onChange={(e) => {
                onContentChange(index, e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              className={cn(b, "resize-none text-sm text-foreground leading-relaxed")}
            />
          </div>
        )}

        {/* Divider */}
        {block.type === "divider" && (
          <div className="my-3 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
        )}

        {/* Link Document Page */}
        {block.type === "doc_link" && (
          <div className="my-1.5">
            {block.meta?.docId ? (
              <div
                onClick={() => onOpenDoc?.(block.meta?.docId)}
                className="group/link flex items-center justify-between rounded-lg border border-border bg-card p-2.5 hover:border-primary/50 hover:bg-accent/40 transition-all cursor-pointer shadow-xs max-w-md"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="size-7 rounded-md bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                    <FileText className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {block.meta?.docTitle || block.content || "Linked Document"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Workspace Document Page</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 opacity-0 group-hover/link:opacity-100 transition-opacity">
                  {!readOnly && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDocPickerOpen(true);
                      }}
                      className="h-6 px-2 text-[10px]"
                    >
                      Change
                    </Button>
                  )}
                  <ExternalLink className="size-3.5 text-muted-foreground" />
                </div>
              </div>
            ) : (
              <Popover open={docPickerOpen} onOpenChange={setDocPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2 text-xs border-dashed text-muted-foreground hover:text-foreground h-8"
                  >
                    <FileText className="size-3.5 text-primary" />
                    <span>Select document page to link...</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-64 p-2">
                  <div className="relative mb-2">
                    <Search className="absolute left-2 top-2 size-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search workspace docs..."
                      value={docSearch}
                      onChange={(e) => setDocSearch(e.target.value)}
                      className="h-7 pl-7 text-xs"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                    {filteredDocs.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-2 text-center">No docs found</p>
                    ) : (
                      filteredDocs.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => {
                            onMetaChange?.(index, { docId: d.id, docTitle: d.title }, { content: d.title });
                            setDocPickerOpen(false);
                          }}
                          className="w-full flex items-center gap-2 p-1.5 text-xs text-foreground rounded hover:bg-muted text-left"
                        >
                          <FileText className="size-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{d.title || "Untitled Document"}</span>
                        </button>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        )}

        {/* Embed Whiteboard */}
        {block.type === "whiteboard_link" && (
          <div className="my-1.5">
            {block.meta?.whiteboardId ? (
              <div
                onClick={() => onOpenWhiteboard?.(block.meta?.whiteboardId)}
                className="group/board flex items-center justify-between rounded-lg border border-border bg-card p-2.5 hover:border-primary/50 hover:bg-accent/40 transition-all cursor-pointer shadow-xs max-w-md"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="size-7 rounded-md bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
                    <Layout className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {block.meta?.whiteboardTitle || block.content || "Embedded Whiteboard"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Interactive Visual Canvas</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 opacity-0 group-hover/board:opacity-100 transition-opacity">
                  {!readOnly && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setBoardPickerOpen(true);
                      }}
                      className="h-6 px-2 text-[10px]"
                    >
                      Change
                    </Button>
                  )}
                  <ExternalLink className="size-3.5 text-muted-foreground" />
                </div>
              </div>
            ) : (
              <Popover open={boardPickerOpen} onOpenChange={setBoardPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2 text-xs border-dashed text-muted-foreground hover:text-foreground h-8"
                  >
                    <Layout className="size-3.5 text-purple-500" />
                    <span>Select whiteboard to embed...</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-64 p-2">
                  <div className="relative mb-2">
                    <Search className="absolute left-2 top-2 size-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search whiteboards..."
                      value={boardSearch}
                      onChange={(e) => setBoardSearch(e.target.value)}
                      className="h-7 pl-7 text-xs"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                    {filteredBoards.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-2 text-center">No whiteboards found</p>
                    ) : (
                      filteredBoards.map((w) => (
                        <button
                          key={w.id}
                          type="button"
                          onClick={() => {
                            onMetaChange?.(index, { whiteboardId: w.id, whiteboardTitle: w.name }, { content: w.name });
                            setBoardPickerOpen(false);
                          }}
                          className="w-full flex items-center gap-2 p-1.5 text-xs text-foreground rounded hover:bg-muted text-left"
                        >
                          <Layout className="size-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{w.name || "Untitled Whiteboard"}</span>
                        </button>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        )}
        {/* Embedded Image */}
        {block.type === "image" && (
          <div className="my-2 space-y-1.5 max-w-xl">
            {block.url ? (
              <div className="relative group/img rounded-lg overflow-hidden border border-border bg-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={block.url}
                  alt={block.content || "Uploaded Image"}
                  className="w-full max-h-96 object-contain bg-zinc-950/20"
                />
                {!readOnly && (
                  <div className="absolute top-2 right-2 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center gap-1 bg-background/80 backdrop-blur rounded-md p-1 border border-border">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-1 hover:bg-muted rounded text-xs text-foreground"
                      title="Replace image"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteBlock(index)}
                      className="p-1 hover:bg-destructive/10 text-destructive rounded text-xs"
                      title="Remove image"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                )}
                <input
                  type="text"
                  disabled={readOnly}
                  value={block.content || ""}
                  placeholder="Image caption..."
                  onChange={(e) => onContentChange(index, e.target.value)}
                  className="w-full text-[11px] text-muted-foreground text-center bg-transparent border-t border-border px-2 py-1 focus:outline-none"
                />
              </div>
            ) : (
              <div
                onClick={() => !readOnly && fileInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 hover:bg-accent/30 transition-all cursor-pointer flex flex-col items-center justify-center gap-2"
              >
                <div className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <ImageIcon className="size-4" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-medium text-foreground">
                    {isUploading ? "Uploading image..." : "Upload an image"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">PNG, JPG, WEBP, GIF or SVG</p>
                </div>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        )}

        {/* Embedded File */}
        {block.type === "file" && (
          <div className="my-1.5 max-w-md">
            {block.url ? (
              <a
                href={block.url}
                target="_blank"
                rel="noreferrer"
                download={block.meta?.fileName || block.content}
                className="group/file flex items-center justify-between rounded-lg border border-border bg-card p-2.5 hover:border-primary/50 hover:bg-accent/40 transition-all shadow-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="size-7 rounded-md bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                    <FileDown className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {block.meta?.fileName || block.content || "Attached File"}
                    </p>
                    {block.meta?.fileSize && (
                      <p className="text-[10px] text-muted-foreground">
                        {(block.meta.fileSize / 1024).toFixed(1)} KB
                      </p>
                    )}
                  </div>
                </div>
                <FileDown className="size-3.5 text-muted-foreground group-hover/file:text-primary transition-colors" />
              </a>
            ) : (
              <div
                onClick={() => !readOnly && fileInputRef.current?.click()}
                className="border border-dashed border-border rounded-lg p-3 hover:border-primary/50 hover:bg-accent/30 transition-all cursor-pointer flex items-center gap-2.5 text-xs text-muted-foreground"
              >
                <UploadCloud className="size-4 text-primary" />
                <span>{isUploading ? "Uploading file..." : "Click to select a file to attach"}</span>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        )}
      </div>
    </div>
  );
}

