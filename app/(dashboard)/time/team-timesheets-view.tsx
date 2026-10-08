"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { exportTimesheetsToCsv } from "./format";
import { deleteTimeEntry } from "@/lib/actions/time-tracking";
import { Download, Plus, Search } from "lucide-react";
import { ManualEntryDialog } from "./manual-entry-dialog";
import { TimesheetTable } from "./timesheet-table";
import type { TeamTabsProps } from "./team-live-attendance";

export function TeamTimesheetsView({
  teamInsights,
  canManageTeam,
  locale,
  platform,
}: TeamTabsProps) {
  const t = platform.time;
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const departments = Array.from(
    new Set(
      teamInsights.allTeamEntries
        .map((e) => e.departmentName)
        .filter((d): d is string => Boolean(d))
    )
  );

  const users = teamInsights.members;

  const filtered = teamInsights.allTeamEntries.filter((entry) => {
    if (selectedDepartment !== "all" && entry.departmentName !== selectedDepartment) {
      return false;
    }
    if (selectedUser !== "all" && entry.userId !== selectedUser) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = entry.userName?.toLowerCase().includes(q);
      const matchEmail = entry.userEmail?.toLowerCase().includes(q);
      const matchNotes = entry.notes?.toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchNotes) return false;
    }
    return true;
  });

  function handleExportCsv() {
    const filename = `timesheets_${new Date().toISOString().split("T")[0]}.csv`;
    exportTimesheetsToCsv(filtered, filename);
  }

  function handleDeleteEntry(entryId: string) {
    if (!confirm(t.deleteEntryConfirm)) return;
    setDeleteError(null);
    startTransition(async () => {
      const res = await deleteTimeEntry(entryId);
      if (res.status === "error") {
        setDeleteError(res.error || t.errors.deleteFailed || "Failed to delete entry");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold">{t.tabOrgTimesheets}</h3>
          <p className="text-sm text-muted-foreground">{t.orgTimesheetsSubtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManageTeam && (
            <Button
              size="sm"
              onClick={() => setDialogOpen(true)}
              className="gap-1 text-xs"
            >
              <Plus className="size-3.5" />
              {t.addManualEntry}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportCsv}
            disabled={filtered.length === 0}
            className="gap-1 text-xs"
          >
            <Download className="size-3.5" />
            {t.exportCsv}
          </Button>
        </div>
      </div>

      {deleteError && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {deleteError}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="ps-9 text-xs"
          />
        </div>

        {departments.length > 0 && (
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">{t.allDepartments}</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        )}

        {users.length > 0 && (
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">{t.allEmployees}</option>
            {users.map((u) => (
              <option key={u.userId} value={u.userId}>
                {u.fullName || u.email}
              </option>
            ))}
          </select>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm font-medium">{t.noEntriesYet}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t.noEntriesYetHint}</p>
        </div>
      ) : (
        <TimesheetTable
          filtered={filtered}
          canManageTeam={canManageTeam}
          isPending={isPending}
          onDelete={handleDeleteEntry}
          locale={locale}
          platform={platform}
        />
      )}

      {dialogOpen && (
        <ManualEntryDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          teamMembers={teamInsights.members}
          locale={locale}
          platform={platform}
        />
      )}
    </div>
  );
}

export const OrganizationTimesheetsView = TeamTimesheetsView;

