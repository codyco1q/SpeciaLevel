"use client";

import { useState } from "react";
import { formatDate, formatDurationCompact, formatHoursDecimal, localizeDigits } from "./format";
import { EntriesTable } from "./entries-table";
import { Button } from "@/components/ui/button";
import type { PersonalStats } from "@/lib/actions/time-tracking";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";
import { cn } from "@/lib/utils";

export interface PersonalWeeklyViewProps {
  personalStats: PersonalStats;
  locale: Locale;
  platform: Dictionary["platform"];
}

export function PersonalWeeklyView({ personalStats, locale, platform }: PersonalWeeklyViewProps) {
  const t = platform.time;
  const days = personalStats.weekDays;
  const entries = personalStats.weekEntries;
  const [filterDate, setFilterDate] = useState<string | null>(null);

  const filteredEntries = filterDate 
    ? entries.filter(e => e.clockedInAt.startsWith(filterDate))
    : entries;

  const maxSeconds = Math.max(1, ...days.map((d) => d.totalSeconds));
  const durationLabels = { hours: t.durationHours, minutes: t.durationMinutes, seconds: t.durationSeconds };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card p-4">
        <div>
          <h3 className="font-semibold">{t.tabWeekly}</h3>
          <p className="text-sm text-muted-foreground">{t.weeklySubtitle}</p>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div>
            <span className="text-muted-foreground">{t.weekTotal}: </span>
            <span className="font-mono font-bold">{formatDurationCompact(personalStats.weekSeconds, durationLabels, locale)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{t.averageDailyHours}: </span>
            <span className="font-mono font-bold">{formatHoursDecimal(personalStats.averageDailySecondsThisWeek, t.durationHours, locale)}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => setFilterDate(null)} disabled={!filterDate}>
            All Week
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {days.map((day) => {
          const d = new Date(day.date);
          const formattedWeekDay = new Intl.DateTimeFormat(locale, { weekday: "short" }).format(d);
          const formattedDate = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(d);
          
          const percentage = Math.min(100, Math.round((day.totalSeconds / maxSeconds) * 100));
          return (
            <div
              key={day.date}
              className={cn(
                "rounded-lg border p-3 transition-all cursor-pointer hover:border-primary/50",
                filterDate === day.date ? "border-primary bg-primary/10" : day.isToday ? "border-primary bg-primary/5 shadow-xs" : "border-border bg-card"
              )}
              onClick={() => setFilterDate(day.date)}
            >
              <div className="flex items-center justify-between text-xs">
                <span className={cn("font-semibold", day.isToday || filterDate === day.date ? "text-primary" : "text-muted-foreground")}>{formattedWeekDay}</span>
                {day.isToday && <span className="size-1.5 rounded-full bg-primary" />}
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{formattedDate}</p>
              <p className="mt-3 font-mono text-lg font-bold tabular-nums">{formatHoursDecimal(day.totalSeconds, t.durationHours, locale)}</p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${percentage}%` }} />
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">{localizeDigits(day.entriesCount, locale)} {t.totalSessions.toLowerCase()}</p>
            </div>
          );
        })}
      </div>

      <EntriesTable entries={filteredEntries} locale={locale} platform={platform} />
    </div>
  );
}
