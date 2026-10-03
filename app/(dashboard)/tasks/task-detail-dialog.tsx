"use client";

import { useEffect, useState } from "react";
import {
  CalendarDays,
  CheckSquare,
  ExternalLink,
  LoaderCircle,
  Pencil,
  Plus,
  Sparkles,
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
import { deleteTask, updateTask, type TaskRow } from "@/lib/actions/tasks";
import { createWhiteboard, getTaskWhiteboards } from "@/lib/actions/tasks-powerhouse";
import type { RichTextBlock, TaskStage, TaskStatus, WorkspaceWhiteboard } from "@/types/database";
import {
  blocksToPlainText,
  formatDueDate,
  TASK_PRIORITY_BADGE_CLASSES,
  TASK_STATUSES,
} from "./task-meta";
import { AttachmentPanel } from "./attachment-panel";
import { BlockEditor } from "./block-editor";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

interface TaskDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TaskRow | null;
  canManage: boolean;
  /** Internal member with `tasks.view` — may upload attachments. */
  canUpload: boolean;
  currentUserId: string;
  organizationId: string;
  stages?: TaskStage[];
  whiteboards?: WorkspaceWhiteboard[];
  onStageChange?: (taskId: string, stageId: string) => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onEditRequest: (task: TaskRow) => void;
  onDeleted: () => void;
  onOpenWhiteboard?: (whiteboardId: string) => void;
  onWhiteboardCreated?: (board: WorkspaceWhiteboard) => void;
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
  canUpload,
  currentUserId,
  organizationId,
  stages = [],
  whiteboards = [],
  onStageChange,
  onStatusChange,
  onEditRequest,
  onDeleted,
  onOpenWhiteboard,
  onWhiteboardCreated,
  platform,
  locale,
}: TaskDetailDialogProps) {
  const t = platform.tasks;
  const common = platform.common;
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [statusPending, setStatusPending] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [descriptionBlocks, setDescriptionBlocks] = useState<RichTextBlock[]>(
    task?.descriptionJson ?? []
  );
  const [linkedBoards, setLinkedBoards] = useState<WorkspaceWhiteboard[]>([]);
  const [loadingBoards, setLoadingBoards] = useState(false);
  const [creatingCanvas, setCreatingCanvas] = useState(false);

  useEffect(() => {
    setDescriptionBlocks(task?.descriptionJson ?? []);
  }, [task?.descriptionJson]);

  // Sync / fetch linked whiteboards when task changes
  useEffect(() => {
    if (!task) {
      setLinkedBoards([]);
      return;
    }

    const localMatches = whiteboards.filter((b) => b.task_id === task.id);
    setLinkedBoards(localMatches);

    let isMounted = true;
    setLoadingBoards(true);
    getTaskWhiteboards(task.id)
      .then((fetched) => {
        if (isMounted && fetched) {
          setLinkedBoards(fetched);
        }
      })
      .finally(() => {
        if (isMounted) setLoadingBoards(false);
      });

    return () => {
      isMounted = false;
    };
  }, [task?.id, whiteboards]);

  if (!task) return null;

  const canChangeStatus = canManage || task.assignedTo?.id === currentUserId;

  const handleBlocksChange = async (updatedBlocks: RichTextBlock[]) => {
    setDescriptionBlocks(updatedBlocks);
    if (task && (canManage || task.assignedTo?.id === currentUserId)) {
      try {
        await updateTask(task.id, {
          descriptionJson: updatedBlocks,
          descriptionText: blocksToPlainText(updatedBlocks),
        });
      } catch (err) {
        console.error("Failed to persist task block updates:", err);
      }
    }
  };

  const handleCreateCanvas = async () => {
    if (!task) return;
    setCreatingCanvas(true);
    try {
      const boardName = `${task.title} (Canvas)`;
      const res = await createWhiteboard(boardName, null, task.id);
      if (res.status === "success" && res.id) {
        const newBoard: WorkspaceWhiteboard = {
          id: res.id,
          organization_id: organizationId,
          name: boardName,
          folder_id: null,
          task_id: task.id,
          elements_json: [],
          viewport: { x: 0, y: 0, zoom: 1 },
          created_by: currentUserId,
          updated_at: new Date().toISOString(),
        };
        setLinkedBoards((prev) => [newBoard, ...prev]);
        if (onWhiteboardCreated) {
          onWhiteboardCreated(newBoard);
        } else if (onOpenWhiteboard) {
          onOpenWhiteboard(res.id);
        }
      }
    } finally {
      setCreatingCanvas(false);
    }
  };

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
                task.createdBy?.fullName ?? task.createdBy?.email ?? t.member
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
                {stages.length > 0 && onStageChange ? (
                  <Select
                    value={task.stageId ?? stages[0]?.id ?? ""}
                    onValueChange={(stageId) => {
                      if (onStageChange) onStageChange(task.id, stageId);
                    }}
                    disabled={statusPending || !canManage}
                  >
                    <SelectTrigger size="sm" className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((st) => (
                        <SelectItem key={st.id} value={st.id}>
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2 w-2 rounded-full shrink-0"
                              style={{ backgroundColor: st.color }}
                            />
                            <span>{st.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : canChangeStatus ? (
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

          {descriptionBlocks && descriptionBlocks.length > 0 ? (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t.descriptionLabel}
              </h4>
              <div className="rounded-md border border-border/50 bg-muted/10 p-3">
                <BlockEditor
                  blocks={descriptionBlocks}
                  onChange={handleBlocksChange}
                  readOnly={true}
                />
              </div>
            </div>
          ) : task.description ? (
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

          {/* Linked Whiteboards & Visual Canvases */}
          <div className="border-t border-border/60 pt-4">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Linked Canvases
                </h4>
                {linkedBoards.length > 0 && (
                  <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-mono">
                    {linkedBoards.length}
                  </Badge>
                )}
              </div>
              {canManage && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                  onClick={handleCreateCanvas}
                  disabled={creatingCanvas}
                >
                  {creatingCanvas ? (
                    <LoaderCircle className="h-3 w-3 animate-spin" />
                  ) : (
                    <Plus className="h-3 w-3" />
                  )}
                  <span>New Canvas</span>
                </Button>
              )}
            </div>

            {loadingBoards && linkedBoards.length === 0 ? (
              <div className="flex items-center justify-center p-3 text-xs text-muted-foreground">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin mr-1.5" />
                Loading canvases...
              </div>
            ) : linkedBoards.length > 0 ? (
              <div className="grid gap-1.5">
                {linkedBoards.map((board) => (
                  <div
                    key={board.id}
                    className="flex items-center justify-between p-2 rounded-lg border border-border/70 bg-card hover:bg-accent/40 transition-colors group cursor-pointer"
                    onClick={() => {
                      if (onOpenWhiteboard) {
                        onOpenWhiteboard(board.id);
                      }
                    }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-1 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20">
                        <Sparkles className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{board.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {Array.isArray(board.elements_json) ? board.elements_json.length : 0} elements
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[11px] gap-1 group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onOpenWhiteboard) onOpenWhiteboard(board.id);
                      }}
                    >
                      <span>Open</span>
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border/80 p-2.5 text-center">
                <p className="text-xs text-muted-foreground">No whiteboard connected to this task yet.</p>
                {canManage && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2 h-6 px-2.5 text-xs gap-1"
                    onClick={handleCreateCanvas}
                    disabled={creatingCanvas}
                  >
                    <Plus className="h-3 w-3" />
                    <span>Create Canvas</span>
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-border/60 pt-4">
            <AttachmentPanel
              taskId={task.id}
              organizationId={organizationId}
              canUpload={canUpload}
              canManage={canManage}
              currentUserId={currentUserId}
              taskClientVisible={task.isClientVisible}
              platform={platform}
            />
          </div>

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