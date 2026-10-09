"use client";

import { useMemo, useState, useTransition } from "react";
import {
  BookOpen,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Layers,
  LayoutGrid,
  List,
  LoaderCircle,
  MessageSquare,
  Plus,
  Search,
  Sparkles,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import {
  getTaskStages,
  updateTaskStage,
} from "@/lib/actions/tasks-powerhouse";
import type {
  TaskPriority,
  TaskStage,
  TaskStatus,
  WorkspaceDoc,
  WorkspaceWhiteboard,
  WorkspaceWhiteboardFolder,
} from "@/types/database";
import {
  formatDueDate,
  isTaskOverdue,
  TASK_PRIORITIES,
  TASK_PRIORITY_BADGE_CLASSES,
} from "./task-meta";
import { TaskDialog, type TaskMemberOption } from "./task-dialog";
import { TaskDetailDialog } from "./task-detail-dialog";
import { ManageTaskStagesDialog } from "./manage-task-stages-dialog";
import { DocsWorkspace } from "./docs-workspace";
import { WhiteboardWorkspace } from "./whiteboard-workspace";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

export type TaskActiveView = "board" | "list" | "docs" | "whiteboard";

interface TasksViewProps {
  initialTasks: TaskRow[];
  initialStages: TaskStage[];
  initialDocs: WorkspaceDoc[];
  initialWhiteboards: WorkspaceWhiteboard[];
  initialWhiteboardFolders?: WorkspaceWhiteboardFolder[];
  members: TaskMemberOption[];
  canManage: boolean;
  canUpload: boolean;
  currentUserId: string;
  organizationId: string;
  todayIso: string;
  platform: Dictionary["platform"];
  locale: Locale;
}

interface TaskCardProps {
  task: TaskRow;
  stages: TaskStage[];
  todayIso: string;
  canManage: boolean;
  onOpen: (task: TaskRow) => void;
  onStageChange: (taskId: string, stageId: string) => void;
  platform: Dictionary["platform"];
  locale: Locale;
}

function TaskCard({
  task,
  stages,
  todayIso,
  canManage,
  onOpen,
  onStageChange,
  platform,
  locale,
}: TaskCardProps) {
  const t = platform.tasks;
  const isOverdue = task.dueDate ? isTaskOverdue(task.dueDate, todayIso) : false;
  const isDone = task.status === "done";
  const subtasksCount = task.subtasks?.length ?? 0;
  const completedSubtasks = task.subtasks?.filter((st) => st.status === "done").length ?? 0;
  const commentsCount = task.commentsCount ?? 0;

  return (
    <div
      onClick={() => onOpen(task)}
      className="group relative flex flex-col justify-between rounded-xl border border-border/80 bg-card p-3.5 shadow-sm transition hover:border-primary/50 hover:shadow-md cursor-pointer space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <Badge
          variant="outline"
          className={cn(
            "px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wider",
            TASK_PRIORITY_BADGE_CLASSES[task.priority]
          )}
        >
          {t.priority[task.priority]}
        </Badge>

        {task.dueDate && (
          <span
            className={cn(
              "flex items-center gap-1 text-[11px] font-medium",
              isOverdue && !isDone ? "text-destructive font-semibold" : "text-muted-foreground"
            )}
          >
            <CalendarDays className="h-3 w-3" />
            {formatDueDate(task.dueDate, locale)}
          </span>
        )}
      </div>

      <div className="space-y-1">
        <h4 className={cn("text-sm font-semibold leading-snug line-clamp-2", isDone && "line-through text-muted-foreground")}>
          {task.title}
        </h4>
        {task.descriptionText && (
          <p className="text-xs text-muted-foreground line-clamp-2 font-normal">
            {task.descriptionText}
          </p>
        )}
      </div>

      {(subtasksCount > 0 || commentsCount > 0) && (
        <div className="flex items-center gap-2 pt-1">
          {subtasksCount > 0 && (
            <div className="flex items-center gap-1 rounded bg-muted/60 px-1.5 py-0.5 text-[11px] text-muted-foreground">
              <CheckSquare className="h-3 w-3" />
              <span>
                {completedSubtasks}/{subtasksCount}
              </span>
            </div>
          )}
          {commentsCount > 0 && (
            <div className="flex items-center gap-1 rounded bg-muted/60 px-1.5 py-0.5 text-[11px] text-muted-foreground">
              <MessageSquare className="h-3 w-3" />
              <span>{commentsCount}</span>
            </div>
          )}
        </div>
      )}

      <div
        className="flex items-center justify-between gap-2 pt-2 border-t border-border/50 text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="flex items-center gap-1 text-muted-foreground truncate max-w-[120px]">
          <User className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {task.assignedTo?.fullName ?? task.assignedTo?.email ?? t.unassigned}
          </span>
        </span>

        {stages.length > 0 && (
          <Select
            value={task.stageId ?? stages[0]?.id ?? ""}
            onValueChange={(stageId) => onStageChange(task.id, stageId)}
            disabled={!canManage}
          >
            <SelectTrigger className="h-6 w-auto gap-1 px-2 text-[10px] font-medium border-0 bg-muted/60 hover:bg-muted">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {stages.map((st) => (
                <SelectItem key={st.id} value={st.id}>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: st.color }}
                    />
                    <span className="text-xs">{st.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}
export function TasksView({
  initialTasks,
  initialStages,
  initialDocs,
  initialWhiteboards,
  initialWhiteboardFolders = [],
  members,
  canManage,
  canUpload,
  currentUserId,
  organizationId,
  todayIso,
  platform,
  locale,
}: TasksViewProps) {
  const t = platform.tasks;
  const common = platform.common;

  const [activeView, setActiveView] = useState<TaskActiveView>("board");
  const [tasks, setTasks] = useState<TaskRow[]>(initialTasks);
  const [stages, setStages] = useState<TaskStage[]>(initialStages);
  const [whiteboards, setWhiteboards] = useState<WorkspaceWhiteboard[]>(initialWhiteboards);
  const [selectedWhiteboardId, setSelectedWhiteboardId] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStageId, setFilterStageId] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");

  // List view collapsed sections
  const [collapsedStages, setCollapsedStages] = useState<Record<string, boolean>>({});

  // Modals
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);
  const [dialogInitialStageId, setDialogInitialStageId] = useState<string | null>(null);
  const [detailTask, setDetailTask] = useState<TaskRow | null>(null);
  const [manageStagesOpen, setManageStagesOpen] = useState(false);

  const [isPending, startTransition] = useTransition();

  const handleRefreshTasks = async () => {
    const updated = await getTasks();
    setTasks(updated);
    if (detailTask) {
      const refreshedDetail = updated.find((t) => t.id === detailTask.id);
      if (refreshedDetail) setDetailTask(refreshedDetail);
    }
  };

  const handleRefreshStages = async () => {
    const updated = await getTaskStages();
    setStages(updated);
    handleRefreshTasks();
  };

  const handleStageChange = (taskId: string, stageId: string) => {
    const targetStage = stages.find((s) => s.id === stageId);
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== taskId) return task;
        return {
          ...task,
          stageId,
          stage: targetStage || task.stage,
          status: targetStage?.is_done_stage ? "done" : task.status,
        };
      })
    );

    if (detailTask && detailTask.id === taskId) {
      setDetailTask((prev) =>
        prev
          ? {
              ...prev,
              stageId,
              stage: targetStage || prev.stage,
              status: targetStage?.is_done_stage ? "done" : prev.status,
            }
          : null
      );
    }

    startTransition(async () => {
      await updateTaskStage(taskId, stageId);
    });
  };

  const handleStatusChange = (taskId: string, status: TaskStatus) => {
    setTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, status } : task))
    );
    if (detailTask && detailTask.id === taskId) {
      setDetailTask((prev) => (prev ? { ...prev, status } : null));
    }
    startTransition(async () => {
      await updateTaskStatus(taskId, status);
    });
  };

  const toggleStageCollapse = (stageId: string) => {
    setCollapsedStages((prev) => ({
      ...prev,
      [stageId]: !prev[stageId],
    }));
  };

  const handleOpenNewTask = (stageId?: string) => {
    setEditingTask(null);
    setDialogInitialStageId(stageId || null);
    setTaskDialogOpen(true);
  };

  const handleOpenEditTask = (task: TaskRow) => {
    setDetailTask(null);
    setEditingTask(task);
    setTaskDialogOpen(true);
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(q);
        const matchesDesc = task.descriptionText.toLowerCase().includes(q);
        const matchesTags = task.tags.some((tag) => tag.toLowerCase().includes(q));
        if (!matchesTitle && !matchesDesc && !matchesTags) return false;
      }

      if (filterStageId !== "all") {
        if (task.stageId !== filterStageId) return false;
      }

      if (filterPriority !== "all") {
        if (task.priority !== filterPriority) return false;
      }

      if (filterAssignee !== "all") {
        if (filterAssignee === "unassigned") {
          if (task.assignedTo !== null) return false;
        } else if (task.assignedTo?.id !== filterAssignee) {
          return false;
        }
      }

      return true;
    });
  }, [tasks, searchQuery, filterStageId, filterPriority, filterAssignee]);

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <span>{t.title}</span>
              <Badge variant="secondary" className="text-xs font-semibold px-2 py-0.5 rounded-full">
                {tasks.length}
              </Badge>
            </h1>
          </div>
        </div>

        {/* View Switcher Tabs & Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center rounded-lg border border-border bg-muted/30 p-1 shadow-sm">
            <Button
              type="button"
              variant={activeView === "board" ? "secondary" : "ghost"}
              size="sm"
              className={cn("h-8 gap-1.5 text-xs font-medium", activeView === "board" && "bg-background shadow-xs text-foreground")}
              onClick={() => setActiveView("board")}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>{t.board}</span>
            </Button>

            <Button
              type="button"
              variant={activeView === "list" ? "secondary" : "ghost"}
              size="sm"
              className={cn("h-8 gap-1.5 text-xs font-medium", activeView === "list" && "bg-background shadow-xs text-foreground")}
              onClick={() => setActiveView("list")}
            >
              <List className="h-3.5 w-3.5" />
              <span>{t.list}</span>
            </Button>

            <Button
              type="button"
              variant={activeView === "docs" ? "secondary" : "ghost"}
              size="sm"
              className={cn("h-8 gap-1.5 text-xs font-medium", activeView === "docs" && "bg-background shadow-xs text-foreground")}
              onClick={() => setActiveView("docs")}
            >
              <BookOpen className="h-3.5 w-3.5 text-blue-500" />
              <span>{t.docs}</span>
            </Button>

            <Button
              type="button"
              variant={activeView === "whiteboard" ? "secondary" : "ghost"}
              size="sm"
              className={cn("h-8 gap-1.5 text-xs font-medium", activeView === "whiteboard" && "bg-background shadow-xs text-foreground")}
              onClick={() => setActiveView("whiteboard")}
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>{t.whiteboard || "Whiteboard"}</span>
            </Button>
          </div>

          {canManage && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs font-medium"
              onClick={() => setManageStagesOpen(true)}
            >
              <Layers className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{t.stages?.manageStages || "Manage Stages"}</span>
            </Button>
          )}

          {canManage && (
            <Button
              type="button"
              size="sm"
              className="h-9 gap-1.5 text-xs font-semibold shadow-sm"
              onClick={() => handleOpenNewTask()}
            >
              <Plus className="h-4 w-4" />
              <span>{t.newTask}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Filter Bar (Only shown for Board & List views) */}
      {(activeView === "board" || activeView === "list") && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border/70 bg-card p-3 shadow-xs">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="h-8.5 pl-8.5 text-xs bg-background/50"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {stages.length > 0 && (
              <Select value={filterStageId} onValueChange={setFilterStageId}>
                <SelectTrigger className="h-8.5 text-xs w-36 bg-background/50">
                  <SelectValue placeholder={t.allStatuses} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.allStatuses}</SelectItem>
                  {stages.map((st) => (
                    <SelectItem key={st.id} value={st.id}>
                      <div className="flex items-center gap-1.5">
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
            )}

            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="h-8.5 text-xs w-32 bg-background/50">
                <SelectValue placeholder={t.allPriorities} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.allPriorities}</SelectItem>
                {TASK_PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {t.priority[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterAssignee} onValueChange={setFilterAssignee}>
              <SelectTrigger className="h-8.5 text-xs w-36 bg-background/50">
                <SelectValue placeholder={t.allMembers} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.allMembers}</SelectItem>
                <SelectItem value="unassigned">{t.unassigned}</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.fullName ?? m.email ?? t.unnamed}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* VIEW 1: DYNAMIC BOARD (KANBAN) */}
      {activeView === "board" && (
        <div className="grid grid-flow-col auto-cols-[280px] sm:auto-cols-[310px] gap-4 overflow-x-auto pb-6 items-start">
          {stages.map((stage) => {
            const stageTasks = filteredTasks.filter((t) => (t.stageId ? t.stageId === stage.id : t.status === stage.name.toLowerCase()));

            return (
              <div
                key={stage.id}
                className="flex flex-col rounded-xl border border-border/80 bg-muted/20 p-3 shadow-xs min-h-[500px]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-border/50 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: stage.color }}
                    />
                    <span className="font-semibold text-xs truncate text-foreground uppercase tracking-wide">
                      {stage.name}
                    </span>
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-bold rounded-full">
                      {stageTasks.length}
                    </Badge>
                  </div>

                  {canManage && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      onClick={() => handleOpenNewTask(stage.id)}
                      title="+ Add task to this stage"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                {/* Cards List */}
                <div className="space-y-2.5 flex-1 overflow-y-auto pr-0.5">
                  {stageTasks.length === 0 ? (
                    <div className="h-32 flex items-center justify-center rounded-lg border border-dashed border-border/60 text-xs text-muted-foreground/60">
                      {t.noTasksInColumn}
                    </div>
                  ) : (
                    stageTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        stages={stages}
                        todayIso={todayIso}
                        canManage={canManage}
                        onOpen={(selected) => setDetailTask(selected)}
                        onStageChange={handleStageChange}
                        platform={platform}
                        locale={locale}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW 2: LIST VIEW (CLICKUP-STYLE GROUPED TABLE) */}
      {activeView === "list" && (
        <div className="space-y-4">
          {stages.map((stage) => {
            const stageTasks = filteredTasks.filter((t) => (t.stageId ? t.stageId === stage.id : t.status === stage.name.toLowerCase()));
            const isCollapsed = Boolean(collapsedStages[stage.id]);

            return (
              <div key={stage.id} className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs">
                {/* Collapsible Stage Header */}
                <div
                  onClick={() => toggleStageCollapse(stage.id)}
                  className="flex items-center justify-between gap-3 px-4 py-3 bg-muted/40 cursor-pointer select-none hover:bg-muted/60 transition"
                >
                  <div className="flex items-center gap-2.5">
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: stage.color }}
                    />
                    <span className="font-bold text-xs uppercase tracking-wider text-foreground">
                      {stage.name}
                    </span>
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-semibold rounded-full">
                      {stageTasks.length}
                    </Badge>
                  </div>

                  {canManage && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenNewTask(stage.id);
                      }}
                    >
                      <Plus className="h-3 w-3" />
                      <span>{t.newTask}</span>
                    </Button>
                  )}
                </div>

                {!isCollapsed && (
                  <div className="overflow-x-auto">
                    {stageTasks.length === 0 ? (
                      <div className="p-6 text-center text-xs text-muted-foreground">
                        {t.noTasksInColumn}
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="text-xs hover:bg-transparent">
                            <TableHead className="w-[40%]">{t.tableTitle}</TableHead>
                            <TableHead className="w-[15%]">{t.tableStatus}</TableHead>
                            <TableHead className="w-[15%]">{t.tablePriority}</TableHead>
                            <TableHead className="w-[15%]">{t.tableAssignee}</TableHead>
                            <TableHead className="w-[15%] text-right">{t.tableDue}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {stageTasks.map((task) => {
                            const isOverdue = task.dueDate ? isTaskOverdue(task.dueDate, todayIso) : false;
                            const isDone = task.status === "done";

                            return (
                              <TableRow
                                key={task.id}
                                onClick={() => setDetailTask(task)}
                                className="cursor-pointer hover:bg-muted/30 transition text-xs"
                              >
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2">
                                    <span className={cn(isDone && "line-through text-muted-foreground")}>
                                      {task.title}
                                    </span>
                                    {task.subtasks && task.subtasks.length > 0 && (
                                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                        {task.subtasks.filter((st) => st.status === "done").length}/{task.subtasks.length}
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                  <Select
                                    value={task.stageId ?? stages[0]?.id ?? ""}
                                    onValueChange={(val) => handleStageChange(task.id, val)}
                                    disabled={!canManage}
                                  >
                                    <SelectTrigger className="h-7 w-auto px-2 text-[11px] font-medium border-0 bg-muted/60 hover:bg-muted">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {stages.map((st) => (
                                        <SelectItem key={st.id} value={st.id}>
                                          <div className="flex items-center gap-1.5">
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
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "px-1.5 py-0 text-[10px] font-medium uppercase",
                                      TASK_PRIORITY_BADGE_CLASSES[task.priority]
                                    )}
                                  >
                                    {t.priority[task.priority]}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <span className="flex items-center gap-1.5 text-muted-foreground">
                                    <User className="h-3.5 w-3.5 shrink-0" />
                                    <span>
                                      {task.assignedTo?.fullName ?? task.assignedTo?.email ?? t.unassigned}
                                    </span>
                                  </span>
                                </TableCell>
                                <TableCell className="text-right">
                                  {task.dueDate ? (
                                    <span className={cn(isOverdue && !isDone && "text-destructive font-semibold")}>
                                      {formatDueDate(task.dueDate, locale)}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground/60">{t.noDueDate}</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>

                      </Table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW 3: DOCS & NOTES WORKSPACE (NOTION-STYLE) */}
      {activeView === "docs" && (
        <DocsWorkspace
          initialDocs={initialDocs}
          initialWhiteboards={whiteboards}
          platform={platform}
          locale={locale}
          onOpenWhiteboard={(whiteboardId) => {
            setSelectedWhiteboardId(whiteboardId);
            setActiveView("whiteboard");
          }}
        />
      )}

      {/* VIEW 4: WHITEBOARDS WORKSPACE */}
      {activeView === "whiteboard" && (
        <WhiteboardWorkspace
          initialWhiteboards={whiteboards}
          initialWhiteboardFolders={initialWhiteboardFolders}
          tasks={tasks}
          activeBoardIdProp={selectedWhiteboardId}
          platform={platform}
          locale={locale}
          onOpenTask={(taskId) => {
            const found = tasks.find((t) => t.id === taskId);
            if (found) setDetailTask(found);
          }}
        />
      )}

      {/* Task Creation & Edit Modal */}
      <TaskDialog
        open={taskDialogOpen}
        onOpenChange={(open) => {
          setTaskDialogOpen(open);
          if (!open) {
            setEditingTask(null);
            setDialogInitialStageId(null);
          }
        }}
        task={editingTask}
        members={members}
        stages={stages}
        initialStageId={dialogInitialStageId}
        onSaved={handleRefreshTasks}
        platform={platform}
        locale={locale}
      />

      {/* Task Details Dialog */}
      <TaskDetailDialog
        open={detailTask !== null}
        onOpenChange={(open) => {
          if (!open) setDetailTask(null);
        }}
        task={detailTask}
        canManage={canManage}
        canUpload={canUpload}
        currentUserId={currentUserId}
        organizationId={organizationId}
        stages={stages}
        whiteboards={whiteboards}
        onStageChange={handleStageChange}
        onStatusChange={handleStatusChange}
        onEditRequest={handleOpenEditTask}
        onDeleted={handleRefreshTasks}
        onOpenWhiteboard={(boardId) => {
          setDetailTask(null);
          setSelectedWhiteboardId(boardId);
          setActiveView("whiteboard");
        }}
        onWhiteboardCreated={(newBoard) => {
          setWhiteboards((prev) => [newBoard, ...prev]);
          setDetailTask(null);
          setSelectedWhiteboardId(newBoard.id);
          setActiveView("whiteboard");
        }}
        platform={platform}
        locale={locale}
      />

      {/* Manage Workflow Stages Modal */}
      <ManageTaskStagesDialog
        open={manageStagesOpen}
        onOpenChange={setManageStagesOpen}
        stages={stages}
        onStagesUpdated={handleRefreshStages}
        platform={platform}
      />
    </div>
  );
}

