"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  BookOpen,
  ChevronRight,
  Clock,
  Copy,
  FileText,
  Folder,
  FolderInput,
  FolderPlus,
  HardDrive,
  LoaderCircle,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
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
import { BlockEditor } from "./block-editor";
import { blocksToPlainText } from "./task-meta";
import {
  createDoc,
  createDocFolder,
  deleteDoc,
  duplicateDoc,
  moveDoc,
  renameDoc,
  updateDoc,
} from "@/lib/actions/tasks-powerhouse";
import type { RichTextBlock, WorkspaceDoc, WorkspaceWhiteboard } from "@/types/database";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";
import { DocsFolderDialog } from "./docs-folder-dialog";
import { DocsMoveDialog } from "./docs-move-dialog";
import { DocsFolderHub } from "./docs-folder-hub";
import { cn } from "@/lib/utils";

const DOC_ICONS = ["📄", "📝", "💡", "🚀", "🎯", "📌", "✨", "📚", "⚡", "🔥", "🛠️", "📊", "📋", "🎨", "🏷️", "💼"];

interface DocsWorkspaceProps {
  initialDocs: WorkspaceDoc[];
  initialWhiteboards?: WorkspaceWhiteboard[];
  platform: Dictionary["platform"];
  locale: Locale;
  onOpenWhiteboard?: (whiteboardId: string) => void;
}

export function DocsWorkspace({
  initialDocs,
  initialWhiteboards = [],
  platform,
  locale,
  onOpenWhiteboard,
}: DocsWorkspaceProps) {
  const t = platform.tasks;
  const dw = t.docsWorkspace || {
    allDocs: "Notes & Docs",
    newPage: "New Page",
    newFolder: "New Folder",
    newFile: "New File",
    addSubpage: "Add Subpage",
    searchDocs: "Search notes & docs...",
    untitled: "Untitled Document",
    untitledFolder: "New Folder",
    rename: "Rename",
    renameFolder: "Rename Folder",
    renameFile: "Rename File",
    deleteDoc: "Delete Page",
    deleteFolder: "Delete Folder",
    deleteDocConfirm: "Are you sure you want to delete this document?",
    deleteFolderConfirm: "Are you sure you want to delete this folder and its contents?",
    duplicate: "Duplicate",
    moveToFolder: "Move to Folder",
    folderEmpty: "This folder has no files yet.",
    lastUpdated: "Last edited",
    emptyWorkspace: "No documents yet. Create your first page or folder to start taking rich notes.",
  };

  const [docs, setDocs] = useState<WorkspaceDoc[]>(initialDocs);
  const [activeDocId, setActiveDocId] = useState<string | null>(
    initialDocs.length > 0 ? initialDocs[0].id : null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [showIconPicker, setShowIconPicker] = useState(false);

  // Drag and Drop state
  const [draggingDocId, setDraggingDocId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [dragOverRoot, setDragOverRoot] = useState(false);

  // Dialog states
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [editingFolderDoc, setEditingFolderDoc] = useState<WorkspaceDoc | null>(null);
  const [folderParentId, setFolderParentId] = useState<string | null>(null);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [movingDoc, setMovingDoc] = useState<WorkspaceDoc | null>(null);

  // Active Doc local edit state
  const activeDoc = useMemo(() => {
    function findDoc(list: WorkspaceDoc[], id: string): WorkspaceDoc | null {
      for (const d of list) {
        if (d.id === id) return d;
        if (d.children?.length) {
          const found = findDoc(d.children, id);
          if (found) return found;
        }
      }
      return null;
    }
    return activeDocId ? findDoc(docs, activeDocId) : null;
  }, [docs, activeDocId]);

  // Breadcrumbs calculation
  const breadcrumbTrail = useMemo(() => {
    if (!activeDocId) return [];
    const trail: WorkspaceDoc[] = [];

    function findTrail(list: WorkspaceDoc[], targetId: string): boolean {
      for (const d of list) {
        if (d.id === targetId) {
          trail.unshift(d);
          return true;
        }
        if (d.children?.length) {
          if (findTrail(d.children, targetId)) {
            trail.unshift(d);
            return true;
          }
        }
      }
      return false;
    }

    findTrail(docs, activeDocId);
    return trail;
  }, [docs, activeDocId]);

  const [title, setTitle] = useState(activeDoc?.title ?? "");
  const [icon, setIcon] = useState(activeDoc?.icon ?? (activeDoc?.doc_type === "folder" ? "📁" : "📄"));
  const [blocks, setBlocks] = useState<RichTextBlock[]>(activeDoc?.blocks_json ?? []);

  const currentDocIdRef = useRef<string | null>(activeDocId);
  const pendingSaveRef = useRef<{
    id: string;
    title: string;
    icon: string;
    blocks: RichTextBlock[];
  } | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const savedStatusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setDocs(initialDocs);
  }, [initialDocs]);

  // Sync state only when actively switching to a different document
  useEffect(() => {
    if (!activeDocId) {
      currentDocIdRef.current = null;
      return;
    }

    if (activeDocId !== currentDocIdRef.current) {
      // Flush previous pending save immediately before switching
      if (pendingSaveRef.current && saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        const { id, title: t, icon: ic, blocks: bl } = pendingSaveRef.current;
        pendingSaveRef.current = null;
        void updateDoc(id, {
          title: t.trim() || dw.untitled,
          icon: ic,
          blocksJson: bl,
          plainText: blocksToPlainText(bl),
        });
      }

      currentDocIdRef.current = activeDocId;
      if (activeDoc) {
        setTitle(activeDoc.title || dw.untitled);
        setIcon(activeDoc.icon || (activeDoc.doc_type === "folder" ? "📁" : "📄"));
        setBlocks(
          activeDoc.blocks_json && activeDoc.blocks_json.length > 0
            ? activeDoc.blocks_json
            : activeDoc.doc_type === "folder"
            ? []
            : [{ id: "b_1", type: "paragraph", content: "" }]
        );
      }
      setSaveStatus("idle");
    }
  }, [activeDocId, activeDoc, dw.untitled]);

  // Clean up timers on unmount and flush pending save
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (savedStatusTimeoutRef.current) clearTimeout(savedStatusTimeoutRef.current);
      if (pendingSaveRef.current) {
        const { id, title: t, icon: ic, blocks: bl } = pendingSaveRef.current;
        void updateDoc(id, {
          title: t.trim() || dw.untitled,
          icon: ic,
          blocksJson: bl,
          plainText: blocksToPlainText(bl),
        });
      }
    };
  }, [dw.untitled]);

  // Smooth, relaxed debounced auto-save (1500ms)
  const triggerSave = (newTitle: string, newIcon: string, newBlocks: RichTextBlock[]) => {
    if (!activeDocId) return;

    pendingSaveRef.current = {
      id: activeDocId,
      title: newTitle,
      icon: newIcon,
      blocks: newBlocks,
    };

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (savedStatusTimeoutRef.current) clearTimeout(savedStatusTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      if (!pendingSaveRef.current) return;
      const targetDocId = pendingSaveRef.current.id;
      const saveTitle = pendingSaveRef.current.title;
      const saveIcon = pendingSaveRef.current.icon;
      const saveBlocks = pendingSaveRef.current.blocks;
      pendingSaveRef.current = null;

      setSaveStatus("saving");
      const plainText = blocksToPlainText(saveBlocks);
      const res = await updateDoc(targetDocId, {
        title: saveTitle.trim() || dw.untitled,
        icon: saveIcon,
        blocksJson: saveBlocks,
        plainText,
      });

      if (res.status === "success") {
        setSaveStatus("saved");
        setDocs((prev) => {
          function updateInTree(list: WorkspaceDoc[]): WorkspaceDoc[] {
            return list.map((doc) => {
              if (doc.id === targetDocId) {
                return {
                  ...doc,
                  title: saveTitle.trim() || dw.untitled,
                  icon: saveIcon,
                  blocks_json: saveBlocks,
                  plain_text: plainText,
                  updated_at: new Date().toISOString(),
                };
              }
              if (doc.children?.length) {
                return { ...doc, children: updateInTree(doc.children) };
              }
              return doc;
            });
          }
          return updateInTree(prev);
        });

        savedStatusTimeoutRef.current = setTimeout(() => {
          setSaveStatus("idle");
        }, 2500);
      } else {
        setSaveStatus("idle");
      }
    }, 1500);
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    triggerSave(newTitle, icon, blocks);
  };

  const handleIconSelect = (newIcon: string) => {
    setIcon(newIcon);
    setShowIconPicker(false);
    triggerSave(title, newIcon, blocks);
  };

  const handleBlocksChange = (newBlocks: RichTextBlock[]) => {
    setBlocks(newBlocks);
    triggerSave(title, icon, newBlocks);
  };

  // Folder & File CRUD
  const handleOpenNewFolder = (parentId: string | null = null) => {
    setEditingFolderDoc(null);
    setFolderParentId(parentId);
    setFolderDialogOpen(true);
  };

  const handleOpenRenameFolder = (folderDoc: WorkspaceDoc) => {
    setEditingFolderDoc(folderDoc);
    setFolderParentId(folderDoc.parent_id);
    setFolderDialogOpen(true);
  };

  const handleSaveFolder = async (name: string, color: string, folderId?: string, parentId?: string | null) => {
    if (folderId) {
      const res = await updateDoc(folderId, { title: name, color });
      if (res.status === "success") {
        setDocs((prev) => {
          function updateInTree(list: WorkspaceDoc[]): WorkspaceDoc[] {
            return list.map((d) => {
              if (d.id === folderId) {
                return { ...d, title: name, color, updated_at: new Date().toISOString() };
              }
              if (d.children?.length) return { ...d, children: updateInTree(d.children) };
              return d;
            });
          }
          return updateInTree(prev);
        });
        if (activeDocId === folderId) setTitle(name);
      }
    } else {
      const res = await createDocFolder(name, parentId, color);
      if (res.status === "success" && res.id) {
        const newFolderObj: WorkspaceDoc = {
          id: res.id,
          organization_id: "",
          title: name,
          icon: "📁",
          doc_type: "folder",
          color,
          blocks_json: [],
          plain_text: "",
          parent_id: parentId || null,
          order_index: 0,
          created_by: null,
          updated_at: new Date().toISOString(),
          children: [],
        };

        if (parentId) {
          setDocs((prev) => {
            function appendChild(list: WorkspaceDoc[]): WorkspaceDoc[] {
              return list.map((d) => {
                if (d.id === parentId) {
                  return { ...d, children: [...(d.children || []), newFolderObj] };
                }
                if (d.children?.length) return { ...d, children: appendChild(d.children) };
                return d;
              });
            }
            return appendChild(prev);
          });
          setCollapsedFolders((prev) => ({ ...prev, [parentId]: false }));
        } else {
          setDocs((prev) => [newFolderObj, ...prev]);
        }

        setActiveDocId(res.id);
      }
    }
  };

  const handleCreatePage = (parentId: string | null = null, docType: "doc" | "folder" = "doc") => {
    startTransition(async () => {
      const defaultTitle = docType === "folder" ? dw.untitledFolder : dw.untitled;
      const res = await createDoc(defaultTitle, parentId, docType === "folder" ? "📁" : "📄", docType);
      if (res.status === "success" && res.id) {
        const newDocObj: WorkspaceDoc = {
          id: res.id,
          organization_id: "",
          title: defaultTitle,
          icon: docType === "folder" ? "📁" : "📄",
          doc_type: docType,
          color: docType === "folder" ? "#3b82f6" : null,
          blocks_json:
            docType === "folder"
              ? []
              : [
                  { id: "b_1", type: "heading1", content: defaultTitle },
                  { id: "b_2", type: "paragraph", content: "" },
                ],
          plain_text: defaultTitle,
          parent_id: parentId,
          order_index: 0,
          created_by: null,
          updated_at: new Date().toISOString(),
          children: [],
        };

        if (parentId) {
          setDocs((prev) => {
            function appendChild(list: WorkspaceDoc[]): WorkspaceDoc[] {
              return list.map((d) => {
                if (d.id === parentId) {
                  return { ...d, children: [...(d.children || []), newDocObj] };
                }
                if (d.children?.length) {
                  return { ...d, children: appendChild(d.children) };
                }
                return d;
              });
            }
            return appendChild(prev);
          });
          setCollapsedFolders((prev) => ({ ...prev, [parentId]: false }));
        } else {
          setDocs((prev) => [newDocObj, ...prev]);
        }

        setActiveDocId(res.id);
      }
    });
  };

  const handleRenamePrompt = (doc: WorkspaceDoc) => {
    const raw = window.prompt("Enter new name:", doc.title);
    if (!raw || raw.trim() === "" || raw === doc.title) return;
    const trimmed = raw.trim();

    startTransition(async () => {
      const res = await renameDoc(doc.id, trimmed);
      if (res.status === "success") {
        setDocs((prev) => {
          function updateInTree(list: WorkspaceDoc[]): WorkspaceDoc[] {
            return list.map((d) => {
              if (d.id === doc.id) return { ...d, title: trimmed, updated_at: new Date().toISOString() };
              if (d.children?.length) return { ...d, children: updateInTree(d.children) };
              return d;
            });
          }
          return updateInTree(prev);
        });
        if (activeDocId === doc.id) setTitle(trimmed);
      }
    });
  };

  const handleDuplicate = (docId: string) => {
    startTransition(async () => {
      const res = await duplicateDoc(docId);
      if (res.status === "success" && res.id) {
        const { getWorkspaceDocs } = await import("@/lib/actions/tasks-powerhouse");
        const refreshed = await getWorkspaceDocs();
        if (refreshed) setDocs(refreshed);
        setActiveDocId(res.id);
      }
    });
  };

  const handleMove = async (docId: string, newParentId: string | null) => {
    const res = await moveDoc(docId, newParentId);
    if (res.status === "success") {
      setDocs((prev) => {
        let movedItem: WorkspaceDoc | null = null;

        function extractItem(list: WorkspaceDoc[]): WorkspaceDoc[] {
          const result: WorkspaceDoc[] = [];
          for (const d of list) {
            if (d.id === docId) {
              movedItem = { ...d, parent_id: newParentId };
            } else {
              result.push({
                ...d,
                children: d.children ? extractItem(d.children) : [],
              });
            }
          }
          return result;
        }

        const listWithoutItem = extractItem(prev);
        if (!movedItem) return prev;

        if (newParentId === null) {
          return [...listWithoutItem, movedItem];
        }

        function insertIntoParent(list: WorkspaceDoc[]): WorkspaceDoc[] {
          return list.map((d) => {
            if (d.id === newParentId) {
              return { ...d, children: [...(d.children || []), movedItem!] };
            }
            if (d.children?.length) {
              return { ...d, children: insertIntoParent(d.children) };
            }
            return d;
          });
        }

        return insertIntoParent(listWithoutItem);
      });

      if (newParentId) {
        setCollapsedFolders((prev) => ({ ...prev, [newParentId]: false }));
      }
    }
  };

  const handleDelete = (doc: WorkspaceDoc) => {
    const isFolder = doc.doc_type === "folder";
    const confirmMsg = isFolder ? dw.deleteFolderConfirm : dw.deleteDocConfirm;
    if (!window.confirm(confirmMsg)) return;

    startTransition(async () => {
      const res = await deleteDoc(doc.id);
      if (res.status === "success") {
        setDocs((prev) => {
          function removeFromTree(list: WorkspaceDoc[]): WorkspaceDoc[] {
            return list
              .filter((d) => d.id !== doc.id)
              .map((d) => ({
                ...d,
                children: d.children ? removeFromTree(d.children) : [],
              }));
          }
          return removeFromTree(prev);
        });

        if (activeDocId === doc.id) {
          setActiveDocId(null);
        }
      }
    });
  };

  const toggleFolderCollapse = (folderId: string) => {
    setCollapsedFolders((prev) => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  const filteredDocs = useMemo(() => {
    if (!searchQuery.trim()) return docs;
    const q = searchQuery.toLowerCase();

    function filterTree(list: WorkspaceDoc[]): WorkspaceDoc[] {
      const result: WorkspaceDoc[] = [];
      for (const d of list) {
        const matches = d.title.toLowerCase().includes(q) || d.plain_text.toLowerCase().includes(q);
        const filteredChildren = d.children ? filterTree(d.children) : [];
        if (matches || filteredChildren.length > 0) {
          result.push({ ...d, children: filteredChildren });
        }
      }
      return result;
    }

    return filterTree(docs);
  }, [docs, searchQuery]);

  // Sidebar tree item renderer
  const renderDocItem = (doc: WorkspaceDoc, depth = 0) => {
    const isActive = doc.id === activeDocId;
    const isFolder = doc.doc_type === "folder";
    const isCollapsed = collapsedFolders[doc.id] ?? false;
    const hasChildren = doc.children && doc.children.length > 0;
    const isTargetFolder = dragOverFolderId === doc.id;
    const isBeingDragged = draggingDocId === doc.id;

    return (
      <div key={doc.id} className="space-y-0.5 select-none">
        <div
          draggable={true}
          onDragStart={(e) => {
            e.dataTransfer.setData(
              "application/json",
              JSON.stringify({ docId: doc.id, isFolder })
            );
            e.dataTransfer.setData("text/plain", doc.id);
            e.dataTransfer.effectAllowed = "move";
            setDraggingDocId(doc.id);
          }}
          onDragEnd={() => {
            setDraggingDocId(null);
            setDragOverFolderId(null);
            setDragOverRoot(false);
          }}
          onDragOver={(e) => {
            if (isFolder) {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (dragOverFolderId !== doc.id) {
                setDragOverFolderId(doc.id);
              }
            }
          }}
          onDragEnter={(e) => {
            if (isFolder) {
              e.preventDefault();
              setDragOverFolderId(doc.id);
            }
          }}
          onDragLeave={(e) => {
            if (isFolder) {
              if (e.currentTarget.contains(e.relatedTarget as Node)) return;
              if (dragOverFolderId === doc.id) {
                setDragOverFolderId(null);
              }
            }
          }}
          onDrop={(e) => {
            if (!isFolder) return;
            e.preventDefault();
            e.stopPropagation();
            setDragOverFolderId(null);
            setDraggingDocId(null);

            let droppedDocId = draggingDocId;
            if (!droppedDocId) {
              try {
                const payload = JSON.parse(
                  e.dataTransfer.getData("application/json") || "{}"
                );
                droppedDocId = payload.docId;
              } catch {
                droppedDocId = e.dataTransfer.getData("text/plain");
              }
            }
            if (!droppedDocId || droppedDocId === doc.id) return;
            handleMove(droppedDocId, doc.id);
          }}
          className={cn(
            "group flex items-center justify-between rounded-lg px-2 py-1.5 text-xs font-medium cursor-pointer transition border border-transparent",
            isActive
              ? "bg-primary/10 border-primary/30 text-primary font-semibold shadow-xs"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            isTargetFolder &&
              "ring-2 ring-primary bg-primary/20 text-primary border-primary/50 shadow-inner scale-[1.01]",
            isBeingDragged && "opacity-40 scale-[0.98] border-dashed border-primary/40"
          )}
          style={{ paddingLeft: `${Math.max(8, depth * 14 + 8)}px` }}
          onClick={() => setActiveDocId(doc.id)}
        >
          <div className="flex items-center gap-1.5 min-w-0 truncate">
            {isFolder ? (
              <button
                type="button"
                className="p-0.5 text-muted-foreground hover:text-foreground rounded shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFolderCollapse(doc.id);
                }}
              >
                <ChevronRight
                  className={cn(
                    "h-3.5 w-3.5 transition-transform text-muted-foreground/70",
                    !isCollapsed && hasChildren && "rotate-90"
                  )}
                />
              </button>
            ) : null}

            {isFolder ? (
              <Folder className="h-3.5 w-3.5 shrink-0" style={{ color: doc.color || "#3b82f6" }} />
            ) : (
              <span className="text-sm shrink-0 leading-none">{doc.icon || "📄"}</span>
            )}

            <span className="truncate">{doc.title || (isFolder ? dw.untitledFolder : dw.untitled)}</span>
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            {isFolder && hasChildren && (
              <span className="text-[10px] text-muted-foreground group-hover:hidden px-1">
                {doc.children!.length}
              </span>
            )}

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
              <DropdownMenuContent align="end" className="w-44 text-xs">
                {isFolder ? (
                  <>
                    <DropdownMenuItem onClick={() => handleCreatePage(doc.id, "doc")}>
                      <Plus className="h-3.5 w-3.5 mr-1.5 text-primary" /> {dw.newFile}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleOpenNewFolder(doc.id)}>
                      <FolderPlus className="h-3.5 w-3.5 mr-1.5 text-amber-500" /> New Subfolder
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleOpenRenameFolder(doc)}>
                      <Pencil className="h-3.5 w-3.5 mr-1.5" /> {dw.renameFolder}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setMovingDoc(doc);
                        setMoveDialogOpen(true);
                      }}
                    >
                      <FolderInput className="h-3.5 w-3.5 mr-1.5" /> {dw.moveToFolder}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleDelete(doc)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" /> {dw.deleteFolder}
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem onClick={() => handleCreatePage(doc.id, "doc")}>
                      <Plus className="h-3.5 w-3.5 mr-1.5" /> {dw.addSubpage}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleRenamePrompt(doc)}>
                      <Pencil className="h-3.5 w-3.5 mr-1.5" /> {dw.rename}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDuplicate(doc.id)}>
                      <Copy className="h-3.5 w-3.5 mr-1.5" /> {dw.duplicate}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setMovingDoc(doc);
                        setMoveDialogOpen(true);
                      }}
                    >
                      <FolderInput className="h-3.5 w-3.5 mr-1.5" /> {dw.moveToFolder}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleDelete(doc)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" /> {dw.deleteDoc}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {hasChildren && !isCollapsed && (
          <div className="space-y-0.5">
            {doc.children!.map((child) => renderDocItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-[calc(100vh-14rem)] min-h-[550px] rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      {/* Sidebar Tree */}
      <div className="w-64 sm:w-72 border-r border-border/70 bg-muted/20 flex flex-col shrink-0">
        {/* Header */}
        <div className="p-3 border-b border-border/60 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
              <BookOpen className="h-3.5 w-3.5 text-blue-500" />
              <span>{dw.allDocs}</span>
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] h-4">
                {docs.length}
              </Badge>
            </div>

            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={() => handleOpenNewFolder(null)}
                title={dw.newFolder}
              >
                <FolderPlus className="h-3.5 w-3.5 text-amber-500" />
              </Button>
              <Button
                type="button"
                variant="default"
                size="icon"
                className="h-6 w-6 shadow-xs"
                onClick={() => handleCreatePage(null, "doc")}
                title={dw.newPage}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={dw.searchDocs}
              className="h-7 pl-7.5 text-xs bg-background/60"
            />
          </div>
        </div>

        {/* Tree List */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            if (!dragOverRoot) setDragOverRoot(true);
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragOverRoot(true);
          }}
          onDragLeave={(e) => {
            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
            setDragOverRoot(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragOverRoot(false);
            setDraggingDocId(null);

            let droppedDocId = draggingDocId;
            if (!droppedDocId) {
              try {
                const payload = JSON.parse(
                  e.dataTransfer.getData("application/json") || "{}"
                );
                droppedDocId = payload.docId;
              } catch {
                droppedDocId = e.dataTransfer.getData("text/plain");
              }
            }
            if (!droppedDocId) return;
            handleMove(droppedDocId, null);
          }}
          className={cn(
            "flex-1 overflow-y-auto p-2 space-y-0.5 transition-colors",
            dragOverRoot && "bg-primary/5 ring-1 ring-inset ring-primary/40 rounded-lg"
          )}
        >
          {filteredDocs.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              {dw.emptyWorkspace}
            </div>
          ) : (
            filteredDocs.map((doc) => renderDocItem(doc, 0))
          )}
        </div>
      </div>

      {/* Main Center Area: Folder Hub or Document Editor */}
      <div className="flex-1 flex flex-col bg-background/50 overflow-hidden">
        {activeDoc ? (
          activeDoc.doc_type === "folder" ? (
            <DocsFolderHub
              folder={activeDoc}
              title={title}
              onTitleChange={handleTitleChange}
              blocks={blocks}
              onBlocksChange={handleBlocksChange}
              onCreateFile={(folderId) => handleCreatePage(folderId, "doc")}
              onCreateSubfolder={(folderId) => handleOpenNewFolder(folderId)}
              onOpenRename={handleOpenRenameFolder}
              onDeleteFolder={handleDelete}
              onSelectDoc={(docId) => setActiveDocId(docId)}
              onRenameDoc={handleRenamePrompt}
              onMoveDoc={handleMove}
              dw={{
                untitledFolder: dw.untitledFolder,
                untitled: dw.untitled,
                newFile: dw.newFile,
                rename: dw.rename,
                deleteFolder: dw.deleteFolder,
                folderEmpty: dw.folderEmpty,
              }}
            />
          ) : (
            // Document Editor
            <>
              {/* File Top Bar */}
              <div className="h-12 border-b border-border/60 px-6 flex items-center justify-between gap-4 shrink-0 bg-background/80 backdrop-blur">
                {/* Breadcrumbs */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0 overflow-hidden truncate">
                  {breadcrumbTrail.map((crumb, idx) => (
                    <div key={crumb.id} className="flex items-center gap-1.5 min-w-0 truncate">
                      {idx > 0 && <span className="text-muted-foreground/40 font-mono">/</span>}
                      <button
                        type="button"
                        onClick={() => setActiveDocId(crumb.id)}
                        className={cn(
                          "truncate hover:text-foreground transition",
                          crumb.id === activeDocId ? "font-semibold text-foreground" : "text-muted-foreground"
                        )}
                      >
                        {crumb.title || (crumb.doc_type === "folder" ? dw.untitledFolder : dw.untitled)}
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {saveStatus === "saving" && (
                      <span className="flex items-center gap-1 text-primary font-medium">
                        <LoaderCircle className="h-3 w-3 animate-spin" /> Saving...
                      </span>
                    )}
                    {saveStatus === "saved" && <span className="text-emerald-500 font-medium">Saved</span>}
                  </span>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44 text-xs">
                      <DropdownMenuItem onClick={() => handleRenamePrompt(activeDoc)}>
                        <Pencil className="h-3.5 w-3.5 mr-1.5" /> {dw.rename}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicate(activeDoc.id)}>
                        <Copy className="h-3.5 w-3.5 mr-1.5" /> {dw.duplicate}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setMovingDoc(activeDoc);
                          setMoveDialogOpen(true);
                        }}
                      >
                        <FolderInput className="h-3.5 w-3.5 mr-1.5" /> {dw.moveToFolder}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDelete(activeDoc)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" /> {dw.deleteDoc}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

            <div className="flex-1 overflow-y-auto px-6 sm:px-12 py-8 max-w-4xl mx-auto w-full space-y-6">
              <div className="space-y-3">
                <div className="relative inline-block">
                  <button
                    type="button"
                    onClick={() => setShowIconPicker(!showIconPicker)}
                    className="text-4xl hover:scale-110 transition p-1 rounded-lg hover:bg-muted/50 select-none"
                    title="Change icon"
                  >
                    {icon}
                  </button>

                  {showIconPicker && (
                    <div className="absolute top-12 left-0 z-50 p-2 rounded-xl border border-border bg-popover shadow-xl grid grid-cols-6 gap-1 w-56">
                      {DOC_ICONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          className="h-8 w-8 text-xl flex items-center justify-center rounded hover:bg-muted"
                          onClick={() => handleIconSelect(emoji)}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <input
                  type="text"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder={dw.untitled}
                  className="w-full text-3xl sm:text-4xl font-extrabold tracking-tight bg-transparent border-0 outline-none text-foreground placeholder:text-muted-foreground/40"
                />
              </div>

              <div className="pt-2">
                <BlockEditor
                  key={activeDocId}
                  blocks={blocks}
                  onChange={handleBlocksChange}
                  readOnly={false}
                  placeholder="Type '/' for commands or start writing notes..."
                  availableDocs={docs}
                  availableWhiteboards={initialWhiteboards}
                  onOpenDoc={(docId) => setActiveDocId(docId)}
                  onOpenWhiteboard={onOpenWhiteboard}
                />
              </div>
            </div>
          </>
        )) : (
          // ================= EMPTY STATE =================
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4 text-muted-foreground">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
              <BookOpen className="h-7 w-7" />
            </div>
            <div className="space-y-1 max-w-sm">
              <h3 className="text-base font-semibold text-foreground">No Document Selected</h3>
              <p className="text-xs text-muted-foreground">{dw.emptyWorkspace}</p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Button
                type="button"
                size="sm"
                onClick={() => handleCreatePage(null, "doc")}
                className="gap-1.5 text-xs font-semibold shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{dw.newPage}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleOpenNewFolder(null)}
                className="gap-1.5 text-xs shadow-xs"
              >
                <FolderPlus className="h-3.5 w-3.5 text-amber-500" />
                <span>{dw.newFolder}</span>
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <DocsFolderDialog
        open={folderDialogOpen}
        onOpenChange={setFolderDialogOpen}
        folder={editingFolderDoc}
        parentId={folderParentId}
        onSave={handleSaveFolder}
      />

      <DocsMoveDialog
        open={moveDialogOpen}
        onOpenChange={setMoveDialogOpen}
        doc={movingDoc}
        docs={docs}
        onMove={handleMove}
      />
    </div>
  );
}

