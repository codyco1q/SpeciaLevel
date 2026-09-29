"use client";

import { useState, useTransition } from "react";
import {
  ArrowLeft,
  Save,
  Play,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Settings2,
  FileText,
  Calendar,
  TrendingUp,
  Tag,
  MessageSquare,
  CreditCard,
  MessageCircle,
  Bell,
  ArrowRightCircle,
  Webhook,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  LoaderCircle,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  WORKFLOW_TRIGGER_DEFINITIONS,
  WORKFLOW_ACTION_DEFINITIONS,
} from "@/lib/validations/automations";
import {
  saveWorkflow,
  testWorkflowRun,
  type AutomationConfigOptions,
} from "@/lib/actions/automations";
import { StepConfigDialog } from "./step-config-dialog";
import type {
  AutomationWorkflow,
  WorkflowStep,
  WorkflowTriggerType,
  WorkflowActionType,
  AutomationStepExecutionResult,
} from "@/types/database";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

interface WorkflowBuilderStudioProps {
  workflow: AutomationWorkflow | null;
  configOptions: AutomationConfigOptions;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (workflow: AutomationWorkflow) => void;
  platform: Dictionary["platform"];
  locale: Locale;
}

export function WorkflowBuilderStudio({
  workflow,
  configOptions,
  open,
  onOpenChange,
  onSaved,
  platform,
  locale,
}: WorkflowBuilderStudioProps) {
  const t = platform.automations;
  const vb = t.visualBuilder;

  const [name, setName] = useState(workflow?.name || "Untitled Workflow");
  const [description, setDescription] = useState(workflow?.description || "");
  const [isActive, setIsActive] = useState(workflow?.is_active ?? true);
  const [triggerType, setTriggerType] = useState<WorkflowTriggerType>(
    workflow?.trigger_type || "form_submitted"
  );
  const [triggerConfig, setTriggerConfig] = useState<Record<string, any>>(
    workflow?.trigger_config || {}
  );
  const [steps, setSteps] = useState<WorkflowStep[]>(
    workflow?.steps && Array.isArray(workflow.steps) ? workflow.steps : []
  );

  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const [actionPickerOpen, setActionPickerOpen] = useState(false);
  const [insertAtIndex, setInsertAtIndex] = useState<number | null>(null);

  const [isSaving, startSaving] = useTransition();
  const [isTesting, startTesting] = useTransition();
  const triggerDef =
    WORKFLOW_TRIGGER_DEFINITIONS.find((d) => d.type === triggerType) ||
    WORKFLOW_TRIGGER_DEFINITIONS[0];

  const handleAddStep = (actionType: WorkflowActionType) => {
    const actionDef = WORKFLOW_ACTION_DEFINITIONS.find((d) => d.type === actionType);
    const newStep: WorkflowStep = {
      id: "step_" + Math.random().toString(36).slice(2, 9),
      type: "action",
      action_type: actionType,
      name: actionDef?.name || "Action Step",
      config: actionDef ? { ...actionDef.defaultConfig } : {},
    };

    if (insertAtIndex !== null && insertAtIndex >= 0) {
      const updated = [...steps];
      updated.splice(insertAtIndex, 0, newStep);
      setSteps(updated);
    } else {
      setSteps([...steps, newStep]);
    }

    setActionPickerOpen(false);
    setInsertAtIndex(null);
  };

  const handleMoveStep = (index: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= steps.length) return;
    const updated = [...steps];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    setSteps(updated);
  };

  const handleDeleteStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const handleSaveStepConfig = (updatedStep: WorkflowStep) => {
    if (editingStepIndex === null) return;
    const updated = [...steps];
    updated[editingStepIndex] = updatedStep;
    setSteps(updated);
    setEditingStepIndex(null);
  };

  const handleSaveWorkflow = () => {
    setServerError(null);
    startSaving(async () => {
      const res = await saveWorkflow({
        id: workflow?.id,
        name: name.trim() || "Untitled Workflow",
        description: description.trim() || null,
        isActive,
        triggerType,
        triggerConfig,
        steps,
      });

      if (res.status === "error" || !res.workflow) {
        setServerError(res.error || "Failed to save workflow.");
        return;
      }

      onSaved(res.workflow);
      onOpenChange(false);
    });
  };

  const handleRunTest = () => {
    if (!workflow?.id) {
      setServerError("Please save the workflow first before running a test.");
      return;
    }

    setTestResult(null);
    setTestModalOpen(true);

    startTesting(async () => {
      const res = await testWorkflowRun(workflow.id);
      if (res.status === "error" || !res.result) {
        setTestResult({
          status: "failed",
          error: res.error || "Test run failed.",
        });
      } else {
        setTestResult(res.result);
      }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[92vh] max-h-[95vh] p-0 flex flex-col gap-0 overflow-hidden bg-background">
        {/* Studio Top Bar */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-border bg-card/60 backdrop-blur shrink-0">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4 rtl:rotate-180" />
            </Button>
            <div className="flex-1 min-w-0 pr-4">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={vb.workflowNamePlaceholder}
                className="w-full bg-transparent text-base font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 rounded px-1.5 py-0.5"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 border rounded-full px-3 py-1 bg-muted/30">
              <Switch
                checked={isActive}
                onCheckedChange={setIsActive}
                className="scale-90"
              />
              <span className="text-xs font-medium">
                {isActive ? vb.active : vb.inactive}
              </span>
            </div>

            {workflow?.id && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRunTest}
                disabled={isTesting || isSaving}
                className="gap-1.5 text-xs h-8"
              >
                {isTesting ? (
                  <LoaderCircle className="size-3.5 animate-spin" />
                ) : (
                  <Play className="size-3.5 fill-current text-emerald-500" />
                )}
                <span>{vb.runTest}</span>
              </Button>
            )}

            <Button
              size="sm"
              onClick={handleSaveWorkflow}
              disabled={isSaving}
              className="gap-1.5 text-xs h-8"
            >
              {isSaving ? (
                <LoaderCircle className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              <span>{isSaving ? vb.saving : vb.saveWorkflow}</span>
            </Button>
          </div>
        </div>

        {serverError && (
          <div className="px-6 py-2 bg-destructive/10 text-destructive text-xs border-b border-destructive/20 flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{serverError}</span>
          </div>
        )}

        {/* Canvas Body */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-muted/20">
          <div className="max-w-2xl mx-auto flex flex-col items-center">
            
            {/* Description Card */}
            <div className="w-full mb-6 rounded-xl border border-border/80 bg-card p-4 shadow-sm">
              <Label className="text-xs font-medium text-muted-foreground">{vb.workflowDesc}</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={vb.workflowDescPlaceholder}
                className="mt-1.5 min-h-[50px] text-xs resize-none bg-background/50"
              />
            </div>

            {/* 1. Trigger Node Card */}
            <div className="w-full rounded-2xl border-2 border-primary/40 bg-card p-5 shadow-sm relative transition-all hover:border-primary/70">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                    {triggerType === "form_submitted" && <FileText className="size-4" />}
                    {triggerType === "appointment_booked" && <Calendar className="size-4" />}
                    {triggerType === "deal_stage_changed" && <TrendingUp className="size-4" />}
                    {triggerType === "contact_tag_added" && <Tag className="size-4" />}
                    {triggerType === "inbound_sms" && <MessageSquare className="size-4" />}
                    {triggerType === "invoice_paid" && <CreditCard className="size-4" />}
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-primary uppercase tracking-wider block">
                      {vb.triggerNode}
                    </span>
                    <h3 className="text-sm font-semibold text-foreground">
                      {t.triggerEvents[triggerType] || triggerDef.name}
                    </h3>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider bg-primary/5 text-primary border-primary/30">
                  {triggerDef.badge}
                </Badge>
              </div>

              <div className="grid gap-3 pt-2 border-t border-border/60">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t.triggerEvent}</Label>
                  <Select
                    value={triggerType}
                    onValueChange={(val) => {
                      setTriggerType(val as WorkflowTriggerType);
                      setTriggerConfig({});
                    }}
                  >
                    <SelectTrigger className="text-xs h-9 bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WORKFLOW_TRIGGER_DEFINITIONS.map((td) => (
                        <SelectItem key={td.type} value={td.type} className="text-xs">
                          {t.triggerEvents[td.type] || td.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Filters */}
                {triggerType === "form_submitted" && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{vb.triggerFilter}</Label>
                    <Select
                      value={triggerConfig.form_id || "all"}
                      onValueChange={(val) => setTriggerConfig({ form_id: val })}
                    >
                      <SelectTrigger className="text-xs h-8 bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-xs font-medium">{vb.allForms}</SelectItem>
                        {configOptions.forms.map((f) => (
                          <SelectItem key={f.id} value={f.id} className="text-xs">{f.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {triggerType === "deal_stage_changed" && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{vb.triggerFilter}</Label>
                    <Select
                      value={triggerConfig.stage_id || "all"}
                      onValueChange={(val) => setTriggerConfig({ stage_id: val })}
                    >
                      <SelectTrigger className="text-xs h-8 bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-xs font-medium">{vb.allStages}</SelectItem>
                        {configOptions.pipelines.flatMap((p) =>
                          p.stages.map((st) => (
                            <SelectItem key={st.id} value={st.id} className="text-xs">
                              {p.name} &rarr; {st.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {triggerType === "contact_tag_added" && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{vb.triggerFilter}</Label>
                    <Input
                      value={triggerConfig.tag || ""}
                      onChange={(e) => setTriggerConfig({ tag: e.target.value })}
                      placeholder={vb.allTags}
                      className="text-xs h-8 bg-background"
                    />
                  </div>
                )}

                {triggerType === "inbound_sms" && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{vb.triggerFilter}</Label>
                    <Select
                      value={triggerConfig.phone_number || "all"}
                      onValueChange={(val) => setTriggerConfig({ phone_number: val })}
                    >
                      <SelectTrigger className="text-xs h-8 bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-xs font-medium">{vb.allNumbers}</SelectItem>
                        {configOptions.phoneNumbers.map((pn) => (
                          <SelectItem key={pn.id} value={pn.phoneNumber} className="text-xs">
                            {pn.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

              </div>
            </div>

            {/* 2. Steps List & Connecting Lines */}
            <div className="w-full flex flex-col items-center">
              {steps.map((step, idx) => {
                const actionDef = WORKFLOW_ACTION_DEFINITIONS.find((d) => d.type === step.action_type);
                return (
                  <div key={step.id} className="w-full flex flex-col items-center">
                    <div className="flex flex-col items-center my-2 relative group">
                      <div className="h-7 w-0.5 bg-border group-hover:bg-primary transition-colors" />
                      <button
                        type="button"
                        onClick={() => {
                          setInsertAtIndex(idx);
                          setActionPickerOpen(true);
                        }}
                        className="size-6 rounded-full bg-background border border-border shadow-xs flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary hover:scale-110 transition-all z-10"
                        title="Insert action"
                      >
                        <Plus className="size-3.5" />
                      </button>
                      <div className="h-7 w-0.5 bg-border group-hover:bg-primary transition-colors" />
                    </div>

                    <div className="w-full rounded-xl border border-border bg-card p-4 shadow-sm hover:border-border/80 transition-all">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-[11px] font-bold text-muted-foreground px-2 py-0.5 bg-muted rounded">
                            {vb.step} {idx + 1}
                          </span>
                          <div className="size-8 rounded-lg bg-muted text-foreground flex items-center justify-center shrink-0">
                            {step.action_type === "send_sms" && <MessageCircle className="size-4 text-emerald-500" />}
                            {step.action_type === "send_notification" && <Bell className="size-4 text-amber-500" />}
                            {step.action_type === "add_tag" && <Tag className="size-4 text-sky-500" />}
                            {step.action_type === "update_deal_stage" && <ArrowRightCircle className="size-4 text-indigo-500" />}
                            {step.action_type === "webhook" && <Webhook className="size-4 text-purple-500" />}
                            {step.action_type === "delay" && <Clock className="size-4 text-rose-500" />}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-semibold truncate">
                              {step.name || t.actionTypes[step.action_type] || actionDef?.name}
                            </h4>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingStepIndex(idx)}
                            className="h-7 text-xs gap-1 px-2.5"
                          >
                            <Settings2 className="size-3.5" />
                            <span>{vb.configure}</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={idx === 0}
                            onClick={() => handleMoveStep(idx, "up")}
                            className="size-7 text-muted-foreground hover:text-foreground"
                          >
                            <ChevronUp className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={idx === steps.length - 1}
                            onClick={() => handleMoveStep(idx, "down")}
                            className="size-7 text-muted-foreground hover:text-foreground"
                          >
                            <ChevronDown className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteStep(idx)}
                            className="size-7 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

              {/* Add Step Bottom Button */}
              <div className="flex flex-col items-center my-4">
                <div className="h-7 w-0.5 bg-border" />
                <Button
                  variant="outline"
                  onClick={() => {
                    setInsertAtIndex(null);
                    setActionPickerOpen(true);
                  }}
                  className="rounded-full gap-2 text-xs border-dashed border-2 hover:border-primary hover:text-primary py-4 px-6 bg-card"
                >
                  <Plus className="size-4" />
                  <span>{vb.addStep}</span>
                </Button>
              </div>

          </div>
        </div>

        {/* Action Picker Modal */}
        <Dialog open={actionPickerOpen} onOpenChange={setActionPickerOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">{vb.selectAction}</DialogTitle>
              <DialogDescription className="text-xs">
                Select an automated step action to append to this workflow.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
              {WORKFLOW_ACTION_DEFINITIONS.map((act) => (
                <button
                  key={act.type}
                  type="button"
                  onClick={() => handleAddStep(act.type)}
                  className="flex flex-col items-start p-3.5 rounded-xl border border-border bg-card text-start hover:border-primary/60 hover:bg-primary/5 transition-all group"
                >
                  <div className="flex items-center gap-2 mb-1.5 w-full">
                    <div className="size-7 rounded-md bg-muted flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
                      {act.type === "send_sms" && <MessageCircle className="size-3.5 text-emerald-500 group-hover:text-inherit" />}
                      {act.type === "send_notification" && <Bell className="size-3.5 text-amber-500 group-hover:text-inherit" />}
                      {act.type === "add_tag" && <Tag className="size-3.5 text-sky-500 group-hover:text-inherit" />}
                      {act.type === "update_deal_stage" && <ArrowRightCircle className="size-3.5 text-indigo-500 group-hover:text-inherit" />}
                      {act.type === "webhook" && <Webhook className="size-3.5 text-purple-500 group-hover:text-inherit" />}
                      {act.type === "delay" && <Clock className="size-3.5 text-rose-500 group-hover:text-inherit" />}
                    </div>
                    <span className="text-xs font-semibold text-foreground flex-1 truncate">
                      {t.actionTypes[act.type] || act.name}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">
                    {act.description}
                  </p>
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
        {/* Step Configuration Drawer / Modal */}
        <StepConfigDialog
          step={editingStepIndex !== null ? steps[editingStepIndex] : null}
          open={editingStepIndex !== null}
          onOpenChange={(op) => !op && setEditingStepIndex(null)}
          onSave={handleSaveStepConfig}
          configOptions={configOptions}
          platform={platform}
          locale={locale}
        />

        {/* Test Run Execution Feedback Modal */}
        <Dialog open={testModalOpen} onOpenChange={setTestModalOpen}>
          <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <DialogTitle className="text-base font-semibold">
                  {vb.runTest}: {name}
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs">
                Simulated execution with sample lead payload.
              </DialogDescription>
            </DialogHeader>

            <div className="py-2 space-y-4">
              {isTesting ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <LoaderCircle className="size-8 animate-spin text-primary" />
                  <p className="text-xs text-muted-foreground">{vb.runningTest}</p>
                </div>
              ) : testResult ? (
                <div className="space-y-3">
                  <div className={cn(
                    "p-3 rounded-lg flex items-center gap-2.5 text-xs font-medium border",
                    testResult.status === "completed"
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400"
                      : "bg-destructive/10 text-destructive border-destructive/20"
                  )}>
                    {testResult.status === "completed" ? (
                      <CheckCircle2 className="size-4 shrink-0" />
                    ) : (
                      <XCircle className="size-4 shrink-0" />
                    )}
                    <span>{testResult.status === "completed" ? vb.testSuccess : vb.testFailed}</span>
                  </div>

                  {testResult.error && (
                    <div className="p-3 bg-muted rounded-lg text-xs font-mono text-destructive">
                      {testResult.error}
                    </div>
                  )}

                  <div className="space-y-2">
                    <h5 className="text-xs font-semibold text-muted-foreground">Execution Steps Result:</h5>
                    <div className="space-y-1.5">
                      {steps.map((st, i) => (
                        <div
                          key={st.id}
                          className="flex items-center justify-between p-2 rounded-md bg-muted/40 border text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-muted-foreground text-[10px]">#{i + 1}</span>
                            <span className="font-medium">{st.name || t.actionTypes[st.action_type]}</span>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px]",
                              testResult.status === "completed"
                                ? "text-emerald-600 border-emerald-500/30"
                                : "text-destructive border-destructive/30"
                            )}
                          >
                            {testResult.status === "completed" ? "Success" : "Failed"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>

      </DialogContent>
    </Dialog>
  );
}



