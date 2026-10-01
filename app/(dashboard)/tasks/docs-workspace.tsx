"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  FolderPlus,
  LoaderCircle,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BlockEditor } from "./block-editor";
import { blocksToPlainText } from "./task-meta";
import {
  createDoc,
  deleteDoc,
  updateDoc,
} from "@/lib/actions/tasks-powerhouse";
import type { RichTextBlock, WorkspaceDoc } from "@/types/database";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

const DOC_ICONS = ["📄", "📝", "💡", "🚀", "🎯", "📌", "✨", "📚", "⚡", "🔥", "🛠️", "📊"];

interface DocsWorkspaceProps {
  initialDocs: WorkspaceDoc[];
  platform: Dictionary["platform"];
  locale: Locale;
}

export function DocsWorkspace({
  initialDocs,
  platform,
}: DocsWorkspaceProps) {
  const t = platform.tasks;
  const dw = t.docsWorkspace || {
    allDocs: "Notes & Docs",
    newPage: "New Page",
    addSubpage: "Add Subpage",
    searchDocs: "Search notes & docs...",
    untitled: "Untitled Document",
    deleteDoc: "Delete Page",
    deleteDocConfirm: "Are you sure you want to delete this document?",
    lastUpdated: "Last edited",
    emptyWorkspace: "No documents yet. Create your first page to start taking rich notes.",
  };

  const [docs, setDocs] = useState<WorkspaceDoc[]>(initialDocs);
  const [activeDocId, setActiveDocId] = useState<string | null>(
    initialDocs.length > 0 ? initialDocs[0].id : null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [showIconPicker, setShowIconPicker] = useState(false);

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

  const [title, setTitle] = useState(activeDoc?.title ?? "");
  const [icon, setIcon] = useState(activeDoc?.icon ?? "📄");
  const [blocks, setBlocks] = useState<RichTextBlock[]>(activeDoc?.blocks_json ?? []);

  // Update local edit state when activeDocId switches
  useEffect(() => {
    if (activeDoc) {
      setTitle(activeDoc.title || dw.untitled);
      setIcon(activeDoc.icon || "📄");
      setBlocks(
        activeDoc.blocks_json && activeDoc.blocks_json.length > 0
          ? activeDoc.blocks_json
          : [{ id: "b_1", type: "paragraph", content: "" }]
      );
    }
  }, [activeDocId, activeDoc, dw.untitled]);

  // Debounced auto-save
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerSave = (newTitle: string, newIcon: string, newBlocks: RichTextBlock[]) => {
    if (!activeDocId) return;
    setSaveStatus("saving");

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      const plainText = blocksToPlainText(newBlocks);
      const res = await updateDoc(activeDocId, {
        title: newTitle.trim() || dw.untitled,
        icon: newIcon,
        blocksJson: newBlocks,
        plainText,
      });

      if (res.status === "success") {
        setSaveStatus("saved");
        // Update local state in tree
        setDocs((prev) => {
          function updateInTree(list: WorkspaceDoc[]): WorkspaceDoc[] {
            return list.map((doc) => {
              if (doc.id === activeDocId) {
                return {
                  ...doc,
                  title: newTitle.trim() || dw.untitled,
                  icon: newIcon,
                  blocks_json: newBlocks,
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
      } else {
        setSaveStatus("idle");
      }
    }, 800);
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

  const handleCreatePage = (parentId: string | null = null) => {
    startTransition(async () => {
      const res = await createDoc(dw.untitled, parentId);
      if (res.status === "success" && res.id) {
        const newDocObj: WorkspaceDoc = {
          id: res.id,
          organization_id: "",
          title: dw.untitled,
          icon: "📄",
          blocks_json: [
            { id: "b_1", type: "heading1", content: dw.untitled },
            { id: "b_2", type: "paragraph", content: "" },
          ],
          plain_text: dw.untitled,
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
        } else {
          setDocs((prev) => [newDocObj, ...prev]);
        }

        setActiveDocId(res.id);
      }
    });
  };

  const handleDeletePage = (docId: string) => {
    if (!window.confirm(dw.deleteDocConfirm)) return;

    startTransition(async () => {
      const res = await deleteDoc(docId);
      if (res.status === "success") {
        setDocs((prev) => {
          function removeFromTree(list: WorkspaceDoc[]): WorkspaceDoc[] {
            return list
              .filter((d) => d.id !== docId)
              .map((d) => ({
                ...d,
                children: d.children ? removeFromTree(d.children) : [],
              }));
          }
          return removeFromTree(prev);
        });

        if (activeDocId === docId) {
          setActiveDocId(null);
        }
      }
    });
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

  const renderDocItem = (doc: WorkspaceDoc, depth = 0) => {
    const isActive = doc.id === activeDocId;
    return (
      <div key={doc.id} className="space-y-0.5">
        <div
          className={`group flex items-center justify-between rounded-md px-2 py-1.5 text-sm cursor-pointer transition select-none ${
            isActive
              ? "bg-primary/10 text-primary font-medium"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          }`}
          style={{ paddingLeft: `${Math.max(8, depth * 14 + 8)}px` }}
          onClick={() => setActiveDocId(doc.id)}
        >
          <div className="flex items-center gap-2 min-w-0 truncate">
            <span className="text-base shrink-0">{doc.icon || "📄"}</span>
            <span className="truncate">{doc.title || dw.untitled}</span>
          </div>

          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0 transition">
            <button
              type="button"
              className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-background/80"
              title={dw.addSubpage}
              onClick={(e) => {
                e.stopPropagation();
                handleCreatePage(doc.id);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="p-1 text-muted-foreground hover:text-destructive rounded hover:bg-destructive/10"
              title={dw.deleteDoc}
              onClick={(e) => {
                e.stopPropagation();
                handleDeletePage(doc.id);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {doc.children && doc.children.length > 0 && (
          <div className="space-y-0.5">
            {doc.children.map((child) => renderDocItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-[calc(100vh-14rem)] min-h-[500px] rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      {/* Sidebar Tree */}
      <div className="w-64 sm:w-72 border-r border-border bg-muted/20 flex flex-col shrink-0">
        <div className="p-3 border-b border-border/60 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <BookOpen className="h-4 w-4 text-primary" />
            <span>{dw.allDocs}</span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs gap-1"
            onClick={() => handleCreatePage(null)}
            disabled={isPending}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{dw.newPage}</span>
          </Button>
        </div>

        <div className="p-2.5 border-b border-border/40">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={dw.searchDocs}
              className="h-8 pl-8 text-xs bg-background/50"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {filteredDocs.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              {dw.emptyWorkspace}
            </div>
          ) : (
            filteredDocs.map((doc) => renderDocItem(doc, 0))
          )}
        </div>
      </div>

      {/* Editor Center */}
      <div className="flex-1 flex flex-col bg-background/50 overflow-hidden">
        {activeDoc ? (
          <>
            <div className="h-12 border-b border-border/60 px-6 flex items-center justify-between gap-4 shrink-0 bg-background/80 backdrop-blur">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <FileText className="h-3.5 w-3.5 text-primary" />
                <span className="font-medium text-foreground truncate max-w-[200px] sm:max-w-xs">
                  {title || dw.untitled}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {saveStatus === "saving" && (
                    <span className="flex items-center gap-1 text-primary">
                      <LoaderCircle className="h-3 w-3 animate-spin" /> Saving...
                    </span>
                  )}
                  {saveStatus === "saved" && <span className="text-emerald-500">Saved</span>}
                </span>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDeletePage(activeDoc.id)}
                  title={dw.deleteDoc}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
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
                    <div className="absolute top-12 left-0 z-50 p-2 rounded-xl border border-border bg-popover shadow-xl grid grid-cols-6 gap-1 w-52">
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
                  blocks={blocks}
                  onChange={handleBlocksChange}
                  readOnly={false}
                  placeholder="Type '/' for commands or start writing notes..."
                />
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3 text-muted-foreground">
            <BookOpen className="h-12 w-12 text-muted-foreground/30 stroke-1" />
            <p className="text-sm font-medium">{dw.emptyWorkspace}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleCreatePage(null)}
              className="gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              {dw.newPage}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

