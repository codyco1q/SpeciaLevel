"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  getAutomationLogs,
  type AutomationLogRow,
} from "@/lib/actions/automations";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";
import {
  AUTOMATION_LOG_STATUS_BADGE_CLASSES,
  formatAutomationDate,
} from "./automation-meta";

interface LogsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Automation whose history is being inspected. */
  automation: {
    id: string;
    name: string;
  } | null;
  /** Localized copy + formatters for the current render. */
  platform: Dictionary["platform"];
  locale: Locale;
}

/**
 * Execution-history drawer. Fetches the last 100 runs for an automation
 * whenever the dialog opens (with a cancelled-guard so a stale response
 * that lands after the dialog closes is dropped). Status is rendered as a
 * colored pill: green success / red failure / blue running.
 */
export function LogsDialog({
  open,
  onOpenChange,
  automation,
  platform,
  locale,
}: LogsDialogProps) {
  const t = platform.automations;
  const [logs, setLogs] = useState<AutomationLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !automation) return;
    let cancelled = false;
    // Defer the loading/error reset into a microtask so setState never
    // runs synchronously in the effect body (react-hooks/set-state-in-effect).
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
    });
    getAutomationLogs(automation.id).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (result.status === "error") {
        setError(result.error);
        setLogs([]);
      } else {
        setLogs(result.logs);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, automation]);

  const statusLabel = (status: string) =>
    status === "success"
      ? t.history.success
      : status === "failed"
        ? t.history.failed
        : t.history.running;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t.history.title}</DialogTitle>
          <DialogDescription>
            {automation ? `${automation.name} — ${t.history.description}` : t.history.description}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t.history.loading ?? "Loading…"}
          </p>
        ) : error ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        ) : logs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">{t.history.noLogsYet}</p>
          </div>
        ) : (
          <div className="max-h-[420px] overflow-y-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.history.tableStatus}</TableHead>
                  <TableHead>{t.history.tableTime}</TableHead>
                  <TableHead>{t.history.tableResult}</TableHead>
                  <TableHead>{t.history.tableError}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "px-1.5 py-0 text-[10px] font-medium",
                          AUTOMATION_LOG_STATUS_BADGE_CLASSES[log.status]
                        )}
                      >
                        {statusLabel(log.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatAutomationDate(log.executedAt, locale)}
                    </TableCell>
                    <TableCell className="max-w-[220px] align-top">
                      <pre className="truncate text-xs text-muted-foreground">
                        {Object.keys(log.actionResult ?? {}).length > 0
                          ? JSON.stringify(log.actionResult)
                          : "—"}
                      </pre>
                    </TableCell>
                    <TableCell className="max-w-[220px] align-top">
                      <p className="truncate text-xs text-red-600">
                        {log.errorMessage ?? "—"}
                      </p>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.history.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}