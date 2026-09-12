"use client";

import { useEffect, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckSquare, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { taskInputSchema, type TaskInput } from "@/lib/validations/tasks";
import { createTask, updateTask, type TaskRow } from "@/lib/actions/tasks";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "./task-meta";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

export interface TaskMemberOption {
  id: string;
  fullName: string | null;
  email: string | null;
}

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Non-null when editing an existing task. */
  task: TaskRow | null;
  /** Active organization members available for assignment. */
  members: TaskMemberOption[];
  onSaved: () => void;
  /** Localized copy + formatters for the current render. */
  platform: Dictionary["platform"];
  locale: Locale;
}

/**
 * Create / edit task dialog backed by react-hook-form + the shared Zod
 * schema. Submits to the `createTask` / `updateTask` server actions,
 * which re-validate everything server-side and revalidate /tasks.
 */
export function TaskDialog({
  open,
  onOpenChange,
  task,
  members,
  onSaved,
  platform,
  locale,
}: TaskDialogProps) {
  const isEdit = task !== null;
  const t = platform.tasks;
  const common = platform.common;
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    setError,
    formState: { errors },
  } = useForm<TaskInput>({
    resolver: zodResolver(taskInputSchema),
    defaultValues: {
      title: "",
      description: "",
      status: "todo",
      priority: "medium",
      assignedTo: "",
      dueDate: "",
    },
  });

  // Re-seed the form every time the dialog opens so it always reflects the
  // task being edited or a pristine create form.
  useEffect(() => {
    if (!open) return;
    reset({
      title: isEdit ? task.title : "",
      description: isEdit ? task.description ?? "" : "",
      status: isEdit ? task.status : "todo",
      priority: isEdit ? task.priority : "medium",
      assignedTo: isEdit ? task.assignedTo?.id ?? "" : "",
      // <input type="date"> expects YYYY-MM-DD; stored ISO includes time.
      dueDate: isEdit && task.dueDate ? task.dueDate.slice(0, 10) : "",
    });
  }, [open, isEdit, task, reset]);

  // Clear any leftover server error the moment the dialog closes, so the
  // next open always starts clean.
  const handleOpenChange = (next: boolean) => {
    if (!next) setServerError(null);
    onOpenChange(next);
  };

  const onSubmit = handleSubmit((values) => {
    setServerError(null);

    startTransition(async () => {
      const result = isEdit
        ? await updateTask(task.id, values)
        : await createTask(values);

      if (result.status === "error") {
        setServerError(
          result.error ?? (isEdit ? t.errors.updateFailed : t.errors.createFailed)
        );
        if (result.fieldErrors) {
          for (const [key, messages] of Object.entries(result.fieldErrors)) {
            if (messages?.length) {
              setError(key as keyof TaskInput, { message: messages[0] });
            }
          }
        }
        return;
      }

      onSaved();
      onOpenChange(false);
    });
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
            {isEdit ? t.editTask : t.newTask}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? t.editTaskDescription : t.createTaskDescription}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="task-title">{t.titleLabel}</Label>
            <Input
              id="task-title"
              placeholder={t.titlePlaceholder}
              {...register("title")}
              aria-invalid={Boolean(errors.title)}
            />
            {errors.title && (
              <p role="alert" className="text-sm text-destructive">
                {errors.title.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="task-status">{t.tableStatus}</Label>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) =>
                      field.onChange(value as TaskInput["status"])
                    }
                  >
                    <SelectTrigger id="task-status" className="w-full">
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
                )}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="task-priority">{t.tablePriority}</Label>
              <Controller
                name="priority"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) =>
                      field.onChange(value as TaskInput["priority"])
                    }
                  >
                    <SelectTrigger id="task-priority" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_PRIORITIES.map((priority) => (
                        <SelectItem key={priority} value={priority}>
                          {t.priority[priority]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="task-assignee">{t.assignTo}</Label>
              <Controller
                name="assignedTo"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value || "none"}
                    onValueChange={(value) =>
                      field.onChange(value === "none" ? "" : value)
                    }
                  >
                    <SelectTrigger id="task-assignee" className="w-full">
                      <SelectValue placeholder={t.unassigned} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t.unassigned}</SelectItem>
                      {members.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.fullName ?? member.email ?? t.unnamed}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="task-due">{t.dueDateLabel}</Label>
              <Input
                id="task-due"
                type="date"
                {...register("dueDate")}
                aria-invalid={Boolean(errors.dueDate)}
              />
              {errors.dueDate && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.dueDate.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="task-description">{t.descriptionLabel}</Label>
            <Textarea
              id="task-description"
              placeholder={t.descriptionPlaceholder}
              rows={3}
              {...register("description")}
              aria-invalid={Boolean(errors.description)}
            />
            {errors.description && (
              <p role="alert" className="text-sm text-destructive">
                {errors.description.message}
              </p>
            )}
          </div>

          {serverError && (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {serverError}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {common.cancel}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              )}
              {isEdit ? t.saveChanges : t.createTask}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}