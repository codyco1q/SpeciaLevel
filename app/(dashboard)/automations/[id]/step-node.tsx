"use client";

import {
  MessageCircle,
  Bell,
  Mail,
  Tag,
  ArrowRightCircle,
  Webhook,
  Clock,
  Settings2,
  ChevronUp,
  ChevronDown,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  WORKFLOW_ACTION_DEFINITIONS,
  type WorkflowStep,
} from "@/lib/validations/automations";

interface StepNodeProps {
  step: WorkflowStep;
  index: number;
  totalSteps: number;
  canManage: boolean;
  onOpenConfig: () => void;
  onMove: (direction: "up" | "down") => void;
  onDelete: () => void;
}

export function StepNode({
  step,
  index,
  totalSteps,
  canManage,
  onOpenConfig,
  onMove,
  onDelete,
}: StepNodeProps) {
  const actionDef = WORKFLOW_ACTION_DEFINITIONS.find((a) => a.type === step.action_type);

  return (
    <div className="rounded-2xl border border-border bg-card p-4.5 shadow-xs transition-all hover:border-border/80 hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3.5">
          <div className="size-9 rounded-xl bg-muted text-foreground flex items-center justify-center shrink-0 border border-border">
            {step.action_type === "send_sms" && <MessageCircle className="size-4 text-blue-500" />}
            {step.action_type === "send_notification" && <Bell className="size-4 text-amber-500" />}
            {step.action_type === "send_email" && <Mail className="size-4 text-emerald-500" />}
            {step.action_type === "add_tag" && <Tag className="size-4 text-purple-500" />}
            {step.action_type === "update_deal_stage" && <ArrowRightCircle className="size-4 text-rose-500" />}
            {step.action_type === "webhook" && <Webhook className="size-4 text-indigo-500" />}
            {step.action_type === "delay" && <Clock className="size-4 text-orange-500" />}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">
                Step {index + 1}
              </span>
              <Badge variant="secondary" className="text-[10px] py-0">
                {actionDef?.title || step.action_type}
              </Badge>
            </div>
            <h4 className="text-sm font-semibold text-foreground mt-0.5">
              {step.name || actionDef?.title}
            </h4>

            {/* Step action summary */}
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
              {step.action_type === "send_sms" &&
                `SMS to: ${step.action_config?.phone_number || "Contact"} - "${step.action_config?.message_template || ""}"`}
              {step.action_type === "send_notification" &&
                `Title: "${step.action_config?.title || ""}"`}
              {step.action_type === "send_email" &&
                `Email to: ${step.action_config?.to || "Contact"} - Subject: "${step.action_config?.subject || ""}"`}
              {step.action_type === "add_tag" &&
                `Apply Tag: "${step.action_config?.tag || ""}"`}
              {step.action_type === "update_deal_stage" &&
                `Move to stage: ${step.action_config?.stage_id || "Unspecified"}`}
              {step.action_type === "webhook" &&
                `HTTP ${step.action_config?.method || "POST"} -> ${step.action_config?.url || ""}`}
              {step.action_type === "delay" &&
                `Wait for ${step.action_config?.delay_minutes || 10} minutes`}
            </p>
          </div>
        </div>

        {canManage && (
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              disabled={index === 0}
              onClick={() => onMove("up")}
              className="size-7 text-muted-foreground hover:text-foreground"
              title="Move step up"
            >
              <ChevronUp className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={index === totalSteps - 1}
              onClick={() => onMove("down")}
              className="size-7 text-muted-foreground hover:text-foreground"
              title="Move step down"
            >
              <ChevronDown className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenConfig}
              className="size-7 text-muted-foreground hover:text-foreground"
              title="Configure step"
            >
              <Settings2 className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              className="size-7 text-destructive hover:bg-destructive/10"
              title="Delete step"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}