"use client";

import { useState } from "react";
import {
  History,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  Code2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AutomationExecutionLog } from "@/types/database";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

interface ExecutionLogsDialogProps {
  logs: AutomationExecutionLog[];
  workflowName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platform: Dictionary["platform"];
  locale: Locale;
}

export function ExecutionLogsDialog({
  logs,
  workflowName,
  open,
  onOpenChange,
  platform,
  locale,
}: ExecutionLogsDialogProps) {
  const t = platform.automations;
  const vb = t.visualBuilder;
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedLogId((prev) => (prev === id ? null : id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <History className="size-5 text-primary" />
            <DialogTitle className="text-base font-semibold">
              {vb.logsTab} {workflowName ? `— ${workflowName}` : ""}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Detailed step-by-step trace and payload inspection for workflow triggers.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-3">
          {logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-xs">
              <History className="size-8 mx-auto mb-2 opacity-30" />
              <p>{t.noLogsYet}</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {logs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                const isSuccess = log.status === "completed";
                const isFailed = log.status === "failed";

                return (
                  <div
                    key={log.id}
                    className={cn(
                      "rounded-xl border transition-all overflow-hidden bg-card",
                      isExpanded ? "border-primary/40 shadow-xs" : "border-border hover:border-border/80"
                    )}
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleExpand(log.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleExpand(log.id);
                        }
                      }}
                      className="p-3.5 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="shrink-0">
                          {isSuccess && <CheckCircle2 className="size-4 text-emerald-500" />}
                          {isFailed && <XCircle className="size-4 text-destructive" />}
                          {log.status === "running" && <Clock className="size-4 text-blue-500 animate-spin" />}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-foreground">
                              {new Date(log.started_at).toLocaleString(locale === "ar" ? "ar-EG" : "en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] capitalize font-medium",
                                isSuccess && "text-emerald-600 bg-emerald-500/10 border-emerald-500/20",
                                isFailed && "text-destructive bg-destructive/10 border-destructive/20",
                                log.status === "running" && "text-blue-600 bg-blue-500/10 border-blue-500/20"
                              )}
                            >
                              {log.status}
                            </Badge>
                          </div>
                          {log.error_message && (
                            <p className="text-[11px] text-destructive truncate mt-0.5 font-mono">
                              {log.error_message}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {Array.isArray(log.steps_executed) ? `${log.steps_executed.length} steps` : "0 steps"}
                        </span>
                        {isExpanded ? (
                          <ChevronDown className="size-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="size-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 border-t border-border/60 bg-muted/20 space-y-3 text-xs">
                        {Array.isArray(log.steps_executed) && log.steps_executed.length > 0 && (
                          <div className="space-y-2">
                            <h5 className="font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">
                              Steps Trace
                            </h5>
                            <div className="space-y-1.5">
                              {log.steps_executed.map((st, i) => (
                                <div
                                  key={st.step_id || i}
                                  className="p-2.5 rounded-lg border bg-background flex flex-col gap-1.5"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono text-muted-foreground text-[10px]">#{i + 1}</span>
                                      <span className="font-medium text-foreground">{st.name || st.action_type}</span>
                                    </div>
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "text-[10px] capitalize",
                                        st.status === "success" && "text-emerald-600 border-emerald-500/30",
                                        st.status === "failed" && "text-destructive border-destructive/30",
                                        st.status === "skipped" && "text-muted-foreground border-border"
                                      )}
                                    >
                                      {st.status}
                                    </Badge>
                                  </div>

                                  {st.error && (
                                    <p className="text-[11px] text-destructive font-mono bg-destructive/5 p-1.5 rounded">
                                      {st.error}
                                    </p>
                                  )}

                                  {st.output && Object.keys(st.output).length > 0 && (
                                    <pre className="text-[10px] font-mono text-muted-foreground bg-muted p-1.5 rounded overflow-x-auto">
                                      {JSON.stringify(st.output, null, 2)}
                                    </pre>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {log.trigger_payload && Object.keys(log.trigger_payload).length > 0 && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider">
                              <Code2 className="size-3" />
                              <span>Trigger Payload</span>
                            </div>
                            <pre className="text-[10px] font-mono text-foreground/80 bg-background p-2.5 rounded-lg border overflow-x-auto max-h-40">
                              {JSON.stringify(log.trigger_payload, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

