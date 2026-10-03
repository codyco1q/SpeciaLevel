"use client";

import { useState } from "react";
import {
  ChevronRight,
  Folder,
  FolderPlus,
  Link2,
  MoreVertical,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Copy,
  Pencil,
  FolderInput,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { WorkspaceWhiteboard, WorkspaceWhiteboardFolder } from "@/types/database";

interface WhiteboardSidebarProps {
  boards: WorkspaceWhiteboard[];
  folders: WorkspaceWhiteboardFolder[];
  activeBoardId: string | null;
  selectedFolderId: string;
  onSelectFolder: (folderId: string) => void;
  onSelectBoard: (boardId: string) => void;
  onCreateBoard: (folderId?: string) => void;
  onRenameBoard: (board: WorkspaceWhiteboard) => void;
  onDuplicateBoard: (boardId: string) => void;
  onMoveBoard: (board: WorkspaceWhiteboard, folderId: string | null) => void;
  onAttachBoard: (board: WorkspaceWhiteboard) => void;
  onDeleteBoard: (boardId: string) => void;
  onCreateFolder: () => void;
  onEditFolder: (folder: WorkspaceWhiteboardFolder) => void;
  onDeleteFolder: (folderId: string) => void;
}

export function WhiteboardSidebar({
  boards,
  folders,
  activeBoardId,
  selectedFolderId,
  onSelectFolder,
  onSelectBoard,
  onCreateBoard,
  onRenameBoard,
  onDuplicateBoard,
  onMoveBoard,
  onAttachBoard,
  onDeleteBoard,
  onCreateFolder,
  onEditFolder,
  onDeleteFolder,
}: WhiteboardSidebarProps) {
  const [search, setSearch] = useState("");

  const filteredBoards = boards.filter((b) => {
    const matchesSearch = b.name.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (selectedFolderId === "all") return true;
    if (selectedFolderId === "unorganized") return !b.folder_id;
    return b.folder_id === selectedFolderId;
  });

  const getFolderCount = (folderId: string | null) => {
    if (folderId === null) return boards.filter((b) => !b.folder_id).length;
    return boards.filter((b) => b.folder_id === folderId).length;
  };

  return (
    <div className="w-64 h-full border-r border-border/60 bg-muted/20 flex flex-col shrink-0 select-none overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-border/60 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span>Whiteboards</span>
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px] h-4">
              {boards.length}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={onCreateFolder}
              title="New Folder"
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="default"
              size="icon"
              className="h-6 w-6 shadow-xs"
              onClick={() => onCreateBoard(selectedFolderId !== "all" && selectedFolderId !== "unorganized" ? selectedFolderId : undefined)}
              title="New Whiteboard"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter boards..."
            className="h-7 pl-7.5 text-xs bg-background/60"
          />
        </div>
      </div>

      {/* Folders & Boards List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {/* Folders Navigation */}
        <div className="space-y-0.5">
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
            Folders
          </div>

          <button
            type="button"
            onClick={() => onSelectFolder("all")}
            className={cn(
              "w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition",
              selectedFolderId === "all"
                ? "bg-primary/10 text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>All Whiteboards</span>
            </div>
            <span className="text-[10px] text-muted-foreground">{boards.length}</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectFolder("unorganized")}
            className={cn(
              "w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition",
              selectedFolderId === "unorganized"
                ? "bg-primary/10 text-primary font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <div className="flex items-center gap-2">
              <Folder className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Unorganized</span>
            </div>
            <span className="text-[10px] text-muted-foreground">{getFolderCount(null)}</span>
          </button>

          {folders.map((folder) => {
            const isSelected = selectedFolderId === folder.id;
            return (
              <div
                key={folder.id}
                className={cn(
                  "group flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition cursor-pointer",
                  isSelected
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
                onClick={() => onSelectFolder(folder.id)}
              >
                <div className="flex items-center gap-2 min-w-0 pr-1">
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: folder.color || "#64748b" }}
                  />
                  <span className="truncate">{folder.name}</span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] text-muted-foreground group-hover:hidden">
                    {getFolderCount(folder.id)}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 opacity-0 group-hover:opacity-100 p-0 text-muted-foreground hover:text-foreground"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40 text-xs">
                      <DropdownMenuItem onClick={() => onCreateBoard(folder.id)}>
                        <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Canvas
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEditFolder(folder)}>
                        <Pencil className="h-3.5 w-3.5 mr-1.5" /> Rename Folder
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onDeleteFolder(folder.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete Folder
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>

        {/* Canvases List */}
        <div className="space-y-0.5 pt-2 border-t border-border/50">
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
            Canvases ({filteredBoards.length})
          </div>

          {filteredBoards.map((board) => {
            const isActive = activeBoardId === board.id;
            const elementCount = Array.isArray(board.elements_json) ? board.elements_json.length : 0;
            return (
              <div
                key={board.id}
                onClick={() => onSelectBoard(board.id)}
                className={cn(
                  "group relative flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium cursor-pointer transition border",
                  isActive
                    ? "bg-primary/10 border-primary/40 shadow-xs text-foreground font-semibold"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                <div className="flex items-center gap-2 min-w-0 pr-1">
                  <Sparkles className={cn("h-3.5 w-3.5 shrink-0", isActive ? "text-primary" : "text-muted-foreground/60")} />
                  <div className="min-w-0">
                    <p className="truncate leading-tight text-xs">{board.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-muted-foreground font-normal">
                        {elementCount === 1 ? "1 element" : `${elementCount} elements`}
                      </span>
                      {board.task_id && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-primary/80 font-normal">
                          <Link2 className="h-2.5 w-2.5" /> Linked
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {isActive && (
                    <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0 animate-pulse" />
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 p-0 text-muted-foreground hover:text-foreground"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 text-xs">
                      <DropdownMenuItem onClick={() => onRenameBoard(board)}>
                        <Pencil className="h-3.5 w-3.5 mr-1.5" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onDuplicateBoard(board.id)}>
                        <Copy className="h-3.5 w-3.5 mr-1.5" /> Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onAttachBoard(board)}>
                        <Link2 className="h-3.5 w-3.5 mr-1.5" /> Attach to Task
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <div className="px-2 py-1 text-[10px] text-muted-foreground font-semibold">Move to Folder:</div>
                      <DropdownMenuItem onClick={() => onMoveBoard(board, null)}>
                        <FolderInput className="h-3.5 w-3.5 mr-1.5" /> None (Unorganized)
                      </DropdownMenuItem>
                      {folders.map((f) => (
                        <DropdownMenuItem key={f.id} onClick={() => onMoveBoard(board, f.id)}>
                          <span className="h-2 w-2 rounded-full mr-2 shrink-0" style={{ backgroundColor: f.color }} />
                          <span className="truncate">{f.name}</span>
                        </DropdownMenuItem>
                      ))}
                      {boards.length > 1 && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => onDeleteBoard(board.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete Canvas
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}

          {filteredBoards.length === 0 && (
            <p className="text-center py-6 text-xs text-muted-foreground">No whiteboards found.</p>
          )}
        </div>
      </div>
    </div>
  );
}
