"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatDate,
  formatDurationCompact,
  formatTime,
} from "./format";
import type { TimeEntryRow } from "@/lib/actions/time-tracking";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

export function EntriesTable({
  entries,
  locale,
  platform,
}: {
  entries: TimeEntryRow[];
  locale: Locale;
  platform: Dictionary["platform"];
}) {
  const t = platform.time;

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <p className="text-sm font-medium">{t.noEntriesYet}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t.noEntriesYetHint}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t.date}</TableHead>
            <TableHead>{t.clockInTime}</TableHead>
            <TableHead>{t.clockOutTime}</TableHead>
            <TableHead>{t.duration}</TableHead>
            <TableHead>{t.status}</TableHead>
            <TableHead>{t.notes}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="font-medium">
                {formatDate(entry.clockedInAt, locale)}
              </TableCell>
              <TableCell>{formatTime(entry.clockedInAt, locale)}</TableCell>
              <TableCell className="text-muted-foreground">
                {entry.clockedOutAt ? formatTime(entry.clockedOutAt, locale) : "—"}
              </TableCell>
              <TableCell className="font-mono tabular-nums">
                {entry.status === "active"
                  ? t.inProgress
                  : formatDurationCompact(
                      entry.durationSeconds,
                      {
                        hours: t.durationHours,
                        minutes: t.durationMinutes,
                        seconds: t.durationSeconds,
                      },
                      locale
                    )}
              </TableCell>
              <TableCell>
                {entry.status === "active" ? (
                  <Badge variant="default">{t.active}</Badge>
                ) : (
                  <Badge variant="secondary">{t.completed}</Badge>
                )}
              </TableCell>
              <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                {entry.notes || "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
