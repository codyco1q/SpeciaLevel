"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { WorkspaceDoc } from "@/types/database";

export const FOLDER_COLORS = [
  { name: "Blue", value: "#3b82f6" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Emerald", value: "#10b981" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Rose", value: "#f43f5e" },
  { name: "Purple", value: "#a855f7" },
  { name: "Slate", value: "#64748b" },
  { name: "Pink", value: "#ec4899" },
];

interface DocsFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder?: WorkspaceDoc | null;
  parentId?: string | null;
  onSave: (name: string, color: string, folderId?: string, parentId?: string | null) => Promise<void>;
}

export function DocsFolderDialog({
  open,
  onOpenChange,
  folder,
  parentId,
  onSave,
}: DocsFolderDialogProps) {
  const isEditing = Boolean(folder);
  const [name, setName] = useState(folder?.title ?? "");
  const [color, setColor] = useState(folder?.color || FOLDER_COLORS[0].value);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (folder) {
      setName(folder.title);
      setColor(folder.color || FOLDER_COLORS[0].value);
    } else {
      setName("");
      setColor(FOLDER_COLORS[0].value);
    }
  }, [folder, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      await onSave(name.trim(), color, folder?.id, parentId);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {isEditing ? "Rename Folder" : "New Folder"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {isEditing
                ? "Update folder name and color badge."
                : "Create a folder to organize notes, specifications, and documents."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="folder-name" className="text-xs font-medium">
                Folder Name
              </Label>
              <Input
                id="folder-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Product Specs, Marketing, Engineering..."
                className="h-8.5 text-xs"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Folder Color</Label>
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                {FOLDER_COLORS.map((c) => {
                  const isSelected = color === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setColor(c.value)}
                      className={cn(
                        "h-6 w-6 rounded-full transition-transform flex items-center justify-center",
                        isSelected ? "scale-110 ring-2 ring-primary ring-offset-2 ring-offset-background" : "hover:scale-105 opacity-80"
                      )}
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                    />
                  );
                })}
              </div>
            </div>
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
              type="submit"
              size="sm"
              disabled={saving || !name.trim()}
              className="text-xs font-semibold"
            >
              {saving ? "Saving..." : isEditing ? "Save Changes" : "Create Folder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}