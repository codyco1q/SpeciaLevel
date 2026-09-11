"use client";

import { useState, useTransition } from "react";
import {
  CalendarDays,
  Clock,
  LoaderCircle,
  MapPin,
  Pencil,
  Trash2,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deleteEvent,
  type CalendarEventRow,
} from "@/lib/actions/calendar";
import { formatShortDate, formatTime } from "./calendar-utils";

interface EventDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CalendarEventRow | null;
  canEdit: boolean;
  canDelete: boolean;
  /** Ask the parent to open the edit dialog for this event. */
  onEditRequest: (event: CalendarEventRow) => void;
  onDeleted: () => void;
}


function DetailRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 shrink-0 text-muted-foreground">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground uppercase">
          {label}
        </p>
        <div className="mt-0.5 text-sm">{children}</div>
      </div>
    </div>
  );
}

/**
 * Read-only event detail dialog with Edit / Delete actions gated by the
 * caller's permissions. Delete uses a lightweight inline confirmation.
 */
export function EventDetailDialog({
  open,
  onOpenChange,
  event,
  canEdit,
  canDelete,
  onEditRequest,
  onDeleted,
}: EventDetailDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function handleDelete() {
    if (!event) return;
    setError(null);
    setConfirmingDelete(false);
    startTransition(async () => {
      const result = await deleteEvent(event.id);
      if (result.status === "error") {
        setError(result.error ?? "Could not delete the event.");
        return;
      }
      onDeleted();
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{event?.title ?? "Event"}</DialogTitle>
          <DialogDescription>
            Event details for your organization&apos;s calendar.
          </DialogDescription>
        </DialogHeader>

        {event && (
          <div className="grid gap-4 py-2">
            <DetailRow icon={<CalendarDays className="h-4 w-4" />} label="When">
              <p className="font-medium">
                {formatShortDate(new Date(event.startsAt))}
              </p>
              <p className="text-muted-foreground">
                {formatTime(event.startsAt)} – {formatTime(event.endsAt)}
                {event.allDay ? " (all day)" : ""}
              </p>
            </DetailRow>

            {event.location && (
              <DetailRow icon={<MapPin className="h-4 w-4" />} label="Location">
                <p>{event.location}</p>
              </DetailRow>
            )}

            {event.assignedTo && (
              <DetailRow icon={<User className="h-4 w-4" />} label="Assigned to">
                <p>{event.assignedTo.fullName ?? "Unnamed"}</p>
              </DetailRow>
            )}

            <DetailRow icon={<Clock className="h-4 w-4" />} label="Created by">
              <p>{event.createdBy.fullName ?? "Unnamed"}</p>
            </DetailRow>

            {event.description && (
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
                <p className="text-sm whitespace-pre-wrap">{event.description}</p>
              </div>
            )}

            {error && (
              <p
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </p>
            )}
          </div>
        )}

        <DialogFooter className="flex-wrap">
          {canEdit && (
            <Button
              variant="outline"
              onClick={() => event && onEditRequest(event)}
              disabled={isPending}
            >
              <Pencil />
              Edit
            </Button>
          )}

          {canDelete && !confirmingDelete && (
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmingDelete(true)}
              disabled={isPending}
            >
              <Trash2 />
              Delete
            </Button>
          )}

          {canDelete && confirmingDelete && (
            <>
              <span className="text-sm text-muted-foreground">
                Delete this event?
              </span>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isPending}
              >
                {isPending && (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                )}
                Yes, delete
              </Button>
              <Button
                variant="ghost"
                onClick={() => setConfirmingDelete(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
            </>
          )}

          <Button
            variant="ghost"
            className="ml-auto"
            onClick={() => {
              setConfirmingDelete(false);
              setError(null);
              onOpenChange(false);
            }}
            disabled={isPending}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}