"use client";

import { useState, useTransition } from "react";
import {
  History,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  deleteAutomation,
  getAutomations,
  toggleAutomation,
  type AutomationRow,
} from "@/lib/actions/automations";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";
import {
  AUTOMATION_TRIGGER_BADGE_CLASSES,
  AUTOMATION_ACTION_BADGE_CLASSES,
  formatActionSummary,
} from "./automation-meta";
import {
  AutomationDialog,
  type AutomationChannelOption,
  type AutomationMemberOption,
} from "./automation-dialog";
import { LogsDialog } from "./logs-dialog";

interface AutomationsViewProps {
  initialAutomations: AutomationRow[];
  /** Chat channels for the chat_message action picker (and summaries). */
  channels: AutomationChannelOption[];
  /** Org members for the create_task action's optional assignee. */
  members: AutomationMemberOption[];
  canManage: boolean;
  /** Localized copy + formatters for the current render. */
  platform: Dictionary["platform"];
  locale: Locale;
}

/** Accessible active/inactive switch styled as a sliding pill. */
function ActiveToggle({
  checked,
  disabled,
  activeLabel,
  inactiveLabel,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  activeLabel: string;
  inactiveLabel: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={checked ? activeLabel : inactiveLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "border-primary/60 bg-primary" : "border-border bg-muted"
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 rounded-full bg-background shadow-sm transition-transform",
          checked
            ? "translate-x-[22px] rtl:-translate-x-[22px]"
            : "translate-x-[3px] rtl:-translate-x-[3px]"
        )}
      />
    </button>
  );
}

/** Maps a stored trigger/action key to its localized label with a fallback. */
function triggerLabel(
  event: string,
  t: Dictionary["platform"]["automations"]
): string {
  const label = t.triggerEvents[event as keyof typeof t.triggerEvents];
  return typeof label === "string" ? label : event;
}

function actionLabel(
  action: string,
  t: Dictionary["platform"]["automations"]
): string {
  const label = t.actionTypes[action as keyof typeof t.actionTypes];
  return typeof label === "string" ? label : action;
}

export function AutomationsView({
  initialAutomations,
  channels,
  members,
  canManage,
  platform,
  locale,
}: AutomationsViewProps) {
  const t = platform.automations;
  const common = platform.common;

  const [automations, setAutomations] = useState<AutomationRow[]>(
    initialAutomations
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AutomationRow | null>(null);
  const [logsAutomation, setLogsAutomation] = useState<AutomationRow | null>(
    null
  );
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  /** Refetch the automations list after any mutation. */
  async function refreshAll() {
    const list = await getAutomations();
    if (list) setAutomations(list);
  }

  function openCreate() {
    setActionError(null);
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(row: AutomationRow) {
    setActionError(null);
    setEditing(row);
    setDialogOpen(true);
  }

  function handleSaved() {
    setDialogOpen(false);
    setEditing(null);
    setActionError(null);
    void refreshAll();
  }

  function handleToggle(row: AutomationRow) {
    setActionError(null);
    startTransition(async () => {
      const result = await toggleAutomation(row.id, !row.isActive);
      if (result.status === "error") {
        setActionError(result.error);
        return;
      }
      setAutomations((current) =>
        current.map((item) =>
          item.id === row.id
            ? { ...item, isActive: result.automation.isActive }
            : item
        )
      );
    });
  }

  /** Row-level two-step delete: first click arms, second click deletes. */
  function handleRowDeleteClick(row: AutomationRow) {
    setActionError(null);
    if (confirmDeleteId === row.id) {
      setConfirmDeleteId(null);
      startTransition(async () => {
        const result = await deleteAutomation(row.id);
        if (result.status === "error") {
          setActionError(result.error);
          return;
        }
        void refreshAll();
      });
    } else {
      setConfirmDeleteId(row.id);
    }
  }

  function handleViewLogs(row: AutomationRow) {
    setActionError(null);
    setLogsAutomation(row);
  }

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        {canManage && (
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            {t.createAutomation}
          </Button>
        )}
      </div>

      {actionError && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {actionError}
        </div>
      )}

      {automations.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <Zap className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
          <p className="text-sm font-medium text-muted-foreground">
            {t.noAutomationsYet}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {canManage ? t.noAutomationsHintManage : t.noAutomationsHintView}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {automations.map((automation) => (
            <div
              key={automation.id}
              className="rounded-lg border border-border bg-card p-4 shadow-sm transition-colors hover:border-foreground/20"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold leading-snug">
                      {automation.name}
                    </h3>
                    <Badge
                      variant="outline"
                      className={cn(
                        "px-1.5 py-0 text-[10px] font-medium",
                        AUTOMATION_TRIGGER_BADGE_CLASSES[automation.triggerEvent]
                      )}
                    >
                      {triggerLabel(automation.triggerEvent, t)}
                    </Badge>
                    {!automation.isActive && (
                      <Badge
                        variant="outline"
                        className="px-1.5 py-0 text-[10px] font-medium text-muted-foreground"
                      >
                        {t.inactive}
                      </Badge>
                    )}
                  </div>

                  {automation.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {automation.description}
                    </p>
                  )}

                  <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span
                      className={cn(
                        "inline-block rounded-full border px-1.5 py-0 text-[10px] font-medium",
                        AUTOMATION_ACTION_BADGE_CLASSES[automation.actionType]
                      )}
                    >
                      {actionLabel(automation.actionType, t)}
                    </span>
                    <span>
                      {formatActionSummary(
                        automation.actionType,
                        automation.actionConfig ?? {},
                        t,
                        (channelId) =>
                          channels.find((channel) => channel.id === channelId)
                            ?.name
                      )}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <ActiveToggle
                    checked={automation.isActive}
                    disabled={!canManage || isPending}
                    activeLabel={t.active}
                    inactiveLabel={t.inactive}
                    onChange={() => handleToggle(automation)}
                  />
                  {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label={t.actions}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>{automation.name}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => openEdit(automation)}>
                          <Pencil />
                          {common.edit}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => handleViewLogs(automation)}
                        >
                          <History />
                          {t.viewLogs}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => handleRowDeleteClick(automation)}
                        >
                          <Trash2 />
                          {confirmDeleteId === automation.id
                            ? common.confirmDelete
                            : common.delete}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>

              {confirmDeleteId === automation.id && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {t.errors.deleteConfirmBody}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <AutomationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        automation={editing}
        channels={channels}
        members={members}
        onCreated={handleSaved}
        platform={platform}
      />

      <LogsDialog
        open={Boolean(logsAutomation)}
        onOpenChange={(open) => {
          if (!open) setLogsAutomation(null);
        }}
        automation={logsAutomation}
        platform={platform}
        locale={locale}
      />
    </div>
  );
}
