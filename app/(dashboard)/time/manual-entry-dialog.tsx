"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { adminAddManualEntry } from "@/lib/actions/time-tracking";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

interface ManualEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamMembers: { userId: string; fullName: string; email: string; departmentName: string | null }[];
  locale: Locale;
  platform: Dictionary["platform"];
}

export function ManualEntryDialog({
  open,
  onOpenChange,
  teamMembers,
  platform,
}: ManualEntryDialogProps) {
  const t = platform.time;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split("T")[0];
  const [userId, setUserId] = useState<string>(teamMembers[0]?.userId || "");
  const [inDate, setInDate] = useState<string>(todayStr);
  const [inTime, setInTime] = useState<string>("09:00");
  const [outDate, setOutDate] = useState<string>(todayStr);
  const [outTime, setOutTime] = useState<string>("17:00");
  const [notes, setNotes] = useState<string>("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!userId) {
      setError(t.errors.selectEmployeeRequired || "Please select an employee");
      return;
    }

    const startIso = new Date(`${inDate}T${inTime}:00`).toISOString();
    const endIso = new Date(`${outDate}T${outTime}:00`).toISOString();

    if (new Date(endIso) <= new Date(startIso)) {
      setError(t.errors.invalidTimeRange);
      return;
    }

    startTransition(async () => {
      const res = await adminAddManualEntry({
        userId,
        clockedInAt: startIso,
        clockedOutAt: endIso,
        notes: notes.trim(),
      });

      if (res.status === "error") {
        setError(res.error || t.errors.manualEntryFailed);
      } else {
        onOpenChange(false);
        setNotes("");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t.addManualEntry}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>{t.employee}</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger>
                <SelectValue placeholder={t.employee} />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {m.fullName} {m.departmentName ? `(${m.departmentName})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t.clockInDate}</Label>
              <Input
                type="date"
                value={inDate}
                onChange={(e) => setInDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.clockInTimeLabel}</Label>
              <Input
                type="time"
                value={inTime}
                onChange={(e) => setInTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t.clockOutDate}</Label>
              <Input
                type="date"
                value={outDate}
                onChange={(e) => setOutDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.clockOutTimeLabel}</Label>
              <Input
                type="time"
                value={outTime}
                onChange={(e) => setOutTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t.notes}</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t.notesPlaceholder}
              rows={3}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {t.cancel}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? t.saving : t.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
