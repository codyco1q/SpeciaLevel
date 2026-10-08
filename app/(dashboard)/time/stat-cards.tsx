"use client";

import { Play, Square, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ActiveTimeEntry, PersonalStats } from "@/lib/actions/time-tracking";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";
import { formatDuration, formatDurationCompact, formatHoursDecimal, formatTime, localizeDigits } from "./format";

interface StatCardsProps {
  activeEntry: ActiveTimeEntry | null;
  activeSeconds: number;
  personalStats: PersonalStats;
  canManageSelf: boolean;
  isPending: boolean;
  onClockIn: () => void;
  onClockOut: () => void;
  locale: Locale;
  platform: Dictionary["platform"];
}

export function StatCards({
  activeEntry,
  activeSeconds,
  personalStats,
  canManageSelf,
  isPending,
  onClockIn,
  onClockOut,
  locale,
  platform,
}: StatCardsProps) {
  const t = platform.time;
  const labels = { hours: t.durationHours, minutes: t.durationMinutes, seconds: t.durationSeconds };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.status}</p>
            <div className="mt-1 flex items-center gap-2">
              {activeEntry ? (
                <Badge variant="default" className="gap-1 bg-emerald-600 hover:bg-emerald-600 text-white">
                  <span className="inline-block size-1.5 rounded-full bg-white animate-pulse" />
                  {t.active}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">{t.idle}</Badge>
              )}
            </div>
          </div>
          {activeEntry && (
            <span className="text-xs text-muted-foreground">{t.clockInTime}: {formatTime(activeEntry.clockedInAt, locale)}</span>
          )}
        </div>
        <div className="my-4">
          <p className="font-mono text-3xl font-bold tabular-nums tracking-tight">{formatDuration(activeSeconds, labels, locale)}</p>
        </div>
        <div>
          {canManageSelf ? (
            activeEntry ? (
              <Button variant="destructive" className="w-full gap-2 font-semibold shadow-xs" disabled={isPending} onClick={onClockOut}>
                {isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Square className="size-4 fill-current" />}
                {isPending ? t.clockingOut : t.clockOut}
              </Button>
            ) : (
              <Button className="w-full gap-2 font-semibold shadow-xs" disabled={isPending} onClick={onClockIn}>
                {isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Play className="size-4 fill-current" />}
                {isPending ? t.clockingIn : t.clockIn}
              </Button>
            )
          ) : (
            <p className="text-xs text-muted-foreground">{t.noClockPermission}</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.todayTotal}</p>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums">{formatDurationCompact(personalStats.todaySeconds, labels, locale)}</p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{formatHoursDecimal(personalStats.todaySeconds, t.durationHours, locale)}</p>
        </div>
        <p className="mt-4 text-xs text-muted-foreground border-t border-border/50 pt-2">
          {localizeDigits(personalStats.todayEntries.length, locale)} {t.totalSessions.toLowerCase()}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.weekTotal}</p>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums">{formatDurationCompact(personalStats.weekSeconds, labels, locale)}</p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{formatHoursDecimal(personalStats.weekSeconds, t.durationHours, locale)}</p>
        </div>
        <p className="mt-4 text-xs text-muted-foreground border-t border-border/50 pt-2">
          {t.averageDailyHours}:{" "}
          <span className="font-mono font-semibold text-foreground">
            {formatHoursDecimal(personalStats.averageDailySecondsThisWeek, t.durationHours, locale)}
          </span>
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.monthTotal}</p>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums">{formatDurationCompact(personalStats.monthSeconds, labels, locale)}</p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{formatHoursDecimal(personalStats.monthSeconds, t.durationHours, locale)}</p>
        </div>
        <p className="mt-4 text-xs text-muted-foreground border-t border-border/50 pt-2">
          {localizeDigits(personalStats.totalSessionsThisMonth, locale)} {t.totalSessions.toLowerCase()}
        </p>
      </div>
    </div>
  );
}
