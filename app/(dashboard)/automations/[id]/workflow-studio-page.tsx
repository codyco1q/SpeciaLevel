"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import {
  WORKFLOW_ACTION_DEFINITIONS,
  type WorkflowTriggerType,
  type WorkflowActionType,
  type WorkflowStep,
} from "@/lib/validations/automations";
import {
  saveWorkflow,
  testWorkflow,
  type AutomationConfigOptions,
} from "@/lib/actions/automations";
import { StudioHeader } from "./studio-header";
import { StudioCanvas } from "./studio-canvas";
import { TriggerConfigDialog } from "./trigger-config-dialog";
import { ActionPickerDialog } from "./action-picker-dialog";
import { SimulationTestDialog } from "./simulation-test-dialog";
import { StepConfigDialog } from "../step-config-dialog";
import { ExecutionLogsDialog } from "../execution-logs-dialog";
import type {
  AutomationWorkflow,
  AutomationExecutionLog,
} from "@/types/database";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

interface WorkflowStudioPageProps {
  workflow: AutomationWorkflow | null;
  configOptions: AutomationConfigOptions;
  initialLogs: AutomationExecutionLog[];
  canManage: boolean;
  platform: Dictionary["platform"];
  locale: Locale;
}

export function WorkflowStudioPage({
  workflow,
  configOptions,
  initialLogs,
  canManage,
  platform,
  locale,
}: WorkflowStudioPageProps) {
  const router = useRouter();
  const t = platform.automations;
  const vb = t.visualBuilder;

  // Form State
  const [workflowId, setWorkflowId] = useState<string | undefined>(workflow?.id);
  const [name, setName] = useState(workflow?.name || "Untitled Workflow");
  const [description, setDescription] = useState(workflow?.description || "");
  const [isActive, setIsActive] = useState(workflow?.is_active ?? false);
  const [triggerType, setTriggerType] = useState<WorkflowTriggerType>(
    (workflow?.trigger_type as WorkflowTriggerType) || "form_submitted"
  );
  const [triggerConfig, setTriggerConfig] = useState<Record<string, any>>(
    (workflow?.trigger_config as Record<string, any>) || {}
  );
  const [steps, setSteps] = useState<WorkflowStep[]>(() =>
    ((workflow?.steps as WorkflowStep[]) || []).map((s, idx) => ({
      ...s,
      id: s.id || `step_${idx + 1}`,
    }))
  );

  // Modals & Inspection State
  const [selectedStepForConfig, setSelectedStepForConfig] = useState<WorkflowStep | null>(null);
  const [triggerConfigOpen, setTriggerConfigOpen] = useState(false);
  const [actionPickerInsertIndex, setActionPickerInsertIndex] = useState<number | null>(null);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [logsModalOpen, setLogsModalOpen] = useState(false);

  // Persistence & Transition
  const [isPending, startTransition] = useTransition();
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Test Runner State
  const [testPayloadStr, setTestPayloadStr] = useState("");
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const handleSave = () => {
    if (!name.trim()) {
      setStatusMessage({ type: "error", text: "Workflow name cannot be empty." });
      return;
    }

    startTransition(async () => {
      const res = await saveWorkflow({
        id: workflowId,
        name: name.trim(),
        description: description.trim() || undefined,
        trigger_type: triggerType,
        trigger_config: triggerConfig,
        steps,
        is_active: isActive,
      });

      if (res.status === "success" && (res.data || res.workflow)) {
        const wf = res.data || res.workflow;
        setStatusMessage({ type: "success", text: vb.savedToast });
        if (!workflowId && wf) {
          setWorkflowId(wf.id);
          router.replace(`/automations/${wf.id}`);
        }
      } else {
        setStatusMessage({ type: "error", text: res.error || "Failed to save workflow." });
      }
    });
  };

  // Ctrl+S / Cmd+S save hotkey
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (canManage && !isPending) {
          handleSave();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [name, description, isActive, triggerType, triggerConfig, steps, canManage, isPending]);

  const handleAddStep = (actionType: WorkflowActionType) => {
    const actionDef = WORKFLOW_ACTION_DEFINITIONS.find((a) => a.type === actionType);
    let defaultActionConfig: Record<string, any> = {};

    switch (actionType) {
      case "send_sms":
        defaultActionConfig = { message_template: "", phone_number: "{{contact.phone}}" };
        break;
      case "send_notification":
        defaultActionConfig = { title: "New Automation Notification", message: "Workflow action triggered." };
        break;
      case "send_email":
        defaultActionConfig = { to: "{{contact.email}}", subject: "Update regarding your request", body: "" };
        break;
      case "add_tag":
        defaultActionConfig = { tag: "" };
        break;
      case "update_deal_stage":
        defaultActionConfig = { stage_id: "" };
        break;
      case "delay":
        defaultActionConfig = { delay_minutes: 10 };
        break;
      case "webhook":
        defaultActionConfig = { url: "https://", method: "POST" };
        break;
    }

    const newStep: WorkflowStep = {
      id: `step_${Math.random().toString(36).substring(2, 9)}`,
      type: "action",
      action_type: actionType,
      name: actionDef?.title || actionType,
      config: defaultActionConfig,
      action_config: defaultActionConfig,
    };

    const index = actionPickerInsertIndex;
    if (typeof index === "number" && index >= 0 && index <= steps.length) {
      const updated = [...steps];
      updated.splice(index, 0, newStep);
      setSteps(updated);
    } else {
      setSteps([...steps, newStep]);
    }

    setActionPickerInsertIndex(null);
    setSelectedStepForConfig(newStep);
  };

  const handleUpdateStepConfig = (updatedStep: WorkflowStep) => {
    setSteps((prev) => prev.map((s) => (s.id === updatedStep.id ? updatedStep : s)));
    setSelectedStepForConfig(null);
  };

  const handleDeleteStep = (stepId: string) => {
    setSteps((prev) => prev.filter((s) => s.id !== stepId));
    if (selectedStepForConfig?.id === stepId) {
      setSelectedStepForConfig(null);
    }
  };

  const handleMoveStep = (index: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= steps.length) return;
    const updated = [...steps];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIdx, 0, moved);
    setSteps(updated);
  };
  const handleOpenTestModal = () => {
    let mockData: Record<string, any> = {};
    if (triggerType === "form_submitted") {
      mockData = {
        form_id: triggerConfig.form_id || "form-sample-id",
        submission_id: "sub_123",
        contact: { name: "Ahmed Salem", email: "ahmed@example.com", phone: "+966500000000" },
      };
    } else if (triggerType === "appointment_booked") {
      mockData = {
        booking_id: "bk_123",
        contact: { name: "Sara Mohamed", email: "sara@example.com", phone: "+966511111111" },
        scheduled_at: new Date(Date.now() + 86400000).toISOString(),
      };
    } else if (triggerType === "deal_stage_changed") {
      mockData = {
        deal_id: "deal_123",
        deal_title: "Enterprise Implementation",
        stage_id: triggerConfig.stage_id || "stage-negotiation",
        contact: { name: "Khaled Ali", email: "khaled@example.com", phone: "+966522222222" },
      };
    } else if (triggerType === "contact_tag_added") {
      mockData = {
        tag: triggerConfig.tag || "VIP Customer",
        contact: { name: "Noura Mansour", email: "noura@example.com", phone: "+966533333333" },
      };
    } else if (triggerType === "inbound_sms") {
      mockData = {
        from: "+966544444444",
        body: "Interested in the enterprise plan",
        contact: { name: "Fahad Omar", phone: "+966544444444" },
      };
    } else {
      mockData = {
        invoice_id: "inv_123",
        amount: 2500,
        contact: { name: "Zaid Tariq", email: "zaid@example.com" },
      };
    }

    setTestPayloadStr(JSON.stringify(mockData, null, 2));
    setTestResult(null);
    setTestModalOpen(true);
  };

  const handleExecuteTest = async () => {
    let parsedPayload: Record<string, any>;
    try {
      parsedPayload = JSON.parse(testPayloadStr);
    } catch {
      setTestResult({
        status: "failed",
        error: "Invalid JSON format in test payload.",
      });
      return;
    }

    setTestRunning(true);
    try {
      if (!workflowId) {
        setTestResult({
          status: "failed",
          error: "Please save the workflow first before running live execution simulation.",
        });
        setTestRunning(false);
        return;
      }

      const res = await testWorkflow({
        workflowId,
        mockPayload: parsedPayload,
      });

      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        status: "failed",
        error: err?.message || "Execution failed.",
      });
    } finally {
      setTestRunning(false);
    }
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] -m-4 sm:-m-6 lg:-m-8 bg-muted/20">
      {/* Studio Top Navigation Bar */}
      <StudioHeader
        name={name}
        onNameChange={setName}
        description={description}
        isActive={isActive}
        onIsActiveChange={setIsActive}
        canManage={canManage}
        isPending={isPending}
        hasWorkflowId={!!workflowId}
        onOpenTest={handleOpenTestModal}
        onOpenLogs={() => setLogsModalOpen(true)}
        onSave={handleSave}
        platform={platform}
      />

      {/* Status Alert Banner */}
      {statusMessage && (
        <div
          className={`px-4 py-2.5 text-xs flex items-center justify-between border-b ${
            statusMessage.type === "success"
              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
              : "bg-destructive/10 text-destructive border-destructive/20"
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="size-4 shrink-0" />
            ) : (
              <AlertTriangle className="size-4 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="hover:underline text-[11px] opacity-75"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Studio Canvas */}
      <StudioCanvas
        triggerType={triggerType}
        triggerConfig={triggerConfig}
        steps={steps}
        canManage={canManage}
        configOptions={configOptions}
        onOpenTriggerConfig={() => setTriggerConfigOpen(true)}
        onInsertStep={(idx) => setActionPickerInsertIndex(idx)}
        onSelectStepConfig={(step) => setSelectedStepForConfig(step)}
        onMoveStep={handleMoveStep}
        onDeleteStep={handleDeleteStep}
        platform={platform}
      />

      {/* TRIGGER CONFIGURATION MODAL */}
      <TriggerConfigDialog
        open={triggerConfigOpen}
        onOpenChange={setTriggerConfigOpen}
        triggerType={triggerType}
        onTriggerTypeChange={setTriggerType}
        triggerConfig={triggerConfig}
        onTriggerConfigChange={setTriggerConfig}
        description={description}
        onDescriptionChange={setDescription}
        configOptions={configOptions}
      />

      {/* ACTION PICKER MODAL */}
      <ActionPickerDialog
        open={actionPickerInsertIndex !== null}
        onOpenChange={(open) => {
          if (!open) setActionPickerInsertIndex(null);
        }}
        onSelectAction={handleAddStep}
        title={vb.addStep}
      />

      {/* STEP CONFIGURATION MODAL */}
      <StepConfigDialog
        step={selectedStepForConfig}
        open={!!selectedStepForConfig}
        onOpenChange={(open) => {
          if (!open) setSelectedStepForConfig(null);
        }}
        onSave={handleUpdateStepConfig}
        configOptions={configOptions}
        platform={platform}
        locale={locale}
      />

      {/* LIVE TEST RUNNER MODAL */}
      <SimulationTestDialog
        open={testModalOpen}
        onOpenChange={setTestModalOpen}
        payloadStr={testPayloadStr}
        onPayloadStrChange={setTestPayloadStr}
        onExecute={handleExecuteTest}
        isRunning={testRunning}
        testResult={testResult}
      />

      {/* EXECUTION LOGS DIALOG */}
      {workflowId && (
        <ExecutionLogsDialog
          logs={initialLogs}
          workflowName={name}
          open={logsModalOpen}
          onOpenChange={setLogsModalOpen}
          platform={platform}
          locale={locale}
        />
      )}
    </div>
  );
}

