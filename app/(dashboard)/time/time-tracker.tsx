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
import { formatDurationCompact, formatElapsed } from "./format";

interface TimeTrackerProps {
  activeEntry: ActiveTimeEntry | null;
  todayTotalSeconds: number;
  /** Server render timestamp — seeds the timer so first paint is exact. */
  serverNowIso: string;
  canManageSelf: boolean;
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
}: TimeTrackerProps) {
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
        setError(result.error ?? "Could not clock you in. Please try again.");
      }
    });
  }

  function handleClockOut() {
    setError(null);
    startTransition(async () => {
      const result = await clockOut();
      if (result.status === "error") {
        setError(result.error ?? "Could not clock you out. Please try again.");
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
            <h2 className="text-sm font-semibold">Current session</h2>
          </div>
          {isClockedIn ? (
            <Badge variant="default">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
              Clocked in
            </Badge>
          ) : (
            <Badge variant="secondary">Clocked out</Badge>
          )}
        </div>

        <p
          className="mt-4 font-mono text-4xl font-bold tracking-tight tabular-nums"
          aria-live="off"
        >
          {isClockedIn ? formatElapsed(activeSeconds) : "00:00:00"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {isClockedIn
            ? "Session in progress — timer updates live."
            : "You're off the clock. Clock in to start a session."}
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
                {isPending ? "Clocking out…" : "Clock out"}
              </Button>
            ) : (
              <Button
                size="lg"
                className="w-full sm:w-auto"
                disabled={isPending}
                onClick={handleClockIn}
              >
                {isPending ? "Clocking in…" : "Clock in"}
              </Button>
            )
          ) : (
            <p className="text-sm text-muted-foreground">
              You don&apos;t have permission to clock in or out.
            </p>
          )}
        </div>
      </div>

      {/* Today's total card */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-sm font-semibold">Today&apos;s total</h2>
        <p className="mt-4 font-mono text-4xl font-bold tracking-tight tabular-nums">
          {formatDurationCompact(todayTotalSeconds)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {(todayTotalSeconds / 3600).toFixed(2)} hours across all
          sessions since midnight (UTC).
        </p>
      </div>
    </div>
  );
}
