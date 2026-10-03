"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Folder, FolderPlus, Pencil, Plus, Trash2 } from "lucide-react";
import { BlockEditor } from "./block-editor";
import type { RichTextBlock, WorkspaceDoc } from "@/types/database";

interface DocsFolderHubProps {
  folder: WorkspaceDoc;
  title: string;
  onTitleChange: (newTitle: string) => void;
  blocks: RichTextBlock[];
  onBlocksChange: (newBlocks: RichTextBlock[]) => void;
  onCreateFile: (folderId: string) => void;
  onCreateSubfolder: (folderId: string) => void;
  onOpenRename: (folder: WorkspaceDoc) => void;
  onDeleteFolder: (folder: WorkspaceDoc) => void;
  onSelectDoc: (docId: string) => void;
  onRenameDoc: (doc: WorkspaceDoc) => void;
  dw: {
    untitledFolder: string;
    untitled: string;
    newFile: string;
    rename: string;
    deleteFolder: string;
    folderEmpty: string;
  };
}

export function DocsFolderHub({
  folder,
  title,
  onTitleChange,
  blocks,
  onBlocksChange,
  onCreateFile,
  onCreateSubfolder,
  onOpenRename,
  onDeleteFolder,
  onSelectDoc,
  onRenameDoc,
  dw,
}: DocsFolderHubProps) {
  const folderColor = folder.color || "#3b82f6";
  const childCount = folder.children?.length || 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Folder Header Bar */}
      <div className="h-12 border-b border-border/60 px-6 flex items-center justify-between gap-4 shrink-0 bg-background/80 backdrop-blur">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Folder className="h-4 w-4 shrink-0" style={{ color: folderColor }} />
          <span className="font-semibold text-foreground truncate max-w-xs">{title || dw.untitledFolder}</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-medium">
            Folder
          </Badge>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1 shadow-xs"
            onClick={() => onCreateFile(folder.id)}
          >
            <Plus className="h-3.5 w-3.5 text-primary" />
            <span>{dw.newFile}</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
            onClick={() => onOpenRename(folder)}
          >
            <Pencil className="h-3.5 w-3.5" />
            <span>{dw.rename}</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => onDeleteFolder(folder)}
            title={dw.deleteFolder}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Folder Content Area */}
      <div className="flex-1 overflow-y-auto px-6 sm:px-12 py-8 max-w-4xl mx-auto w-full space-y-6">
        {/* Title Header */}
        <div className="flex items-start gap-4 pb-2 border-b border-border/50">
          <div
            className="h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 shadow-xs"
            style={{ backgroundColor: `${folderColor}20` }}
          >
            <Folder className="h-7 w-7" style={{ color: folderColor }} />
          </div>
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder={dw.untitledFolder}
              className="w-full text-2xl sm:text-3xl font-extrabold tracking-tight bg-transparent border-0 outline-none text-foreground placeholder:text-muted-foreground/40"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {childCount === 1 ? "1 item" : `${childCount} items`} inside this folder
            </p>

        {/* Contained Items Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Folder Contents
            </h4>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px] gap-1 text-primary hover:bg-primary/10"
                onClick={() => onCreateFile(folder.id)}
              >
                <Plus className="h-3 w-3" /> Add Note / File
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px] gap-1 text-amber-500 hover:bg-amber-500/10"
                onClick={() => onCreateSubfolder(folder.id)}
              >
                <FolderPlus className="h-3 w-3" /> Subfolder
              </Button>
            </div>
          </div>

          {childCount === 0 ? (
            <div className="p-8 text-center rounded-xl border border-dashed border-border/70 bg-muted/10 space-y-3">
              <Folder className="h-8 w-8 mx-auto text-muted-foreground/40" style={{ color: folderColor }} />
              <p className="text-xs text-muted-foreground">{dw.folderEmpty}</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5 shadow-xs"
                onClick={() => onCreateFile(folder.id)}
              >
                <Plus className="h-3.5 w-3.5 text-primary" />
                <span>Create Note in Folder</span>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {folder.children!.map((child) => (
                <div
                  key={child.id}
                  onClick={() => onSelectDoc(child.id)}
                  className="group flex items-start justify-between p-3.5 rounded-xl border border-border/70 bg-card hover:border-primary/40 hover:shadow-xs transition cursor-pointer"
                >
                  <div className="flex items-start gap-3 min-w-0 pr-2">
                    {child.doc_type === "folder" ? (
                      <Folder className="h-5 w-5 shrink-0 mt-0.5" style={{ color: child.color || "#3b82f6" }} />
                    ) : (
                      <span className="text-xl shrink-0 leading-none">{child.icon || "📄"}</span>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground group-hover:text-primary transition truncate">
                        {child.title || (child.doc_type === "folder" ? dw.untitledFolder : dw.untitled)}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {child.doc_type === "folder"
                          ? `${child.children?.length || 0} files`
                          : child.plain_text || "Empty note"}
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 p-0 text-muted-foreground hover:text-foreground shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRenameDoc(child);
                    }}
                    title={dw.rename}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Folder Overview & Notes */}
        <div className="pt-4 border-t border-border/50 space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Folder Overview & Notes
          </h4>
          <BlockEditor
            key={folder.id}
            blocks={blocks}
            onChange={onBlocksChange}
            readOnly={false}
            placeholder="Write folder notes, guidelines, or summaries..."
          />
        </div>
          </div>
        </div>
      </div>
    </div>
  );
}