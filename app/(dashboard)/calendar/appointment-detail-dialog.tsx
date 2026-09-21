"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Calendar,
  Clock,
  User,
  Mail,
  Phone,
  FileText,
  Building2,
  AlertTriangle,
  LoaderCircle,
  XCircle,
  CheckCircle2,
} from "lucide-react";
import { cancelAppointment } from "@/lib/actions/calendar";
import type { AppointmentRow } from "@/lib/validations/calendar";
import Link from "next/link";

interface AppointmentDetailDialogProps {
  appointment: AppointmentRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAppointmentCancelled: (appointmentId: string) => void;
  canManage: boolean;
  dictionary?: Record<string, any>;
}

function formatAppointmentDateTime(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);

  const datePart = start.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const startTimePart = start.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  const endTimePart = end.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${datePart} · ${startTimePart} – ${endTimePart}`;
}

export function AppointmentDetailDialog({
  appointment,
  open,
  onOpenChange,
  onAppointmentCancelled,
  canManage,
  dictionary,
}: AppointmentDetailDialogProps) {
  const t = dictionary?.platform?.calendar ?? {
    statusConfirmed: "Confirmed",
    statusCancelled: "Cancelled",
    statusCompleted: "Completed",
    client: "Client",
    host: "Host",
    duration: "Duration",
    dateTime: "Date & Time",
    notes: "Notes",
    cancelAppointment: "Cancel Appointment",
    cancelConfirmTitle: "Cancel this appointment?",
    cancelConfirmBody:
      "Are you sure you want to cancel this appointment? The client slot will be released.",
    cancelReasonPlaceholder: "Optional cancellation reason...",
    crmContact: "CRM Contact",
    crmDeal: "CRM Deal",
    viewContact: "View Contact",
    viewDeal: "View Deal",
  };

  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  if (!appointment) return null;

  const durationMin = Math.round(
    (new Date(appointment.endTime).getTime() -
      new Date(appointment.startTime).getTime()) /
      60000
  );

  const handleCancel = async () => {
    setCancelling(true);
    setCancelError(null);

    try {
      const res = await cancelAppointment(appointment.id, cancelReason.trim());
      if (res.status === "error") {
        setCancelError(res.error);
      } else {
        onAppointmentCancelled(appointment.id);
        setConfirmCancelOpen(false);
        onOpenChange(false);
      }
    } catch (err: any) {
      setCancelError(err?.message || "Failed to cancel appointment.");
    } finally {
      setCancelling(false);
    }
  };

  const statusBadge =
    appointment.status === "confirmed" ? (
      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-200">
        <CheckCircle2 className="size-3 mr-1" />
        {t.statusConfirmed}
      </Badge>
    ) : appointment.status === "cancelled" ? (
      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
        <XCircle className="size-3 mr-1" />
        {t.statusCancelled}
      </Badge>
    ) : (
      <Badge variant="outline" className="bg-muted text-muted-foreground">
        {t.statusCompleted}
      </Badge>
    );

  return (
    <>
      <Dialog open={open && !confirmCancelOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2 pr-6">
              <DialogTitle className="text-xl font-bold truncate">
                {appointment.clientName}
              </DialogTitle>
              {statusBadge}
            </div>
            <DialogDescription className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
              <Calendar className="size-3.5" />
              {formatAppointmentDateTime(
                appointment.startTime,
                appointment.endTime
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Client Info Card */}
            <div className="rounded-lg border border-border bg-card p-3 space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t.client}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <User className="size-4 text-muted-foreground shrink-0" />
                  <span className="font-medium truncate">{appointment.clientName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="size-4 text-muted-foreground shrink-0" />
                  <a
                    href={`mailto:${appointment.clientEmail}`}
                    className="text-primary hover:underline truncate"
                  >
                    {appointment.clientEmail}
                  </a>
                </div>
                {appointment.clientPhone && (
                  <div className="flex items-center gap-2">
                    <Phone className="size-4 text-muted-foreground shrink-0" />
                    <a
                      href={`tel:${appointment.clientPhone}`}
                      className="text-primary hover:underline"
                    >
                      {appointment.clientPhone}
                    </a>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-muted-foreground shrink-0" />
                  <span>{durationMin} minutes</span>
                </div>
              </div>
            </div>

            {/* Host info */}
            {appointment.host && (
              <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-muted/20 text-sm">
                <span className="text-muted-foreground font-medium">{t.host}:</span>
                <span className="font-semibold text-foreground">
                  {appointment.host.fullName || appointment.host.email}
                </span>
              </div>
            )}

            {/* Notes */}
            {appointment.notes && (
              <div className="rounded-lg border border-border bg-card p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <FileText className="size-3.5" />
                  {t.notes}
                </div>
                <p className="text-sm whitespace-pre-wrap text-foreground/90">
                  {appointment.notes}
                </p>
              </div>
            )}

            {/* CRM Links */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {appointment.contact ? (
                <div className="rounded-lg border border-border p-3 space-y-1 bg-muted/10">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <User className="size-3.5" />
                    {t.crmContact}
                  </div>
                  <div className="font-semibold text-sm truncate">
                    {appointment.contact.name}
                  </div>
                  <Link
                    href={`/contacts/${appointment.contact.id}`}
                    className="text-xs text-primary hover:underline inline-block mt-1"
                  >
                    {t.viewContact} →
                  </Link>
                </div>
              ) : null}

              {appointment.deal ? (
                <div className="rounded-lg border border-border p-3 space-y-1 bg-muted/10">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Building2 className="size-3.5" />
                    {t.crmDeal}
                  </div>
                  <div className="font-semibold text-sm truncate">
                    {appointment.deal.title}
                  </div>
                  <div className="text-xs text-muted-foreground capitalize">
                    Stage: {appointment.deal.stage}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 justify-between items-center pt-2">
            <div>
              {canManage && appointment.status === "confirmed" && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirmCancelOpen(true)}
                >
                  <AlertTriangle className="size-4 mr-1.5" />
                  {t.cancelAppointment}
                </Button>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Confirmation Dialog */}
      <Dialog open={confirmCancelOpen} onOpenChange={setConfirmCancelOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              {t.cancelConfirmTitle}
            </DialogTitle>
            <DialogDescription>{t.cancelConfirmBody}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {cancelError && (
              <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive font-medium">
                {cancelError}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="cancel-reason" className="text-sm">
                Reason (Optional)
              </Label>
              <Input
                id="cancel-reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder={t.cancelReasonPlaceholder}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmCancelOpen(false)}
              disabled={cancelling}
            >
              Back
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? (
                <>
                  <LoaderCircle className="size-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                "Confirm Cancellation"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

