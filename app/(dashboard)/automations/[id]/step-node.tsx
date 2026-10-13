"use client";

import {
  MessageCircle,
  Bell,
  Mail,
  Tag,
  ArrowRightCircle,
  Webhook,
  Clock,
  Trash2,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  WORKFLOW_ACTION_DEFINITIONS,
  type WorkflowStep,
} from "@/lib/validations/automations";
import { cn } from "@/lib/utils";

interface StepNodeProps {
  step: WorkflowStep;
  index: number;
  totalSteps?: number;
  canManage: boolean;
  onOpenConfig: () => void;
  onMove?: (direction: "up" | "down") => void;
  onDelete: () => void;
  isDragging?: boolean;
  isDragOver?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

export function StepNode({
  step,
  index,
  totalSteps: _totalSteps,
  canManage,
  onOpenConfig,
  onMove: _onMove,
  onDelete,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: StepNodeProps) {
  const actionDef = WORKFLOW_ACTION_DEFINITIONS.find((a) => a.type === step.action_type);
  const cfg = { ...(step.action_config || {}), ...(step.config || {}) };

  const getDelaySummary = () => {
    const unit = cfg.unit || "minutes";
    const duration = cfg.duration ?? cfg.delay_minutes ?? cfg.duration_minutes ?? 10;
    if (unit === "days") {
      return `Wait for ${duration} day${duration > 1 ? "s" : ""}`;
    }
    if (unit === "hours") {
      return `Wait for ${duration} hour${duration > 1 ? "s" : ""}`;
    }
    return `Wait for ${duration} minute${duration > 1 ? "s" : ""}`;
  };

  return (
    <div
      draggable={canManage}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={onOpenConfig}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenConfig();
        }
      }}
      className={cn(
        "group relative rounded-2xl border bg-card p-4.5 shadow-xs transition-all text-left",
        "cursor-pointer hover:border-primary/60 hover:ring-2 hover:ring-primary/20 hover:shadow-md",
        isDragging && "opacity-40 scale-95 border-dashed border-primary",
        isDragOver && "ring-2 ring-primary border-primary bg-primary/5",
        !isDragging && !isDragOver && "border-border"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {canManage && (
            <div
              className="mt-1 -ml-1 text-muted-foreground/50 group-hover:text-foreground cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted/80 transition-colors shrink-0"
              title="Drag to reorder step"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="size-4" />
            </div>
          )}

          <div className="size-9 rounded-xl bg-muted text-foreground flex items-center justify-center shrink-0 border border-border">
            {step.action_type === "send_sms" && <MessageCircle className="size-4 text-blue-500" />}
            {step.action_type === "send_notification" && <Bell className="size-4 text-amber-500" />}
            {step.action_type === "send_email" && <Mail className="size-4 text-emerald-500" />}
            {step.action_type === "add_tag" && <Tag className="size-4 text-purple-500" />}
            {step.action_type === "update_deal_stage" && <ArrowRightCircle className="size-4 text-rose-500" />}
            {step.action_type === "webhook" && <Webhook className="size-4 text-indigo-500" />}
            {step.action_type === "delay" && <Clock className="size-4 text-orange-500" />}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">
                Step {index + 1}
              </span>
              <Badge variant="secondary" className="text-[10px] py-0 font-medium">
                {actionDef?.title || actionDef?.name || step.action_type}
              </Badge>
            </div>
            <h4 className="text-sm font-semibold text-foreground mt-0.5 truncate">
              {step.name || actionDef?.title || actionDef?.name}
            </h4>

            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
              {step.action_type === "send_sms" &&
                `SMS to: ${cfg.phone_number || cfg.custom_number || "Contact"} - "${cfg.body || cfg.message_template || cfg.message || ""}"`}
              {step.action_type === "send_notification" &&
                `Title: "${cfg.title || ""}" - Target: ${cfg.target || "admins"}`}
              {step.action_type === "send_email" &&
                `Email to: ${cfg.to || cfg.custom_email || "Contact"} - Subject: "${cfg.subject || ""}"`}
              {step.action_type === "add_tag" &&
                `Apply Tag: "${cfg.tag || cfg.target_tag || ""}"`}
              {step.action_type === "update_deal_stage" &&
                `Move to stage ID: ${cfg.stage_id || cfg.target_stage_id || "Unspecified"}`}
              {step.action_type === "webhook" &&
                `HTTP ${cfg.method || "POST"} -> ${cfg.url || cfg.target_url || ""}`}
              {step.action_type === "delay" && getDelaySummary()}
            </p>
          </div>
        </div>

        {canManage && (
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
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