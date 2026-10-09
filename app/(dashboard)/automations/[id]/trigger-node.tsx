"use client";

import {
  FileText,
  Calendar,
  Layers,
  Tag,
  PhoneCall,
  CreditCard,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  WORKFLOW_TRIGGER_DEFINITIONS,
  type WorkflowTriggerType,
} from "@/lib/validations/automations";
import type { AutomationConfigOptions } from "@/lib/actions/automations";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

interface TriggerNodeProps {
  triggerType: WorkflowTriggerType;
  triggerConfig: Record<string, any>;
  canManage: boolean;
  configOptions: AutomationConfigOptions;
  onOpenConfig: () => void;
  platform: Dictionary["platform"];
}

export function TriggerNode({
  triggerType,
  triggerConfig,
  canManage,
  configOptions,
  onOpenConfig,
  platform,
}: TriggerNodeProps) {
  const t = platform.automations;
  const vb = t.visualBuilder;
  const currentTriggerDef = WORKFLOW_TRIGGER_DEFINITIONS.find((d) => d.type === triggerType);

  return (
    <div className="rounded-2xl border-2 border-primary/40 bg-card p-5 shadow-sm transition-all hover:border-primary hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3.5">
          <div className="size-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-xs">
            {triggerType === "form_submitted" && <FileText className="size-5" />}
            {triggerType === "appointment_booked" && <Calendar className="size-5" />}
            {triggerType === "deal_stage_changed" && <Layers className="size-5" />}
            {triggerType === "contact_tag_added" && <Tag className="size-5" />}
            {triggerType === "inbound_sms" && <PhoneCall className="size-5" />}
            {triggerType === "invoice_paid" && <CreditCard className="size-5" />}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-wider uppercase text-primary">
                {vb.trigger}
              </span>
              <Badge variant="outline" className="text-[10px] py-0">
                {currentTriggerDef?.title || triggerType}
              </Badge>
            </div>
            <h3 className="text-sm font-semibold text-foreground mt-0.5">
              {t.triggerEvents[triggerType] || currentTriggerDef?.title}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {currentTriggerDef?.description}
            </p>
          </div>
        </div>

        {canManage && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenConfig}
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Settings2 className="size-3.5" />
            <span>{vb.configure}</span>
          </Button>
        )}
      </div>

      {/* Trigger Summary Preview */}
      <div className="mt-4 pt-3 border-t border-border flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Listening for:</span>
        {triggerType === "form_submitted" && (
          <span>
            {triggerConfig.form_id
              ? `Form: ${configOptions.forms.find((f) => f.id === triggerConfig.form_id)?.title || triggerConfig.form_id}`
              : "Any Form Submission"}
          </span>
        )}
        {triggerType === "deal_stage_changed" && (
          <span>
            {triggerConfig.stage_id
              ? `Deal moved to stage ID: ${triggerConfig.stage_id}`
              : "Any Deal Stage Progression"}
          </span>
        )}
        {triggerType === "contact_tag_added" && (
          <span>Tag: {triggerConfig.tag ? `"${triggerConfig.tag}"` : "Any contact tag"}</span>
        )}
        {triggerType === "inbound_sms" && (
          <span>
            {triggerConfig.phone_number
              ? `Number: ${triggerConfig.phone_number}`
              : "Any Incoming SMS"}
          </span>
        )}
        {(triggerType === "appointment_booked" || triggerType === "invoice_paid") && (
          <span>Standard payload triggers on event confirmation.</span>
        )}
      </div>
    </div>
  );
}