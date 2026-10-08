"use client";

import { useEffect, useState, useTransition } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { clockIn, clockOut } from "@/lib/actions/time-tracking";
import type { TimeTrackingData } from "@/lib/actions/time-tracking";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";
import { StatCards } from "./stat-cards";
import {
  PersonalDailyView,
  PersonalWeeklyView,
  PersonalMonthlyView,
} from "./personal-tabs";
import {
  LiveAttendanceView,
  TeamInsightsView,
  OrganizationTimesheetsView,
} from "./team-tabs";

interface TimeTrackerProps {
  initialData: TimeTrackingData;
  locale: Locale;
  platform: Dictionary["platform"];
}

export function TimeTracker({
  initialData,
  locale,
  platform,
}: TimeTrackerProps) {
  const t = platform.time;
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const { activeEntry, personalStats, teamInsights, canViewTeam, canManageTeam, canManageSelf } = initialData;

  const [activeSeconds, setActiveSeconds] = useState<number>(() => {
    if (!activeEntry) return 0;
    const started = new Date(activeEntry.clockedInAt).getTime();
    return Math.max(0, Math.floor((Date.now() - started) / 1000));
  });

  useEffect(() => {
    if (!activeEntry) {
      setActiveSeconds(0);
      return;
    }
    const started = new Date(activeEntry.clockedInAt).getTime();
    setActiveSeconds(Math.max(0, Math.floor((Date.now() - started) / 1000)));

    const interval = setInterval(() => {
      setActiveSeconds(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    }, 1000);

    return () => clearInterval(interval);
  }, [activeEntry]);

  function handleClockIn() {
    setActionError(null);
    startTransition(async () => {
      const res = await clockIn();
      if (res.status === "error") {
        setActionError(res.error || t.errors.clockInFailed);
      }
    });
  }

  function handleClockOut() {
    setActionError(null);
    startTransition(async () => {
      const res = await clockOut();
      if (res.status === "error") {
        setActionError(res.error || t.errors.clockOutFailed);
      }
    });
  }

  return (
    <div className="space-y-8">
      {/* 4 Top KPI Metric Cards */}
      <StatCards
        activeEntry={activeEntry}
        activeSeconds={activeSeconds}
        personalStats={personalStats}
        canManageSelf={canManageSelf}
        isPending={isPending}
        onClockIn={handleClockIn}
        onClockOut={handleClockOut}
        locale={locale}
        platform={platform}
      />

      {actionError && (
        <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive font-medium">
          {actionError}
        </div>
      )}

      {/* Tabbed Breakdown Views */}
      <Tabs defaultValue="daily" className="space-y-6">
        <div className="border-b border-border pb-1 overflow-x-auto">
          <TabsList className="h-10 p-1 bg-muted/60">
            <TabsTrigger value="daily" className="px-3.5 text-xs sm:text-sm">
              {t.tabDaily}
            </TabsTrigger>
            <TabsTrigger value="weekly" className="px-3.5 text-xs sm:text-sm">
              {t.tabWeekly}
            </TabsTrigger>
            <TabsTrigger value="monthly" className="px-3.5 text-xs sm:text-sm">
              {t.tabMonthly}
            </TabsTrigger>

            {canViewTeam && teamInsights && (
              <>
                <div className="h-4 w-px bg-border mx-1 my-auto" />
                <TabsTrigger value="liveAttendance" className="px-3.5 text-xs sm:text-sm">
                  {t.tabLiveAttendance}
                </TabsTrigger>
                <TabsTrigger value="teamInsights" className="px-3.5 text-xs sm:text-sm">
                  {t.tabTeamInsights}
                </TabsTrigger>
                <TabsTrigger value="timesheets" className="px-3.5 text-xs sm:text-sm">
                  {t.tabTimesheets}
                </TabsTrigger>
              </>
            )}
          </TabsList>
        </div>

        <TabsContent value="daily" className="mt-0">
          <PersonalDailyView
            personalStats={personalStats}
            locale={locale}
            platform={platform}
          />
        </TabsContent>

        <TabsContent value="weekly" className="mt-0">
          <PersonalWeeklyView
            personalStats={personalStats}
            locale={locale}
            platform={platform}
          />
        </TabsContent>

        <TabsContent value="monthly" className="mt-0">
          <PersonalMonthlyView
            personalStats={personalStats}
            locale={locale}
            platform={platform}
          />
        </TabsContent>

        {canViewTeam && teamInsights && (
          <>
            <TabsContent value="liveAttendance" className="mt-0">
              <LiveAttendanceView
                teamInsights={teamInsights}
                canManageTeam={canManageTeam}
                locale={locale}
                platform={platform}
              />
            </TabsContent>

            <TabsContent value="teamInsights" className="mt-0">
              <TeamInsightsView
                teamInsights={teamInsights}
                canManageTeam={canManageTeam}
                locale={locale}
                platform={platform}
              />
            </TabsContent>

            <TabsContent value="timesheets" className="mt-0">
              <OrganizationTimesheetsView
                teamInsights={teamInsights}
                canManageTeam={canManageTeam}
                locale={locale}
                platform={platform}
              />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}

