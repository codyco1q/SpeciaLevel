"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatHoursDecimal } from "./format";
import type { TeamInsights } from "@/lib/actions/time-tracking";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";
import type { TeamTabsProps } from "./team-live-attendance";

function TeamMemberSummaryTable({
  members,
  locale,
  platform,
}: {
  members: TeamInsights["members"];
  locale: Locale;
  platform: Dictionary["platform"];
}) {
  const t = platform.time;
  if (members.length === 0) return null;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-foreground">{t.employeeSummary}</h4>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.employee}</TableHead>
              <TableHead>{t.department}</TableHead>
              <TableHead>{t.todayTotal}</TableHead>
              <TableHead>{t.weekTotal}</TableHead>
              <TableHead>{t.monthTotal}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.userId}>
                <TableCell>
                  <div>
                    <p className="font-medium text-sm">{member.fullName}</p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </div>
                </TableCell>
                <TableCell className="text-xs">{member.departmentName || "—"}</TableCell>
                <TableCell className="font-mono tabular-nums">
                  {formatHoursDecimal(member.todaySeconds, t.durationHours, locale)}
                </TableCell>
                <TableCell className="font-mono tabular-nums">
                  {formatHoursDecimal(member.weekSeconds, t.durationHours, locale)}
                </TableCell>
                <TableCell className="font-mono tabular-nums">
                  {formatHoursDecimal(member.monthSeconds, t.durationHours, locale)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function TeamInsightsView({
  teamInsights,
  locale,
  platform,
}: TeamTabsProps) {
  const t = platform.time;
  const deptHours = teamInsights.departments;
  const members = teamInsights.members;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card p-4">
        <div>
          <h3 className="font-semibold">{t.tabTeamInsights}</h3>
          <p className="text-sm text-muted-foreground">{t.teamInsightsSubtitle}</p>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div>
            <span className="text-muted-foreground">{t.totalTeamHoursWeek}: </span>
            <span className="font-mono font-bold">
              {formatHoursDecimal(teamInsights.teamWeekSeconds, t.durationHours, locale)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">{t.totalTeamHoursMonth}: </span>
            <span className="font-mono font-bold">
              {formatHoursDecimal(teamInsights.teamMonthSeconds, t.durationHours, locale)}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">{t.departmentSummary}</h4>
        {deptHours.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            {t.noData}
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.department}</TableHead>
                  <TableHead>{t.todayTotal}</TableHead>
                  <TableHead>{t.weekTotal}</TableHead>
                  <TableHead>{t.monthTotal}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deptHours.map((dept) => (
                  <TableRow key={dept.departmentId || dept.departmentName}>
                    <TableCell className="font-medium text-sm">{dept.departmentName}</TableCell>
                    <TableCell className="font-mono tabular-nums">
                      {formatHoursDecimal(dept.todaySeconds, t.durationHours, locale)}
                    </TableCell>
                    <TableCell className="font-mono tabular-nums">
                      {formatHoursDecimal(dept.weekSeconds, t.durationHours, locale)}
                    </TableCell>
                    <TableCell className="font-mono tabular-nums">
                      {formatHoursDecimal(dept.monthSeconds, t.durationHours, locale)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <TeamMemberSummaryTable members={members} locale={locale} platform={platform} />
    </div>
  );
}

