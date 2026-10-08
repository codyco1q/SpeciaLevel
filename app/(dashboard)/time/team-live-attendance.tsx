"use client";

import { useState, useEffect, useTransition } from "react";
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
import { formatDuration, formatTime, localizeDigits } from "./format";
import { adminClockOutUser } from "@/lib/actions/time-tracking";
import type { TeamInsights } from "@/lib/actions/time-tracking";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";
import { StopCircle, Users } from "lucide-react";

export interface TeamTabsProps {
  teamInsights: TeamInsights;
  canManageTeam: boolean;
  locale: Locale;
  platform: Dictionary["platform"];
}

export function LiveSessionTimer({
  clockedInAt,
  platform,
  locale,
}: {
  clockedInAt: string;
  platform: Dictionary["platform"];
  locale: Locale;
}) {
  const t = platform.time;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const elapsedSeconds = Math.max(0, Math.floor((now - new Date(clockedInAt).getTime()) / 1000));

  return (
    <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">
      {formatDuration(
        elapsedSeconds,
        {
          hours: t.durationHours,
          minutes: t.durationMinutes,
          seconds: t.durationSeconds,
        },
        locale
      )}
    </span>
  );
}


export function LiveAttendanceView({
  teamInsights,
  canManageTeam,
  locale,
  platform,
}: TeamTabsProps) {
  const t = platform.time;
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const activeUsers = teamInsights.members.filter((m) => m.isClockedIn);

  function handleForceClockOut(userId: string) {
    if (!confirm(t.forceClockOutConfirm)) return;
    setActionError(null);
    startTransition(async () => {
      const res = await adminClockOutUser(userId);
      if (res.status === "error") {
        setActionError(res.error || t.errors.clockOutFailed);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card p-4">
        <div>
          <h3 className="font-semibold">{t.tabLiveAttendance}</h3>
          <p className="text-sm text-muted-foreground">{t.liveAttendanceSubtitle}</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <Badge variant="outline" className="gap-1.5 py-1 text-xs">
            <span className="inline-block size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-foreground">
              {localizeDigits(teamInsights.currentlyClockedInCount, locale)} / {localizeDigits(teamInsights.totalEmployeesCount, locale)}
            </span>
            <span className="text-muted-foreground">{t.activeEmployees.toLowerCase()}</span>
          </Badge>
        </div>
      </div>

      {actionError && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {actionError}
        </div>
      )}

      {activeUsers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <Users className="mx-auto size-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium">{t.noActiveSessions}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t.noActiveSessionsHint}</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.employee}</TableHead>
                <TableHead>{t.department}</TableHead>
                <TableHead>{t.clockedInAt}</TableHead>
                <TableHead>{t.currentDuration}</TableHead>
                <TableHead>{t.status}</TableHead>
                {canManageTeam && <TableHead className="text-right">{t.actions}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeUsers.map((user) => (
                <TableRow key={user.userId}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{user.fullName}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">{user.departmentName || "—"}</TableCell>
                  <TableCell className="font-mono text-xs tabular-nums">
                    {user.activeClockedInAt ? formatTime(user.activeClockedInAt, locale) : "—"}
                  </TableCell>
                  <TableCell>
                    {user.activeClockedInAt ? (
                      <LiveSessionTimer clockedInAt={user.activeClockedInAt} platform={platform} locale={locale} />
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600 text-white gap-1 text-[10px]">
                      <span className="inline-block size-1.5 rounded-full bg-white animate-pulse" />
                      {t.liveTracking}
                    </Badge>
                  </TableCell>
                  {canManageTeam && (
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={isPending}
                        onClick={() => handleForceClockOut(user.userId)}
                        className="gap-1 text-xs h-8"
                      >
                        <StopCircle className="size-3.5" />
                        {t.forceClockOut}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
