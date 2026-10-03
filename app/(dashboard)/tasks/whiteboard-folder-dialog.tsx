"use client";

import { useState } from "react";
import { FolderPlus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FOLDER_COLOR_PRESETS } from "./whiteboard-types";
import { cn } from "@/lib/utils";

interface WhiteboardFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder?: { id: string; name: string; color?: string } | null;
  onSave: (name: string, color: string) => Promise<void>;
}

export function WhiteboardFolderDialog({
  open,
  onOpenChange,
  folder,
  onSave,
}: WhiteboardFolderDialogProps) {
  const isEditing = Boolean(folder);
  const [name, setName] = useState(folder?.name ?? "");
  const [color, setColor] = useState(folder?.color ?? FOLDER_COLOR_PRESETS[0]);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave(name.trim(), color);
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
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              {isEditing ? <Pencil className="h-4 w-4" /> : <FolderPlus className="h-4 w-4" />}
              <span>{isEditing ? "Rename Folder" : "New Folder"}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="folder-name" className="text-xs font-semibold">
                Folder Name
              </Label>
              <Input
                id="folder-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Marketing, UI Design, Sprint 14"
                className="h-9 text-sm"
                autoFocus
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Folder Color</Label>
              <div className="flex items-center gap-2">
                {FOLDER_COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={cn(
                      "h-6 w-6 rounded-full border border-black/10 transition-transform hover:scale-110",
                      color === c && "ring-2 ring-primary ring-offset-2 ring-offset-background scale-110"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving || !name.trim()}>
              {saving ? "Saving..." : isEditing ? "Save Changes" : "Create Folder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
