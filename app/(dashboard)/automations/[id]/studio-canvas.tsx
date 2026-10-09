"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TriggerNode } from "./trigger-node";
import { StepNode } from "./step-node";
import type {
  WorkflowTriggerType,
  WorkflowStep,
} from "@/lib/validations/automations";
import type { AutomationConfigOptions } from "@/lib/actions/automations";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

interface StudioCanvasProps {
  triggerType: WorkflowTriggerType;
  triggerConfig: Record<string, any>;
  steps: WorkflowStep[];
  canManage: boolean;
  configOptions: AutomationConfigOptions;
  onOpenTriggerConfig: () => void;
  onInsertStep: (index: number) => void;
  onSelectStepConfig: (step: WorkflowStep) => void;
  onMoveStep: (index: number, direction: "up" | "down") => void;
  onDeleteStep: (stepId: string) => void;
  platform: Dictionary["platform"];
}

export function StudioCanvas({
  triggerType,
  triggerConfig,
  steps,
  canManage,
  configOptions,
  onOpenTriggerConfig,
  onInsertStep,
  onSelectStepConfig,
  onMoveStep,
  onDeleteStep,
  platform,
}: StudioCanvasProps) {
  return (
    <main className="flex-1 overflow-y-auto p-4 sm:p-8 flex flex-col items-center">
      <div className="w-full max-w-2xl space-y-4">
        {/* 1. TRIGGER NODE */}
        <TriggerNode
          triggerType={triggerType}
          triggerConfig={triggerConfig}
          canManage={canManage}
          configOptions={configOptions}
          onOpenConfig={onOpenTriggerConfig}
          platform={platform}
        />

        {/* Insertion Node After Trigger */}
        {canManage && (
          <div className="flex flex-col items-center my-2">
            <div className="h-6 w-0.5 bg-border" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => onInsertStep(0)}
              className="h-7 text-[11px] gap-1 rounded-full px-3 shadow-2xs border-dashed border-border hover:border-primary hover:text-primary transition-all bg-card"
            >
              <Plus className="size-3" />
              <span>Insert First Step</span>
            </Button>
            <div className="h-6 w-0.5 bg-border" />
          </div>
        )}

        {/* 2. SEQUENTIAL ACTION STEPS */}
        {steps.map((step, index) => (
          <div key={step.id} className="relative group">
            <StepNode
              step={step}
              index={index}
              totalSteps={steps.length}
              canManage={canManage}
              onOpenConfig={() => onSelectStepConfig(step)}
              onMove={(dir) => onMoveStep(index, dir)}
              onDelete={() => onDeleteStep(step.id)}
            />

            {/* Insertion Node Between Steps or at End */}
            {canManage && (
              <div className="flex flex-col items-center my-2">
                <div className="h-6 w-0.5 bg-border" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onInsertStep(index + 1)}
                  className="h-7 text-[11px] gap-1 rounded-full px-3 shadow-2xs border-dashed border-border hover:border-primary hover:text-primary transition-all bg-card"
                >
                  <Plus className="size-3" />
                  <span>Insert Step</span>
                </Button>
                {index < steps.length - 1 && <div className="h-6 w-0.5 bg-border" />}
              </div>
            )}
          </div>
        ))}

        {/* Empty Steps State */}
        {steps.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center bg-card/40">
            <p className="text-xs text-muted-foreground">
              No action steps added yet. Click &quot;Insert First Step&quot; above to add automated responses, SMS, webhooks, or CRM tags.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}