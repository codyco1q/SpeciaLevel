"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  CheckSquare,
  LayoutGrid,
  List,
  LoaderCircle,
  Plus,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { getTasks, updateTaskStatus, type TaskRow } from "@/lib/actions/tasks";
import type { TaskStatus } from "@/types/database";
import {
  formatDueDate,
  isTaskOverdue,
  TASK_PRIORITY_BADGE_CLASSES,
  TASK_STATUSES,
  TASK_STATUS_DOT_CLASSES,
} from "./task-meta";
import { TaskDialog, type TaskMemberOption } from "./task-dialog";
import { TaskDetailDialog } from "./task-detail-dialog";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

interface TasksViewProps {
  initialTasks: TaskRow[];
  members: TaskMemberOption[];
  canManage: boolean;
  currentUserId: string;
  /** ISO string of today (server-rendered) for overdue highlighting. */
  todayIso: string;
  /** Localized copy + formatters for the current render. */
  platform: Dictionary["platform"];
  locale: Locale;
}

interface TaskCardProps {
  task: TaskRow;
  todayIso: string;
  canChangeStatus: boolean;
  onOpen: (task: TaskRow) => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  /** Localized copy + formatters for the current render. */
  platform: Dictionary["platform"];
  locale: Locale;
}

/** Single kanban card: click body opens details, footer selects status. */
function TaskCard({
  task,
  todayIso,
  canChangeStatus,
  onOpen,
  onStatusChange,
  platform,
  locale,
}: TaskCardProps) {
  const t = platform.tasks;
  const overdue =
    task.dueDate &&
    isTaskOverdue(task.dueDate, todayIso) &&
    task.status !== "done";

  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-sm transition-colors group hover:border-foreground/20">
      <button
        type="button"
        onClick={() => onOpen(task)}
        className="w-full text-left"
      >
        <p className="text-sm font-semibold leading-snug">{task.title}</p>
        {task.description && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {task.description}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          <Badge
            variant="outline"
            className={cn(
              "px-1.5 py-0 text-[10px]",
              TASK_PRIORITY_BADGE_CLASSES[task.priority]
            )}
          >
            {t.priority[task.priority]}
          </Badge>
          {task.assignedTo && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              {task.assignedTo.fullName ?? task.assignedTo.email ?? t.member}
            </span>
          )}
          {task.dueDate && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs",
                overdue
                  ? "font-medium text-red-600"
                  : "text-muted-foreground"
              )}
            >
              <CalendarDays className="h-3 w-3" />
              {formatDueDate(task.dueDate, locale)}
            </span>
          )}
        </div>
      </button>
      <div className="mt-2 border-t border-border/60 pt-2">
        {canChangeStatus ? (
          <Select
            value={task.status}
            onValueChange={(value) =>
              onStatusChange(task.id, value as TaskStatus)
            }
          >
            <SelectTrigger size="sm" className="h-7 w-full text-xs">
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
          <span className="text-xs font-medium text-muted-foreground">
            {t.status[task.status]}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Tasks orchestrator: board/list view switcher, per-card status updates,
 * create/edit dialog (gated on `tasks.manage`), and details modal.
 */
export function TasksView({
  initialTasks,
  members,
  canManage,
  currentUserId,
  todayIso,
  platform,
  locale,
}: TasksViewProps) {
  const t = platform.tasks;
  const [tasks, setTasks] = useState<TaskRow[]>(initialTasks);
  const [view, setView] = useState<"board" | "list">("board");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);
  const [detailTask, setDetailTask] = useState<TaskRow | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  /** Refetch all tasks; keeps an open details modal in sync. */
  async function refreshTasks() {
    setRefreshing(true);
    try {
      const rows = await getTasks();
      if (rows) {
        setTasks(rows);
        setDetailTask((current) =>
          current ? rows.find((row) => row.id === current.id) ?? null : null
        );
      }
    } finally {
      setRefreshing(false);
    }
  }

  async function handleStatusChange(taskId: string, status: TaskStatus) {
    const result = await updateTaskStatus(taskId, status);
    if (result.status === "error") {
      setActionError(result.error ?? t.errors.updateFailed);
      return;
    }
    setActionError(null);
    await refreshTasks();
  }

  const visibleTasks = useMemo(
    () =>
      tasks.filter((task) => {
        if (statusFilter !== "all" && task.status !== statusFilter) {
          return false;
        }
        if (assigneeFilter === "unassigned") return !task.assignedTo;
        if (assigneeFilter !== "all") {
          return task.assignedTo?.id === assigneeFilter;
        }
        return true;
      }),
    [tasks, statusFilter, assigneeFilter]
  );

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          {refreshing && (
            <LoaderCircle className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-border bg-card">
            <button
              type="button"
              onClick={() => setView("board")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors",
                view === "board"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <LayoutGrid className="h-4 w-4" />
              {t.board}
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors",
                view === "list"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <List className="h-4 w-4" />
              {t.list}
            </button>
          </div>

          {canManage && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              {t.newTask}
            </Button>
          )}
        </div>
      </div>

      {actionError && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {actionError}
        </div>
      )}

      {/* List-only filters */}
      {view === "list" && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger size="sm" className="h-8 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.allStatuses}</SelectItem>
              {TASK_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {t.status[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger size="sm" className="h-8 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.allMembers}</SelectItem>
              <SelectItem value="unassigned">{t.unassigned}</SelectItem>
              {members.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.fullName ?? member.email ?? t.unnamed}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
{/* Empty state */}
      {tasks.length === 0 && (
        <div className="mb-4 rounded-xl border border-dashed border-border/80 bg-card/50 p-10 text-center">
          <CheckSquare className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-2 text-sm font-semibold">{t.noTasksYet}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {canManage ? t.noTasksYetHintManage : t.noTasksYetHintView}
          </p>
        </div>
      )}

      {/* Board view */}
      {view === "board" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {TASK_STATUSES.map((status) => {
            const columnTasks = visibleTasks.filter(
              (task) => task.status === status
            );
            return (
              <div
                key={status}
                className="flex flex-col rounded-xl border border-border bg-muted/30"
              >
                <div className="flex items-center justify-between border-b border-border/60 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        TASK_STATUS_DOT_CLASSES[status]
                      )}
                    />
                    <span className="text-sm font-semibold">
                      {t.status[status]}
                    </span>
                  </div>
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                    {columnTasks.length}
                  </span>
                </div>
                <div className="flex-1 space-y-2 p-2">
                  {columnTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      todayIso={todayIso}
                      canChangeStatus={
                        canManage || task.assignedTo?.id === currentUserId
                      }
                      onOpen={setDetailTask}
                      onStatusChange={(taskId, status) =>
                        handleStatusChange(taskId, status)
                      }
                      platform={platform}
                      locale={locale}
                    />
                  ))}
                  {columnTasks.length === 0 && (
                    <div className="rounded-md border border-dashed border-border/70 p-6 text-center text-xs text-muted-foreground">
                      {t.noTasksInColumn}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
{/* List view */}
      {view === "list" && (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.tableTask}</TableHead>
                <TableHead>{t.tableStatus}</TableHead>
                <TableHead>{t.tablePriority}</TableHead>
                <TableHead>{t.tableAssignee}</TableHead>
                <TableHead>{t.tableDue}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleTasks.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    {t.noTasksMatchFilters}
                  </TableCell>
                </TableRow>
              ) : (
                visibleTasks.map((task) => {
                  const canChangeStatus =
                    canManage || task.assignedTo?.id === currentUserId;
                  const overdue =
                    task.dueDate &&
                    isTaskOverdue(task.dueDate, todayIso) &&
                    task.status !== "done";
                  return (
                    <TableRow
                      key={task.id}
                      className="cursor-pointer"
                      onClick={() => setDetailTask(task)}
                    >
                      <TableCell>
                        <p className="font-medium">{task.title}</p>
                        <p className="max-w-md truncate text-xs text-muted-foreground">
                          {task.description || "No description"}
                        </p>
                      </TableCell>
                      <TableCell onClick={(event) => event.stopPropagation()}>
                        {canChangeStatus ? (
                          <Select
                            value={task.status}
                            onValueChange={(value) =>
                              handleStatusChange(
                                task.id,
                                value as TaskStatus
                              )
                            }
                          >
                            <SelectTrigger
                              size="sm"
                              className="h-7 w-36 text-xs"
                            >
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
                          <span className="text-sm">
                            {t.status[task.status]}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "px-1.5 py-0 text-[10px]",
                            TASK_PRIORITY_BADGE_CLASSES[task.priority]
                          )}
                        >
                          {t.priority[task.priority]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {task.assignedTo
                          ? task.assignedTo.fullName ??
                            task.assignedTo.email ??
                            t.member
                          : t.unassigned}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-sm",
                          overdue
                            ? "font-medium text-red-600"
                            : "text-muted-foreground"
                        )}
                      >
                        {task.dueDate ? formatDueDate(task.dueDate, locale) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}
{/* Dialogs */}
      <TaskDetailDialog
        open={detailTask !== null}
        onOpenChange={(open) => {
          if (!open) setDetailTask(null);
        }}
        task={detailTask}
        canManage={canManage}
        currentUserId={currentUserId}
        onStatusChange={(taskId, status) =>
          handleStatusChange(taskId, status)
        }
        onEditRequest={(task) => {
          setEditingTask(task);
          setDetailTask(null);
        }}
        onDeleted={async () => {
          setDetailTask(null);
          await refreshTasks();
        }}
        platform={platform}
        locale={locale}
      />

      <TaskDialog
        open={createOpen || editingTask !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setEditingTask(null);
          }
        }}
        task={editingTask}
        members={members}
        platform={platform}
        locale={locale}
        onSaved={async () => {
          setCreateOpen(false);
          setEditingTask(null);
          await refreshTasks();
        }}
      />
    </div>
  );
}