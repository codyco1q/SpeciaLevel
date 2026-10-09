"use client";

import { Play, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface SimulationTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payloadStr: string;
  onPayloadStrChange: (val: string) => void;
  onExecute: () => void;
  isRunning: boolean;
  testResult: any;
}

export function SimulationTestDialog({
  open,
  onOpenChange,
  payloadStr,
  onPayloadStrChange,
  onExecute,
  isRunning,
  testResult,
}: SimulationTestDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <Play className="size-4 text-primary fill-primary/20" />
            <span>Simulate & Test Workflow Execution</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs font-medium">Mock Trigger Payload (JSON)</Label>
            <p className="text-[11px] text-muted-foreground mb-1.5">
              Customize context variables to test interpolation and sequential step execution.
            </p>
            <Textarea
              value={payloadStr}
              onChange={(e) => onPayloadStrChange(e.target.value)}
              className="font-mono text-xs min-h-[140px] bg-muted/30"
            />
          </div>

          {testResult && (
            <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider">
                  Execution Trace
                </span>
                <Badge
                  variant={testResult.status === "completed" ? "default" : "destructive"}
                  className="text-[11px]"
                >
                  {testResult.status}
                </Badge>
              </div>

              {testResult.error && (
                <div className="p-2.5 rounded bg-destructive/10 text-destructive text-xs">
                  {testResult.error}
                </div>
              )}

              {testResult.stepsExecuted && (
                <div className="space-y-2">
                  {testResult.stepsExecuted.map((stepTrace: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg border bg-card text-xs flex items-start justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{stepTrace.name}</span>
                          <Badge
                            variant={
                              stepTrace.status === "success"
                                ? "default"
                                : stepTrace.status === "skipped"
                                ? "secondary"
                                : "destructive"
                            }
                            className="text-[10px] uppercase"
                          >
                            {stepTrace.status}
                          </Badge>
                        </div>
                        {stepTrace.output && (
                          <pre className="mt-1 text-[11px] font-mono text-muted-foreground overflow-x-auto max-w-lg">
                            {JSON.stringify(stepTrace.output, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={onExecute}
            disabled={isRunning}
            className="gap-1.5 text-xs"
          >
            {isRunning ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Play className="size-3.5 fill-current" />
            )}
            <span>{isRunning ? "Simulating..." : "Run Test Simulation"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}