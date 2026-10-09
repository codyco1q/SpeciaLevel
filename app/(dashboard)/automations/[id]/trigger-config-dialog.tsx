"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  WORKFLOW_TRIGGER_DEFINITIONS,
  type WorkflowTriggerType,
} from "@/lib/validations/automations";
import type { AutomationConfigOptions } from "@/lib/actions/automations";

interface TriggerConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerType: WorkflowTriggerType;
  onTriggerTypeChange: (type: WorkflowTriggerType) => void;
  triggerConfig: Record<string, any>;
  onTriggerConfigChange: (config: Record<string, any>) => void;
  description: string;
  onDescriptionChange: (desc: string) => void;
  configOptions: AutomationConfigOptions;
}

export function TriggerConfigDialog({
  open,
  onOpenChange,
  triggerType,
  onTriggerTypeChange,
  triggerConfig,
  onTriggerConfigChange,
  description,
  onDescriptionChange,
  configOptions,
}: TriggerConfigDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Configure Automation Trigger</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Trigger Event Type</Label>
            <Select
              value={triggerType}
              onValueChange={(val: WorkflowTriggerType) => {
                onTriggerTypeChange(val);
                onTriggerConfigChange({});
              }}
            >
              <SelectTrigger className="text-xs h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WORKFLOW_TRIGGER_DEFINITIONS.map((def) => (
                  <SelectItem key={def.type} value={def.type} className="text-xs">
                    {def.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {triggerType === "form_submitted" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Specific Form</Label>
              <Select
                value={triggerConfig.form_id || "all"}
                onValueChange={(val) =>
                  onTriggerConfigChange({ ...triggerConfig, form_id: val === "all" ? undefined : val })
                }
              >
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="All Forms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any Form Submission</SelectItem>
                  {configOptions.forms.map((form) => (
                    <SelectItem key={form.id} value={form.id} className="text-xs">
                      {form.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {triggerType === "contact_tag_added" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Tag Name</Label>
              <Input
                value={triggerConfig.tag || ""}
                onChange={(e) => onTriggerConfigChange({ ...triggerConfig, tag: e.target.value })}
                placeholder="e.g. VIP, Prospect, High Value"
                className="text-xs h-9"
              />
            </div>
          )}

          {triggerType === "inbound_sms" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Target Twilio Phone Number</Label>
              <Select
                value={triggerConfig.phone_number || "all"}
                onValueChange={(val) =>
                  onTriggerConfigChange({ ...triggerConfig, phone_number: val === "all" ? undefined : val })
                }
              >
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="All Inbound Numbers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any Inbound Phone Number</SelectItem>
                  {configOptions.phoneNumbers.map((pn) => (
                    <SelectItem key={pn.id} value={pn.phoneNumber} className="text-xs">
                      {pn.label || pn.phoneNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5 pt-2">
            <Label className="text-xs font-medium">Workflow Description</Label>
            <Textarea
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="Explain what this automation sequence accomplishes..."
              className="text-sm min-h-[70px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Save Trigger Settings</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}