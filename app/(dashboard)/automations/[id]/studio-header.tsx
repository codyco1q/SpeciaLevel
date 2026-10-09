"use client";

import Link from "next/link";
import { ArrowLeft, Zap, Play, History, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

interface StudioHeaderProps {
  name: string;
  onNameChange: (val: string) => void;
  description: string;
  isActive: boolean;
  onIsActiveChange: (val: boolean) => void;
  canManage: boolean;
  isPending: boolean;
  hasWorkflowId: boolean;
  onOpenTest: () => void;
  onOpenLogs: () => void;
  onSave: () => void;
  platform: Dictionary["platform"];
}

export function StudioHeader({
  name,
  onNameChange,
  description,
  isActive,
  onIsActiveChange,
  canManage,
  isPending,
  hasWorkflowId,
  onOpenTest,
  onOpenLogs,
  onSave,
  platform,
}: StudioHeaderProps) {
  const vb = platform.automations.visualBuilder;

  return (
    <header className="h-16 border-b border-border bg-background px-4 sm:px-6 flex items-center justify-between gap-3 shrink-0 sticky top-0 z-30">
      <div className="flex items-center gap-3 min-w-0">
        <Button variant="ghost" size="icon" asChild className="size-8 shrink-0">
          <Link href="/automations">
            <ArrowLeft className="size-4 rtl:rotate-180" />
          </Link>
        </Button>

        <div className="h-4 w-px bg-border shrink-0" />

        <div className="min-w-0 flex items-center gap-2.5">
          <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Zap className="size-4" />
          </div>
          <div className="min-w-0">
            <Input
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              disabled={!canManage}
              placeholder="Workflow name..."
              className="h-7 text-sm font-semibold border-transparent hover:border-border focus:border-primary px-1.5 -ml-1.5 w-48 sm:w-64"
            />
            <p className="text-[11px] text-muted-foreground truncate hidden sm:block">
              {description || "Click to add a brief workflow summary..."}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Active Switch */}
        <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-muted/40 border border-border">
          <Switch
            checked={isActive}
            onCheckedChange={onIsActiveChange}
            disabled={!canManage}
            className="scale-75"
          />
          <span className="text-xs font-medium text-foreground hidden sm:inline">
            {isActive ? vb.active : vb.inactive}
          </span>
        </div>

        {/* Test Modal Trigger */}
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenTest}
          className="gap-1.5 text-xs h-8"
        >
          <Play className="size-3.5 fill-current text-primary" />
          <span className="hidden sm:inline">{vb.runTest}</span>
        </Button>

        {/* Execution Logs Button */}
        {hasWorkflowId && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenLogs}
            className="gap-1.5 text-xs h-8"
          >
            <History className="size-3.5" />
            <span className="hidden sm:inline">{vb.logsTab}</span>
          </Button>
        )}

        {/* Save Button */}
        {canManage && (
          <Button
            size="sm"
            onClick={onSave}
            disabled={isPending}
            className="gap-1.5 text-xs h-8 font-medium shadow-xs"
          >
            {isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            <span>{isPending ? vb.saving : vb.saveWorkflow}</span>
          </Button>
        )}
      </div>
    </header>
  );
}