"use client";

import { useEffect, useState, useTransition } from "react";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  clockIn,
  clockOut,
  type ActiveTimeEntry,
} from "@/lib/actions/time-tracking";
import { formatDurationCompact, formatElapsed, localizeDigits } from "./format";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

interface TimeTrackerProps {
  activeEntry: ActiveTimeEntry | null;
  todayTotalSeconds: number;
  /** Server render timestamp — seeds the timer so first paint is exact. */
  serverNowIso: string;
  canManageSelf: boolean;
  /** Localized copy + formatters for the current render. */
  platform: Dictionary["platform"];
  locale: Locale;
}

/**
 * Interactive tracker card: status badge, live ticking timer while an
 * entry is open, today's total, and the Clock In / Clock Out button.
 *
 * Server actions revalidate /time on success, so fresh props (new active
 * entry, updated totals) arrive automatically — no manual refetch.
 */
export function TimeTracker({
  activeEntry,
  todayTotalSeconds,
  serverNowIso,
  canManageSelf,
  platform,
  locale,
}: TimeTrackerProps) {
  const t = platform.time;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Live clock. Seeded from the server timestamp so SSR and hydration
  // agree on first paint; the interval takes over on the client.
  const [now, setNow] = useState(() => Date.parse(serverNowIso));
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isClockedIn = activeEntry !== null;
  const activeSeconds = isClockedIn
    ? Math.max(0, Math.floor((now - Date.parse(activeEntry.clockedInAt)) / 1000))
    : 0;

  function handleClockIn() {
    setError(null);
    startTransition(async () => {
      const result = await clockIn();
      if (result.status === "error") {
        setError(result.error ?? t.errors.clockInFailed);
      }
    });
  }

  function handleClockOut() {
    setError(null);
    startTransition(async () => {
      const result = await clockOut();
      if (result.status === "error") {
        setError(result.error ?? t.errors.clockOutFailed);
      }
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Tracker card */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">{t.currentSession}</h2>
          </div>
          {isClockedIn ? (
            <Badge variant="default">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
              {t.clockedIn}
            </Badge>
          ) : (
            <Badge variant="secondary">{t.clockedOut}</Badge>
          )}
        </div>

        <p
          className="mt-4 font-mono text-4xl font-bold tracking-tight tabular-nums"
          aria-live="off"
        >
          {isClockedIn ? formatElapsed(activeSeconds, locale) : "00:00:00"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {isClockedIn ? t.sessionInProgress : t.sessionIdle}
        </p>

        {error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mt-4">
          {canManageSelf ? (
            isClockedIn ? (
              <Button
                variant="destructive"
                size="lg"
                className="w-full sm:w-auto"
                disabled={isPending}
                onClick={handleClockOut}
              >
                {isPending ? t.clockingOut : t.clockOut}
              </Button>
            ) : (
              <Button
                size="lg"
                className="w-full sm:w-auto"
                disabled={isPending}
                onClick={handleClockIn}
              >
                {isPending ? t.clockingIn : t.clockIn}
              </Button>
            )
          ) : (
            <p className="text-sm text-muted-foreground">
              {t.noClockPermission}
            </p>
          )}
        </div>
      </div>

      {/* Today's total card */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-sm font-semibold">{t.todayTotal}</h2>
        <p className="mt-4 font-mono text-4xl font-bold tracking-tight tabular-nums">
          {formatDurationCompact(
            todayTotalSeconds,
            {
              hours: t.durationHours,
              minutes: t.durationMinutes,
              seconds: t.durationSeconds,
            },
            locale
          )}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t.todayTotalHint.replace(
            "{hours}",
            localizeDigits((todayTotalSeconds / 3600).toFixed(2), locale)
          )}
        </p>
      </div>
    </div>
  );
}
