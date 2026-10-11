"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDate, formatDurationCompact, formatHoursDecimal, localizeDigits } from "./format";
import { EntriesTable } from "./entries-table";
import type { PersonalStats } from "@/lib/actions/time-tracking";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";
export { PersonalWeeklyView } from "./personal-weekly-view";

export interface PersonalTabsProps {
  personalStats: PersonalStats;
  locale: Locale;
  platform: Dictionary["platform"];
}

export function PersonalDailyView({ personalStats, locale, platform }: PersonalTabsProps) {
  const t = platform.time;
  const entries = personalStats.todayEntries;
  const durationLabels = { hours: t.durationHours, minutes: t.durationMinutes, seconds: t.durationSeconds };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card p-4">
        <div>
          <h3 className="font-semibold">{t.tabDaily}</h3>
          <p className="text-sm text-muted-foreground">{t.dailySubtitle}</p>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div>
            <span className="text-muted-foreground">{t.todayTotal}: </span>
            <span className="font-mono font-bold">{formatDurationCompact(personalStats.todaySeconds, durationLabels, locale)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{t.totalSessions}: </span>
            <span className="font-semibold">{localizeDigits(entries.length, locale)}</span>
          </div>
        </div>
      </div>
      <EntriesTable entries={entries} locale={locale} platform={platform} />
    </div>
  );
}

export function PersonalMonthlyView({ personalStats, locale, platform }: PersonalTabsProps) {
  const t = platform.time;
  const weeks = personalStats.monthWeeks;
  const entries = personalStats.monthEntries;
  const durationLabels = { hours: t.durationHours, minutes: t.durationMinutes, seconds: t.durationSeconds };

  const [filterWeek, setFilterWeek] = useState<number | null>(null);

  const selectedWeekObj = filterWeek !== null ? weeks.find((w) => w.weekNumber === filterWeek) : null;

  const filteredEntries = selectedWeekObj
    ? entries.filter((e) => {
        const dateStr = e.clockedInAt.split("T")[0];
        return dateStr >= selectedWeekObj.startDate && dateStr <= selectedWeekObj.endDate;
      })
    : entries;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card p-4">
        <div>
          <h3 className="font-semibold">{t.tabMonthly}</h3>
          <p className="text-sm text-muted-foreground">{t.monthlySubtitle}</p>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div>
            <span className="text-muted-foreground">{t.monthTotal}: </span>
            <span className="font-mono font-bold">{formatDurationCompact(personalStats.monthSeconds, durationLabels, locale)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{t.totalSessions}: </span>
            <span className="font-semibold">{localizeDigits(personalStats.totalSessionsThisMonth, locale)}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilterWeek(null)}
            disabled={filterWeek === null}
          >
            All Month
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {weeks.map((week) => {
          const isSelected = filterWeek === week.weekNumber;
          return (
            <div
              key={week.weekNumber}
              onClick={() => setFilterWeek(isSelected ? null : week.weekNumber)}
              className={cn(
                "rounded-lg border p-4 transition-all cursor-pointer hover:border-primary/50",
                isSelected
                  ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/40"
                  : week.isCurrentWeek
                  ? "border-primary bg-primary/5 shadow-xs"
                  : "border-border bg-card"
              )}
            >
              <div className="flex items-center justify-between text-xs">
                <span className={cn("font-semibold", isSelected || week.isCurrentWeek ? "text-primary" : "text-muted-foreground")}>
                  {week.weekLabel}
                </span>
                {week.isCurrentWeek && <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4">{t.active}</Badge>}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">{formatDate(week.startDate, locale)} – {formatDate(week.endDate, locale)}</p>
              <p className="mt-3 font-mono text-xl font-bold tabular-nums">{formatHoursDecimal(week.totalSeconds, t.durationHours, locale)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{localizeDigits(week.entriesCount, locale)} {t.totalSessions.toLowerCase()}</p>
            </div>
          );
        })}
      </div>

      <EntriesTable entries={filteredEntries} locale={locale} platform={platform} />
    </div>
  );
}
