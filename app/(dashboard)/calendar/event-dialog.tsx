"use client";

import { useEffect, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarPlus, LoaderCircle } from "lucide-react";
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
import {
  calendarEventSchemaWithRange,
  type CalendarFormValues,
} from "@/lib/validations/calendar";
import {
  createEvent,
  updateEvent,
  type CalendarEventRow,
} from "@/lib/actions/calendar";

export interface EmployeeOption {
  id: string;
  fullName: string | null;
  email: string | null;
}

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Non-null when editing an existing event. */
  event: CalendarEventRow | null;
  /** Active employees available for assignment. */
  employees: EmployeeOption[];
  /** Prefill times (ISO) used in create mode. */
  defaultStart: string;
  defaultEnd: string;
  onSaved: () => void;
}

/** Date/ISO -> "YYYY-MM-DDTHH:mm" for `<input type="datetime-local">`. */
function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Create / edit event dialog backed by react-hook-form + the shared Zod
 * schema. Submits to the `createEvent` / `updateEvent` server actions,
 * which re-validate everything server-side and revalidate /calendar.
 */
export function EventDialog({
  open,
  onOpenChange,
  event,
  employees,
  defaultStart,
  defaultEnd,
  onSaved,
}: EventDialogProps) {
  const isEdit = event !== null;
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    setError,
    formState: { errors },
  } = useForm<CalendarFormValues>({
    resolver: zodResolver(calendarEventSchemaWithRange),
    defaultValues: {
      title: "",
      description: "",
      startsAt: toDatetimeLocal(new Date()),
      endsAt: toDatetimeLocal(new Date(new Date().getTime() + 3_600_000)),
      location: "",
      assignedUserId: "",
    },
  });

  // Re-seed the form every time the dialog opens so it always reflects the
  // event being edited or the prefill times chosen in the calendar grid.
  useEffect(() => {
    if (!open) return;
    reset({
      title: isEdit ? event.title : "",
      description: isEdit ? event.description ?? "" : "",
      startsAt: toDatetimeLocal(
        new Date(isEdit ? event.startsAt : defaultStart)
      ),
      endsAt: toDatetimeLocal(
        new Date(isEdit ? event.endsAt : defaultEnd)
      ),
      location: isEdit ? event.location ?? "" : "",
      assignedUserId: isEdit ? event.assignedTo?.id ?? "" : "",
    });
  }, [open, event, defaultStart, defaultEnd, isEdit, reset]);

  // Clear any leftover server error the moment the dialog closes, so the
  // next open always starts clean. Handle state changes in event handlers,
  // never synchronously inside an effect.
  const handleOpenChange = (next: boolean) => {
    if (!next) setServerError(null);
    onOpenChange(next);
  };

  const onSubmit = handleSubmit((values) => {
    setServerError(null);

    // Convert the datetime-local strings to unambiguous ISO in the USER's
    // local timezone (client-side) before the server action stores them.
    const payload: CalendarFormValues = {
      ...values,
      startsAt: new Date(values.startsAt).toISOString(),
      endsAt: new Date(values.endsAt).toISOString(),
    };

    startTransition(async () => {
      const result = isEdit
        ? await updateEvent(event.id, payload)
        : await createEvent(payload);

      if (result.status === "error") {
        setServerError(result.error ?? "Something went wrong. Please try again.");
        if (result.fieldErrors) {
          for (const [key, messages] of Object.entries(result.fieldErrors)) {
            if (messages?.length) {
              setError(key as keyof CalendarFormValues, {
                message: messages[0],
              });
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
            <CalendarPlus className="h-4 w-4 text-muted-foreground" />
            {isEdit ? "Edit event" : "New event"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the event details below."
              : "Schedule an event for your organization."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="calendar-title">Title</Label>
            <Input
              id="calendar-title"
              placeholder="e.g. Weekly standup"
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
              <Label htmlFor="calendar-start">Starts</Label>
              <Input
                id="calendar-start"
                type="datetime-local"
                {...register("startsAt")}
                aria-invalid={Boolean(errors.startsAt)}
              />
              {errors.startsAt && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.startsAt.message}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="calendar-end">Ends</Label>
              <Input
                id="calendar-end"
                type="datetime-local"
                {...register("endsAt")}
                aria-invalid={Boolean(errors.endsAt)}
              />
              {errors.endsAt && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.endsAt.message}
                </p>
              )}
            </div>
          </div>
<div className="grid gap-2">
            <Label htmlFor="calendar-location">Location</Label>
            <Input
              id="calendar-location"
              placeholder="e.g. Meeting room 2, Zoom, 123 Main St"
              {...register("location")}
              aria-invalid={Boolean(errors.location)}
            />
            {errors.location && (
              <p role="alert" className="text-sm text-destructive">
                {errors.location.message}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="calendar-assignee">Assign to</Label>
            <Controller
              name="assignedUserId"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value || "none"}
                  onValueChange={(value) =>
                    field.onChange(value === "none" ? "" : value)
                  }
                >
                  <SelectTrigger id="calendar-assignee" className="w-full">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.fullName ?? employee.email ?? "Unnamed"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="calendar-description">Description</Label>
            <Textarea
              id="calendar-description"
              placeholder="Agenda, notes, links…"
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
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              )}
              {isEdit ? "Save changes" : "Create event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}