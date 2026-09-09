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

  if (!hasPermission("time_tracking.view_self", userContext.permissions)) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-2xl font-bold tracking-tight">Time Tracking</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You don&apos;t have permission to view time tracking.
          </p>
        </div>
      </div>
    );
  }

  const data = await getTimeTrackingData();

  if (!data) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-2xl font-bold tracking-tight">Time Tracking</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Could not load your time entries. Please try again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Time Tracking</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Clock in when you start work, clock out when you stop.
        </p>
      </div>

      <TimeTracker
        activeEntry={data.activeEntry}
        todayTotalSeconds={data.todayTotalSeconds}
        serverNowIso={data.serverNowIso}
        canManageSelf={data.canManageSelf}
      />

      {/* Personal log */}
      <div className="mt-8">
        <h2 className="mb-3 text-lg font-semibold tracking-tight">
          My recent entries
        </h2>
        {data.recentEntries.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center">
            <p className="text-sm font-medium">No time entries yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Your clock in / clock out history will appear here.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Clock in</TableHead>
                  <TableHead>Clock out</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">
                      {formatDate(entry.clockedInAt)}
                    </TableCell>
                    <TableCell>{formatTime(entry.clockedInAt)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {entry.clockedOutAt ? formatTime(entry.clockedOutAt) : "—"}
                    </TableCell>
                    <TableCell className="font-mono tabular-nums">
                      {entry.status === "active"
                        ? "In progress"
                        : formatDurationCompact(entry.durationSeconds)}
                    </TableCell>
                    <TableCell>
                      {entry.status === "active" ? (
                        <Badge variant="default">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Completed</Badge>
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
              Team attendance
            </h2>
          </div>
          {data.teamNow.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Nobody is clocked in right now.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Clocked in</TableHead>
                    <TableHead>Elapsed</TableHead>
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
                        <TableCell>{formatTime(member.clockedInAt)}</TableCell>
                        <TableCell className="font-mono tabular-nums">
                          {formatElapsed(elapsedSeconds)}
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
