"use client";

import { useState, useEffect } from "react";
import {
  MessageCircle,
  Bell,
  Tag,
  ArrowRightCircle,
  Webhook,
  Clock,
  Sparkles,
  Info,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  WORKFLOW_ACTION_DEFINITIONS,
  WORKFLOW_TEMPLATE_VARIABLES,
} from "@/lib/validations/automations";
import type { AutomationConfigOptions } from "@/lib/actions/automations";
import type { WorkflowStep } from "@/types/database";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

interface StepConfigDialogProps {
  step: WorkflowStep | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updatedStep: WorkflowStep) => void;
  configOptions: AutomationConfigOptions;
  platform: Dictionary["platform"];
  locale: Locale;
}

export function StepConfigDialog({
  step,
  open,
  onOpenChange,
  onSave,
  configOptions,
  platform,
}: StepConfigDialogProps) {
  const t = platform.automations;
  const vb = t.visualBuilder;

  const [name, setName] = useState("");
  const [config, setConfig] = useState<Record<string, any>>({});

  useEffect(() => {
    if (step) {
      setName(step.name || "");
      setConfig({ ...step.config });
    }
  }, [step]);

  if (!step) return null;

  const def = WORKFLOW_ACTION_DEFINITIONS.find((d) => d.type === step.action_type);

  const handleInsertVariable = (fieldKey: string, variableKey: string) => {
    const currentVal = config[fieldKey] || "";
    setConfig({
      ...config,
      [fieldKey]: `${currentVal}${currentVal ? " " : ""}${variableKey}`,
    });
  };

  const handleSave = () => {
    onSave({
      ...step,
      name: name.trim() || undefined,
      config,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              {step.action_type === "send_sms" && <MessageCircle className="size-5" />}
              {step.action_type === "send_notification" && <Bell className="size-5" />}
              {step.action_type === "add_tag" && <Tag className="size-5" />}
              {step.action_type === "update_deal_stage" && <ArrowRightCircle className="size-5" />}
              {step.action_type === "webhook" && <Webhook className="size-5" />}
              {step.action_type === "delay" && <Clock className="size-5" />}
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                {vb.configure}: {t.actionTypes[step.action_type] || def?.name}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{def?.description}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Step Label</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={def?.name || "Step name"}
              className="text-sm"
            />
          </div>

          {step.action_type === "send_sms" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{vb.recipientContact}</Label>
                <Select
                  value={config.recipient || "contact"}
                  onValueChange={(val) => setConfig({ ...config, recipient: val })}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contact">{vb.recipientContact}</SelectItem>
                    <SelectItem value="custom">{vb.recipientCustom}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {config.recipient === "custom" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Custom Phone Number</Label>
                  <Input
                    value={config.custom_number || ""}
                    onChange={(e) => setConfig({ ...config, custom_number: e.target.value })}
                    placeholder={vb.customPhonePlaceholder}
                    dir="ltr"
                    className="font-mono text-sm"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{vb.smsBodyLabel}</Label>
                <Textarea
                  value={config.body || ""}
                  onChange={(e) => setConfig({ ...config, body: e.target.value })}
                  placeholder="Hi {{contact.name}}, thank you for reaching out..."
                  className="min-h-[90px] text-sm"
                />
              </div>

              <div className="rounded-lg bg-muted/40 p-3 border border-border/60">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-2">
                  <Sparkles className="size-3.5 text-primary" />
                  {vb.variablesHint}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {WORKFLOW_TEMPLATE_VARIABLES.map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => handleInsertVariable("body", v.key)}
                      className="inline-flex items-center px-2 py-0.5 rounded bg-background border text-[11px] font-mono hover:border-primary transition-colors"
                      title={v.label}
                    >
                      {v.key}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step.action_type === "send_notification" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{vb.notificationTarget}</Label>
                <Select
                  value={config.target || "admins"}
                  onValueChange={(val) => setConfig({ ...config, target: val })}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admins">Organization Admins & Managers</SelectItem>
                    <SelectItem value="all">All Organization Members</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{vb.notificationTitleLabel}</Label>
                <Input
                  value={config.title || ""}
                  onChange={(e) => setConfig({ ...config, title: e.target.value })}
                  placeholder="e.g., New Lead Alert: {{contact.name}}"
                  className="text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{vb.notificationMessageLabel}</Label>
                <Textarea
                  value={config.message || ""}
                  onChange={(e) => setConfig({ ...config, message: e.target.value })}
                  placeholder="e.g., {{contact.name}} from {{contact.company}} just submitted a form."
                  className="min-h-[80px] text-sm"
                />
              </div>

              <div className="rounded-lg bg-muted/40 p-3 border border-border/60">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-2">
                  <Sparkles className="size-3.5 text-primary" />
                  {vb.variablesHint}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {WORKFLOW_TEMPLATE_VARIABLES.slice(0, 6).map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => handleInsertVariable("message", v.key)}
                      className="inline-flex items-center px-2 py-0.5 rounded bg-background border text-[11px] font-mono hover:border-primary transition-colors"
                    >
                      {v.key}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step.action_type === "add_tag" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{vb.targetTagLabel}</Label>
                <Input
                  value={config.tag || ""}
                  onChange={(e) => setConfig({ ...config, tag: e.target.value })}
                  placeholder="e.g., VIP Lead, Inbound 2026"
                  className="text-sm"
                />
              </div>

              {configOptions.tags.length > 0 && (
                <div className="rounded-lg bg-muted/40 p-3 border border-border/60">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Existing Tags in CRM:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {configOptions.tags.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setConfig({ ...config, tag: t })}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-background border text-xs hover:border-primary hover:text-primary transition-colors"
                      >
                        <Tag className="size-3" />
                        <span>{t}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step.action_type === "update_deal_stage" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{vb.selectStageLabel}</Label>
                <Select
                  value={config.stage_id || ""}
                  onValueChange={(val) => setConfig({ ...config, stage_id: val })}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Select target stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {configOptions.pipelines.flatMap((pipe) =>
                      pipe.stages.map((st) => (
                        <SelectItem key={st.id} value={st.id}>
                          {pipe.name} &rarr; {st.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {step.action_type === "webhook" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{vb.webhookUrlLabel}</Label>
                <Input
                  value={config.url || ""}
                  onChange={(e) => setConfig({ ...config, url: e.target.value })}
                  placeholder="https://api.example.com/webhook"
                  dir="ltr"
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{vb.webhookMethodLabel}</Label>
                <Select
                  value={config.method || "POST"}
                  onValueChange={(val) => setConfig({ ...config, method: val })}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="POST">POST (JSON payload)</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-lg bg-muted/40 p-3 border border-border/60 text-xs text-muted-foreground flex items-start gap-2">
                <Info className="size-4 shrink-0 text-primary mt-0.5" />
                <p>SpeciaLevel will dispatch an automated HTTP POST request containing trigger metadata and the event payload.</p>
              </div>
            </div>
          )}

          {step.action_type === "delay" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{vb.delayMinutesLabel}</Label>
                <Input
                  type="number"
                  min={1}
                  max={1440}
                  value={config.duration_minutes || 5}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      duration_minutes: Math.max(1, parseInt(e.target.value, 10) || 1),
                    })
                  }
                  className="text-sm"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {platform.common.cancel}
          </Button>
          <Button onClick={handleSave}>
            {platform.common.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
