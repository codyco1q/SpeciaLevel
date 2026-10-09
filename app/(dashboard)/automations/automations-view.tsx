"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Plus,
  Zap,
  History,
  MoreHorizontal,
  Pencil,
  Trash2,
  FileText,
  Calendar,
  TrendingUp,
  Tag,
  MessageSquare,
  CreditCard,
  Search,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  toggleWorkflowStatus,
  deleteWorkflow,
  type WorkflowWithMeta,
  type AutomationConfigOptions,
} from "@/lib/actions/automations";
import { ExecutionLogsDialog } from "./execution-logs-dialog";
import type {
  AutomationWorkflow,
  AutomationExecutionLog,
} from "@/types/database";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

interface AutomationsViewProps {
  initialWorkflows: WorkflowWithMeta[];
  configOptions: AutomationConfigOptions;
  initialLogs: AutomationExecutionLog[];
  canManage: boolean;
  platform: Dictionary["platform"];
  locale: Locale;
}

export function AutomationsView({
  initialWorkflows,
  configOptions,
  initialLogs,
  canManage,
  platform,
  locale,
}: AutomationsViewProps) {
  const t = platform.automations;
  const vb = t.visualBuilder;

  const [workflows, setWorkflows] = useState<WorkflowWithMeta[]>(initialWorkflows);
  const [logs, setLogs] = useState<AutomationExecutionLog[]>(initialLogs);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTriggerFilter, setSelectedTriggerFilter] = useState<string>("all");

  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  const [selectedWorkflowForLogs, setSelectedWorkflowForLogs] = useState<WorkflowWithMeta | null>(null);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, startDeleting] = useTransition();
  const [togglePendingId, setTogglePendingId] = useState<string | null>(null);

  const handleToggleActive = async (id: string, currentState: boolean) => {
    setTogglePendingId(id);
    const newState = !currentState;
    setWorkflows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, is_active: newState } : w))
    );

    const res = await toggleWorkflowStatus(id, newState);
    setTogglePendingId(null);
    if (res.status === "error") {
      setWorkflows((prev) =>
        prev.map((w) => (w.id === id ? { ...w, is_active: currentState } : w))
      );
    }
  };

  const handleDelete = () => {
    if (!deleteConfirmId) return;
    startDeleting(async () => {
      const idToDelete = deleteConfirmId;
      const res = await deleteWorkflow(idToDelete);
      if (res.status === "success") {
        setWorkflows((prev) => prev.filter((w) => w.id !== idToDelete));
        setDeleteConfirmId(null);
      }
    });
  };

  const filteredWorkflows = workflows.filter((w) => {
    const matchesSearch =
      w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (w.description && w.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesTrigger =
      selectedTriggerFilter === "all" || w.trigger_type === selectedTriggerFilter;
    return matchesSearch && matchesTrigger;
  });

  return (
    <div className="space-y-6">
      {/* Module Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Zap className="size-6 text-primary" />
            <span>{t.title}</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {vb.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedWorkflowForLogs(null);
              setLogsDialogOpen(true);
            }}
            className="gap-1.5 text-xs h-9"
          >
            <History className="size-3.5" />
            <span>{vb.logsTab}</span>
          </Button>

          {canManage && (
            <Button
              size="sm"
              asChild
              className="gap-1.5 text-xs h-9 font-medium shadow-sm"
            >
              <Link href="/automations/new">
                <Plus className="size-4" />
                <span>{vb.newWorkflow}</span>
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search workflows..."
            className="pl-9 rtl:pl-3 rtl:pr-9 text-xs h-9 bg-card"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full pb-1 sm:pb-0">
          <Button
            variant={selectedTriggerFilter === "all" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setSelectedTriggerFilter("all")}
            className="text-xs h-8 rounded-lg"
          >
            All Triggers ({workflows.length})
          </Button>
          <Button
            variant={selectedTriggerFilter === "form_submitted" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setSelectedTriggerFilter("form_submitted")}
            className="text-xs h-8 rounded-lg"
          >
            Forms
          </Button>
          <Button
            variant={selectedTriggerFilter === "appointment_booked" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setSelectedTriggerFilter("appointment_booked")}
            className="text-xs h-8 rounded-lg"
          >
            Appointments
          </Button>
          <Button
            variant={selectedTriggerFilter === "deal_stage_changed" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setSelectedTriggerFilter("deal_stage_changed")}
            className="text-xs h-8 rounded-lg"
          >
            Deals
          </Button>
          <Button
            variant={selectedTriggerFilter === "invoice_paid" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setSelectedTriggerFilter("invoice_paid")}
            className="text-xs h-8 rounded-lg"
          >
            Invoices
          </Button>
        </div>
      </div>


      {/* Workflows List */}
      {filteredWorkflows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center bg-card/50">
          <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
            <Zap className="size-6" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">{t.noAutomationsYet}</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            {canManage ? t.noAutomationsHintManage : t.noAutomationsHintView}
          </p>
          {canManage && (
            <Button
              size="sm"
              asChild
              className="mt-4 gap-1.5 text-xs font-medium"
            >
              <Link href="/automations/new">
                <Plus className="size-4" />
                <span>{vb.newWorkflow}</span>
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredWorkflows.map((wf) => {
            const stepsCount = Array.isArray(wf.steps) ? wf.steps.length : 0;
            const isToggling = togglePendingId === wf.id;

            return (
              <div
                key={wf.id}
                className="rounded-xl border border-border bg-card p-4.5 shadow-xs hover:border-border/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Link
                      href={`/automations/${wf.id}`}
                      className="text-sm font-semibold text-foreground hover:text-primary transition-colors cursor-pointer"
                    >
                      {wf.name}
                    </Link>

                    <Badge variant="outline" className="text-[10px] font-medium capitalize bg-primary/5 text-primary border-primary/20 gap-1">
                      {wf.trigger_type === "form_submitted" && <FileText className="size-3" />}
                      {wf.trigger_type === "appointment_booked" && <Calendar className="size-3" />}
                      {wf.trigger_type === "deal_stage_changed" && <TrendingUp className="size-3" />}
                      {wf.trigger_type === "contact_tag_added" && <Tag className="size-3" />}
                      {wf.trigger_type === "inbound_sms" && <MessageSquare className="size-3" />}
                      {wf.trigger_type === "invoice_paid" && <CreditCard className="size-3" />}
                      <span>{t.triggerEvents[wf.trigger_type] || wf.trigger_type}</span>
                    </Badge>

                    <Badge variant="secondary" className="text-[10px] font-mono">
                      {vb.stepsCount.replace("{count}", String(stepsCount))}
                    </Badge>
                  </div>

                  {wf.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1 mb-2">
                      {wf.description}
                    </p>
                  )}

                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-2">
                    <span className="flex items-center gap-1.5">
                      <Clock className="size-3" />
                      <span>{vb.lastRun}: </span>
                      {wf.last_run_at ? (
                        <span className="font-medium text-foreground">
                          {new Date(wf.last_run_at).toLocaleString(locale === "ar" ? "ar-EG" : "en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      ) : (
                        <span>{vb.neverRun}</span>
                      )}
                    </span>

                    {wf.last_status && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px] px-1.5 py-0 capitalize",
                          wf.last_status === "completed" && "text-emerald-600 bg-emerald-500/10 border-emerald-500/20",
                          wf.last_status === "failed" && "text-destructive bg-destructive/10 border-destructive/20"
                        )}
                      >
                        {wf.last_status}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={wf.is_active}
                      disabled={!canManage || isToggling}
                      onCheckedChange={() => handleToggleActive(wf.id, wf.is_active)}
                      className="scale-90"
                    />
                    <span className="text-xs font-medium text-muted-foreground">
                      {wf.is_active ? vb.active : vb.inactive}
                    </span>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem asChild className="text-xs gap-2 cursor-pointer">
                        <Link href={`/automations/${wf.id}`}>
                          <Pencil className="size-3.5" />
                          <span>{vb.editWorkflow}</span>
                        </Link>
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onSelect={() => {
                          setSelectedWorkflowForLogs(wf);
                          setLogsDialogOpen(true);
                        }}
                        className="text-xs gap-2"
                      >
                        <History className="size-3.5" />
                        <span>{vb.logsTab}</span>
                      </DropdownMenuItem>

                      {canManage && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={() => setDeleteConfirmId(wf.id)}
                            className="text-xs gap-2 text-destructive focus:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                            <span>{platform.common.delete}</span>
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Execution History Dialog */}
      <ExecutionLogsDialog
        logs={
          selectedWorkflowForLogs
            ? logs.filter((l) => l.workflow_id === selectedWorkflowForLogs.id)
            : logs
        }
        workflowName={selectedWorkflowForLogs?.name}
        open={logsDialogOpen}
        onOpenChange={(op) => {
          setLogsDialogOpen(op);
          if (!op) setSelectedWorkflowForLogs(null);
        }}
        platform={platform}
        locale={locale}
      />

      {/* Delete Confirmation Modal */}
      <Dialog
        open={Boolean(deleteConfirmId)}
        onOpenChange={(op) => !op && setDeleteConfirmId(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {t.errors.deleteConfirmTitle}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t.errors.deleteConfirmBody}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmId(null)}
              disabled={isDeleting}
            >
              {platform.common.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? vb.saving : platform.common.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


