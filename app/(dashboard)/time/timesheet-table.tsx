"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatDuration, formatTime } from "./format";
import type { TimeEntryRow } from "@/lib/actions/time-tracking";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";
import { LiveSessionTimer } from "./team-live-attendance";

export interface TimesheetTableProps {
  filtered: TimeEntryRow[];
  canManageTeam: boolean;
  isPending: boolean;
  onDelete: (id: string) => void;
  locale: Locale;
  platform: Dictionary["platform"];
}

export function TimesheetTable({
  filtered,
  canManageTeam,
  isPending,
  onDelete,
  locale,
  platform,
}: TimesheetTableProps) {
  const t = platform.time;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t.employee}</TableHead>
            <TableHead>{t.department}</TableHead>
            <TableHead>{t.date}</TableHead>
            <TableHead>{t.clockIn}</TableHead>
            <TableHead>{t.clockOut}</TableHead>
            <TableHead>{t.duration}</TableHead>
            <TableHead>{t.status}</TableHead>
            <TableHead>{t.notes}</TableHead>
            {canManageTeam && <TableHead className="text-right">{t.actions}</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell>
                <div>
                  <p className="font-medium text-sm">{entry.userName || "—"}</p>
                  <p className="text-xs text-muted-foreground">{entry.userEmail || "—"}</p>
                </div>
              </TableCell>
              <TableCell className="text-xs">{entry.departmentName || "—"}</TableCell>
              <TableCell className="text-xs">{formatDate(entry.clockedInAt, locale)}</TableCell>
              <TableCell className="font-mono text-xs tabular-nums">{formatTime(entry.clockedInAt, locale)}</TableCell>
              <TableCell className="font-mono text-xs tabular-nums">
                {entry.clockedOutAt ? formatTime(entry.clockedOutAt, locale) : "—"}
              </TableCell>
              <TableCell className="font-mono text-xs tabular-nums font-semibold">
                {entry.status === "active" ? (
                  <LiveSessionTimer clockedInAt={entry.clockedInAt} platform={platform} locale={locale} />
                ) : (
                  formatDuration(
                    entry.durationSeconds,
                    { hours: t.durationHours, minutes: t.durationMinutes, seconds: t.durationSeconds },
                    locale
                  )
                )}
              </TableCell>
              <TableCell>
                {entry.status === "active" ? (
                  <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600 text-white">
                    {t.active}
                  </Badge>
                ) : (
                  <Badge variant="secondary">{t.completed}</Badge>
                )}
              </TableCell>
              <TableCell className="max-w-[160px] truncate text-xs text-muted-foreground">
                {entry.notes || "—"}
              </TableCell>
              {canManageTeam && (
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isPending}
                    onClick={() => onDelete(entry.id)}
                    className="text-destructive hover:bg-destructive/10 text-xs h-8"
                  >
                    {t.deleteEntry}
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
