"use client";

import { useState } from "react";
import {
  CalendarDays,
  CheckSquare,
  LoaderCircle,
  Pencil,
  Trash2,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { deleteTask, type TaskRow } from "@/lib/actions/tasks";
import type { TaskStatus } from "@/types/database";
import {
  formatDueDate,
  TASK_PRIORITY_BADGE_CLASSES,
  TASK_STATUSES,
} from "./task-meta";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

interface TaskDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TaskRow | null;
  canManage: boolean;
  currentUserId: string;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onEditRequest: (task: TaskRow) => void;
  onDeleted: () => void;
  /** Localized copy + formatters for the current render. */
  platform: Dictionary["platform"];
  locale: Locale;
}

/**
 * Task overview modal: full details, status changes for the assignee/self,
 * and edit/delete for members with `tasks.manage`.
 */
export function TaskDetailDialog({
  open,
  onOpenChange,
  task,
  canManage,
  currentUserId,
  onStatusChange,
  onEditRequest,
  onDeleted,
  platform,
  locale,
}: TaskDetailDialogProps) {
  const t = platform.tasks;
  const common = platform.common;
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [statusPending, setStatusPending] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  if (!task) return null;

  const canChangeStatus = canManage || task.assignedTo?.id === currentUserId;

  async function handleStatusSelect(value: string) {
    if (!task || task.status === value) return;
    setStatusPending(true);
    setRequestError(null);
    try {
      await onStatusChange(task.id, value as TaskStatus);
    } finally {
      setStatusPending(false);
    }
  }

  async function handleDelete() {
    if (!task) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true); // two-step confirm
      return;
    }
    setDeleting(true);
    setRequestError(null);
    const result = await deleteTask(task.id);
    if (result.status === "error") {
      setRequestError(result.error ?? t.errors.deleteFailed);
      setDeleting(false);
      setConfirmingDelete(false);
      return;
    }
    onDeleted();
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setConfirmingDelete(false);
      setRequestError(null);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
            {task.title}
          </DialogTitle>
          <DialogDescription>
            {t.createdBy
              .replace("{date}", formatDueDate(task.createdAt, locale))
              .replace(
                "{name}",
                task.createdBy.fullName ?? task.createdBy.email ?? t.member
              )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border/70 bg-muted/30 p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t.tableStatus}</span>
              <div className="flex items-center gap-2">
                {statusPending && (
                  <LoaderCircle className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                {canChangeStatus ? (
                  <Select
                    value={task.status}
                    onValueChange={handleStatusSelect}
                    disabled={statusPending}
                  >
                    <SelectTrigger size="sm" className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {t.status[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="font-medium">
                    {t.status[task.status]}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t.tablePriority}</span>
              <Badge
                variant="outline"
                className={cn(
                  "px-1.5 py-0 text-[10px]",
                  TASK_PRIORITY_BADGE_CLASSES[task.priority]
                )}
              >
                {t.priority[task.priority]}
              </Badge>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t.tableAssignee}</span>
              <span className="flex items-center gap-1.5 font-medium">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                {task.assignedTo?.fullName ??
                  task.assignedTo?.email ??
                  t.unassigned}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t.tableDue}</span>
              <span className="flex items-center gap-1.5 font-medium">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                {task.dueDate ? formatDueDate(task.dueDate, locale) : t.noDueDate}
              </span>
            </div>
          </div>

          {task.description ? (
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t.descriptionLabel}
              </h4>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {task.description}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t.noDescription}</p>
          )}

          {requestError && (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {requestError}
            </p>
          )}
        </div>

        {canManage && (
          <DialogFooter>
            <Button
              type="button"
              variant={confirmingDelete ? "destructive" : "outline"}
              onClick={handleDelete}
              disabled={deleting || statusPending}
            >
              {deleting ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {confirmingDelete ? common.confirmDelete : common.delete}
            </Button>
            <Button
              type="button"
              onClick={() => {
                setConfirmingDelete(false);
                onEditRequest(task);
              }}
              disabled={deleting || statusPending}
            >
              <Pencil className="h-4 w-4" />
              {common.edit}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}