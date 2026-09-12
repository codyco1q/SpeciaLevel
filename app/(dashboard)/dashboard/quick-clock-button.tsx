"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  clockIn,
  clockOut,
  type ActiveTimeEntry,
} from "@/lib/actions/time-tracking";
import { formatDurationCompact, formatElapsed } from "@/app/(dashboard)/time/format";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

interface QuickClockButtonProps {
  activeEntry: ActiveTimeEntry | null;
  todayTotalSeconds: number;
  /** Server render timestamp — seeds the live timer so first paint is exact. */
  serverNowIso: string;
  /** Whether the caller may clock in/out (time_tracking.manage_self). */
  canManageSelf: boolean;
  /** Localized copy + formatters for the current render. */
  platform: Dictionary["platform"];
  locale: Locale;
}

/**
 * Compact clock in / clock out control for the dashboard. Reuses the same
 * server actions as /time (clockIn / clockOut), which revalidate both
 * /time and /dashboard on success — fresh props arrive automatically.
 */
export function QuickClockButton({
  activeEntry,
  todayTotalSeconds,
  serverNowIso,
  canManageSelf,
  platform,
  locale,
}: QuickClockButtonProps) {
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
    <div>
      <div className="mb-3 flex items-center gap-2">
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
        className="font-mono text-3xl font-bold tracking-tight tabular-nums"
        aria-live="off"
      >
        {isClockedIn ? formatElapsed(activeSeconds, locale) : "00:00:00"}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {platform.dashboard.today}:{" "}
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

      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {canManageSelf ? (
        <div className="mt-4">
          {isClockedIn ? (
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={handleClockOut}
            >
              {isPending ? t.clockingOut : t.clockOut}
            </Button>
          ) : (
            <Button disabled={isPending} onClick={handleClockIn}>
              {isPending ? t.clockingIn : t.clockIn}
            </Button>
          )}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          {t.noClockPermission}
        </p>
      )}
    </div>
  );
}