"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Folder, HardDrive } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkspaceDoc } from "@/types/database";

interface DocsMoveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: WorkspaceDoc | null;
  docs: WorkspaceDoc[];
  onMove: (docId: string, newParentId: string | null) => Promise<void>;
}

export function DocsMoveDialog({
  open,
  onOpenChange,
  doc,
  docs,
  onMove,
}: DocsMoveDialogProps) {
  const [selectedParentId, setSelectedParentId] = useState<string | null>(doc?.parent_id ?? null);
  const [saving, setSaving] = useState(false);

  // Extract all available folders in tree, excluding the doc itself and its descendants
  const getAvailableFolders = (list: WorkspaceDoc[], currentDocId: string): WorkspaceDoc[] => {
    const folders: WorkspaceDoc[] = [];
    const traverse = (items: WorkspaceDoc[]) => {
      for (const item of items) {
        if (item.id === currentDocId) continue;
        if (item.doc_type === "folder" || (item.children && item.children.length > 0)) {
          folders.push(item);
        }
        if (item.children && item.children.length > 0) {
          traverse(item.children);
        }
      }
    };
    traverse(list);
    return folders;
  };

  const availableFolders = doc ? getAvailableFolders(docs, doc.id) : [];

  const handleSave = async () => {
    if (!doc) return;
    setSaving(true);
    try {
      await onMove(doc.id, selectedParentId);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Move Document</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Select the destination folder for &ldquo;{doc?.title}&rdquo;.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5 py-3 max-h-64 overflow-y-auto pr-1">
          {/* Root Option */}
          <button
            type="button"
            onClick={() => setSelectedParentId(null)}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-left transition",
              selectedParentId === null
                ? "bg-primary/10 text-primary font-semibold border border-primary/30"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground border border-transparent"
            )}
          >
            <HardDrive className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span>Root Level (No Folder)</span>
          </button>

          {/* Folder Options */}
          {availableFolders.map((folder) => {
            const isSelected = selectedParentId === folder.id;
            return (
              <button
                key={folder.id}
                type="button"
                onClick={() => setSelectedParentId(folder.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-left transition",
                  isSelected
                    ? "bg-primary/10 text-primary font-semibold border border-primary/30"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground border border-transparent"
                )}
              >
                <Folder className="h-4 w-4 shrink-0" style={{ color: folder.color || "#3b82f6" }} />
                <span className="truncate">{folder.title}</span>
              </button>
            );
          })}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="text-xs font-semibold"
          >
            {saving ? "Moving..." : "Move Here"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}