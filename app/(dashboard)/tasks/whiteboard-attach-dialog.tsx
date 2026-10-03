"use client";

import { useState } from "react";
import { Check, CheckSquare, Link2, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TaskRow } from "@/lib/actions/tasks";
import { cn } from "@/lib/utils";

interface WhiteboardAttachDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: TaskRow[];
  currentTaskId?: string | null;
  onAttach: (taskId: string | null) => Promise<void>;
}

export function WhiteboardAttachDialog({
  open,
  onOpenChange,
  tasks,
  currentTaskId,
  onAttach,
}: WhiteboardAttachDialogProps) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(currentTaskId ?? null);
  const [saving, setSaving] = useState(false);

  const filteredTasks = tasks.filter((t) =>
    t.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      await onAttach(selectedId);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Link2 className="h-4 w-4 text-primary" />
            <span>Attach Whiteboard to Task</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Link this whiteboard canvas to a task so team members can access deliverables and ideas directly.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks..."
              className="h-8.5 pl-8 text-xs bg-background/50"
            />
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1 rounded-md border border-border/60 p-1">
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition text-left",
                selectedId === null
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "hover:bg-muted/60 text-muted-foreground"
              )}
            >
              <span className="italic">None (Detached / Standalone Canvas)</span>
              {selectedId === null && <Check className="h-3.5 w-3.5 text-primary" />}
            </button>

            {filteredTasks.map((task) => {
              const isSelected = selectedId === task.id;
              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => setSelectedId(task.id)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition text-left",
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "hover:bg-muted text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <CheckSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{task.title}</span>
                  </div>
                  {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                </button>
              );
            })}

            {filteredTasks.length === 0 && (
              <p className="text-center py-4 text-xs text-muted-foreground">No matching tasks found.</p>
            )}
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
          <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
