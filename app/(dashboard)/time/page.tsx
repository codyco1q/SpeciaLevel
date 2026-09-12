import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { getCurrentUserContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/rbac";
import { getTimeTrackingData } from "@/lib/actions/time-tracking";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TimeTracker } from "./time-tracker";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import {
  formatDate,
  formatDurationCompact,
  formatElapsed,
  formatTime,
} from "./format";

export const dynamic = "force-dynamic";

export default async function TimeTrackingPage() {
  const userContext = await getCurrentUserContext();
  if (!userContext) redirect("/login");

  const organization = userContext.organization;
  if (!organization) redirect("/onboarding");

  const { platform } = await getDictionary();
  const locale = await getLocale();
  const t = platform.time;

  if (!hasPermission("time_tracking.view_self", userContext.permissions)) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-2xl font-bold tracking-tight">{t.noPermissionTitle}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t.noPermissionBody}</p>
        </div>
      </div>
    );
  }

  const data = await getTimeTrackingData();

  if (!data) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t.loadError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      <TimeTracker
        activeEntry={data.activeEntry}
        todayTotalSeconds={data.todayTotalSeconds}
        serverNowIso={data.serverNowIso}
        canManageSelf={data.canManageSelf}
        platform={platform}
        locale={locale}
      />

      {/* Personal log */}
      <div className="mt-8">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">
          {t.recentEntries}
        </h2>
        {data.recentEntries.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center">
            <p className="text-sm font-medium">{t.noEntriesYet}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t.noEntriesYetHint}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.date}</TableHead>
                  <TableHead>{t.clockInTime}</TableHead>
                  <TableHead>{t.clockOutTime}</TableHead>
                  <TableHead>{t.duration}</TableHead>
                  <TableHead>{t.status}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">
                      {formatDate(entry.clockedInAt, locale)}
                    </TableCell>
                    <TableCell>{formatTime(entry.clockedInAt, locale)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {entry.clockedOutAt
                        ? formatTime(entry.clockedOutAt, locale)
                        : "—"}
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Team attendance (managers and above) */}
      {data.canViewTeam && data.teamNow !== null && (
        <div className="mt-8">
          <div className="mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold tracking-tight">
              {t.teamAttendance}
            </h2>
          </div>
          {data.teamNow.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <p className="text-sm text-muted-foreground">
                {t.nobodyClockedIn}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.employee}</TableHead>
                    <TableHead>{t.department}</TableHead>
                    <TableHead>{t.clockedInAt}</TableHead>
                    <TableHead>{t.elapsed}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.teamNow.map((member) => {
                    const elapsedSeconds = Math.max(
                      0,
                      Math.floor(
                        (Date.parse(data.serverNowIso) -
                          Date.parse(member.clockedInAt)) /
                          1000
                      )
                    );
                    return (
                      <TableRow key={member.userId}>
                        <TableCell className="font-medium">
                          {member.fullName}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {member.departmentName ?? "—"}
                        </TableCell>
                        <TableCell>{formatTime(member.clockedInAt, locale)}</TableCell>
                        <TableCell className="font-mono tabular-nums">
                          {formatElapsed(elapsedSeconds, locale)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
