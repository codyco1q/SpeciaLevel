"use client";

import { useEffect, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, LoaderCircle } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  AUTOMATION_TRIGGER_EVENTS,
  AUTOMATION_ACTION_TYPES,
  createAutomationInputSchema,
  type AutomationTriggerEvent,
  type AutomationActionType,
} from "@/lib/validations/automations";
import {
  createAutomation,
  updateAutomation,
  type AutomationRow,
} from "@/lib/actions/automations";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import {
  AUTOMATION_TRIGGER_BADGE_CLASSES,
  AUTOMATION_ACTION_BADGE_CLASSES,
} from "./automation-meta";

export interface AutomationChannelOption {
  id: string;
  name: string;
}

export interface AutomationMemberOption {
  id: string;
  fullName: string | null;
  email: string | null;
}

interface AutomationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog runs in edit mode pre-filled with this row. */
  automation?: AutomationRow | null;
  /** Chat channels for the chat_message action (channel picker). */
  channels: AutomationChannelOption[];
  /** Org members for the create_task action (optional assignee). */
  members: AutomationMemberOption[];
  /** Called with the persisted automation after a successful create/update. */
  onCreated: (automation: AutomationRow) => void;
  /** Localized copy for the current render. */
  platform: Dictionary["platform"];
}

/**
 * Two-step "Create automation" wizard:
 *
 *   Step 1 — pick the trigger event (plus name/description).
 *   Step 2 — pick the action type and its configuration (webhook URL,
 *            channel + message, or task title + optional assignee).
 *
 * Submits to the `createAutomation` server action, which re-validates
 * everything server-side with the shared Zod schema and revalidates
 * /automations. Each step is validated locally with the same schema so
 * errors are shown before any mutation attempt.
 */
export function AutomationDialog({
  open,
  onOpenChange,
  automation = null,
  channels,
  members,
  onCreated,
  platform,
}: AutomationDialogProps) {
  const t = platform.automations;
  const messages = { ...t.errors };
  const isEditing = Boolean(automation);

  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerEvent, setTriggerEvent] = useState<AutomationTriggerEvent | "">("");
  const [actionType, setActionType] = useState<AutomationActionType | "">("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [channelId, setChannelId] = useState("");
  const [message, setMessage] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Re-seed the wizard every time the dialog opens — a fresh form in
  // create mode, or a pre-filled one in edit mode. setState calls are
  // deferred into a microtask so they never run synchronously in the
  // effect body (see react-hooks/set-state-in-effect).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setStep(1);
      setFieldErrors({});
      setServerError(null);
      if (automation) {
      setName(automation.name);
      setDescription(automation.description ?? "");
      const event = AUTOMATION_TRIGGER_EVENTS.includes(
        automation.triggerEvent as AutomationTriggerEvent
      )
        ? (automation.triggerEvent as AutomationTriggerEvent)
        : "";
      setTriggerEvent(event);
      const action = AUTOMATION_ACTION_TYPES.includes(
        automation.actionType as AutomationActionType
      )
        ? (automation.actionType as AutomationActionType)
        : "";
      setActionType(action);
      const config = automation.actionConfig ?? {};
      setWebhookUrl(typeof config.url === "string" ? config.url : "");
      setChannelId(typeof config.channelId === "string" ? config.channelId : "");
      setMessage(typeof config.message === "string" ? config.message : "");
      setTaskTitle(typeof config.taskTitle === "string" ? config.taskTitle : "");
      setAssigneeId(
        typeof config.assigneeId === "string" ? config.assigneeId : ""
      );
    } else {
      setName("");
      setDescription("");
      setTriggerEvent("");
      setActionType("");
      setWebhookUrl("");
      setChannelId("");
      setMessage("");
      setTaskTitle("");
      setAssigneeId("");
    }
    });
    return () => {
      cancelled = true;
    };
  }, [open, automation]);

  const handleOpenChange = (next: boolean) => {
    if (!next) setServerError(null);
    onOpenChange(next);
  };

  function mapIssues(issues: z.ZodIssue[]) {
    const map: Record<string, string> = {};
    for (const issue of issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !map[key]) map[key] = issue.message;
    }
    return map;
  }

  const inputSchema = createAutomationInputSchema(messages);
const fieldError = (key: string) =>
    fieldErrors[key] ? (
      <p role="alert" className="mt-1 text-sm text-destructive">
        {fieldErrors[key]}
      </p>
    ) : null;

  /** Validates step 1 fields with the shared schema (partial) before advancing. */
  function handleNext() {
    setServerError(null);
    const parsed = inputSchema
      .pick({ name: true, description: true, triggerEvent: true })
      .safeParse({ name, description, triggerEvent });
    if (!parsed.success) {
      setFieldErrors(mapIssues(parsed.error.issues));
      return;
    }
    setFieldErrors({});
    setStep(2);
  }

  function buildActionConfig() {
    switch (actionType) {
      case "webhook":
        return { actionType, url: webhookUrl };
      case "chat_message":
        return { actionType, channelId, message };
      case "create_task":
        return { actionType, taskTitle, assigneeId: assigneeId };
      default:
        return null;
    }
  }

  /** Converts server fieldErrors (string[]) back into ZodIssue-like objects. */
  function fromServerFieldErrors(
    fieldErrors: Record<string, string[]>
  ): z.ZodIssue[] {
    return Object.entries(fieldErrors).flatMap(([key, list]) =>
      (list ?? []).map((message) => ({
        path: [key],
        message,
        code: "custom",
      }))
    ) as z.ZodIssue[];
  }

  const onSubmit = () => {
    setServerError(null);
    const actionConfig = buildActionConfig();
    if (!actionConfig) {
      setServerError(messages.invalidConfig);
      return;
    }

    const parsed = inputSchema.safeParse({
      name,
      description,
      triggerEvent,
      actionConfig,
    });
    if (!parsed.success) {
      setFieldErrors(mapIssues(parsed.error.issues));
      return;
    }

    startTransition(async () => {
      const result = isEditing && automation
        ? await updateAutomation(automation.id, parsed.data)
        : await createAutomation(parsed.data);
      if (result.status === "error") {
        if (result.fieldErrors) {
          setFieldErrors(mapIssues(fromServerFieldErrors(result.fieldErrors)));
        }
        setServerError(result.error ?? messages.createFailed);
        return;
      }
      onCreated(result.automation);
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t.editAutomation : t.dialog.title}
          </DialogTitle>
          <DialogDescription>{t.dialog.description}</DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span
            className={cn(
              "rounded-full px-2 py-0.5",
              step === 1 ? "bg-primary/10 text-primary" : "bg-muted"
            )}
          >
            {t.dialog.step1Label}
          </span>
          <span className="h-px flex-1 bg-border" />
          <span
            className={cn(
              "rounded-full px-2 py-0.5",
              step === 2 ? "bg-primary/10 text-primary" : "bg-muted"
            )}
          >
            {t.dialog.step2Label}
          </span>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (step === 1) handleNext();
            else onSubmit();
          }}
          className="grid gap-4"
        >
          {step === 1 ? (
            <>
              {/* Step 1 — trigger event */}
              <div className="grid gap-2">
                <Label>{t.triggerEvent}</Label>
                <div
                  className="grid gap-2"
                  role="radiogroup"
                  aria-label={t.triggerEvent}
                >
                  {AUTOMATION_TRIGGER_EVENTS.map((event) => (
                    <button
                      key={event}
                      type="button"
                      role="radio"
                      aria-checked={triggerEvent === event}
                      onClick={() => setTriggerEvent(event)}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm transition-colors",
                        triggerEvent === event
                          ? "border-primary/60 bg-primary/5 text-foreground"
                          : "text-muted-foreground hover:bg-accent/50"
                      )}
                    >
                      <span className="font-medium">
                        {t.triggerEvents[event as keyof typeof t.triggerEvents]}
                      </span>
                      <span
                        className={cn(
                          "h-3 w-3 rounded-full border",
                          triggerEvent === event
                            ? "border-primary bg-primary"
                            : "border-muted-foreground/40"
                        )}
                      />
                    </button>
                  ))}
                </div>
                {fieldError("triggerEvent")}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="automation-name">{t.dialog.nameLabel}</Label>
                <Input
                  id="automation-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t.dialog.namePlaceholder}
                  aria-invalid={Boolean(fieldErrors.name)}
                />
                {fieldError("name")}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="automation-description">
                  {t.dialog.descriptionLabel}{" "}
                  <span className="text-muted-foreground">
                    ({t.dialog.descriptionOptional})
                  </span>
                </Label>
                <Textarea
                  id="automation-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder={t.dialog.descriptionPlaceholder}
                  rows={2}
                  aria-invalid={Boolean(fieldErrors.description)}
                />
                {fieldError("description")}
              </div>
            </>
          ) : (
            <>
              {/* Step 2 — action type */}
              <div className="grid gap-2">
                <Label>{t.actionType}</Label>
                <div
                  className="grid gap-2"
                  role="radiogroup"
                  aria-label={t.actionType}
                >
                  {AUTOMATION_ACTION_TYPES.map((action) => (
                    <button
                      key={action}
                      type="button"
                      role="radio"
                      aria-checked={actionType === action}
                      onClick={() => setActionType(action)}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm transition-colors",
                        actionType === action
                          ? "border-primary/60 bg-primary/5 text-foreground"
                          : "text-muted-foreground hover:bg-accent/50"
                      )}
                    >
                      <span>
                        {t.actionTypes[action as keyof typeof t.actionTypes]}
                      </span>
                      <span
                        className={cn(
                          "h-3 w-3 rounded-full border",
                          actionType === action
                            ? "border-primary bg-primary"
                            : "border-muted-foreground/40"
                        )}
                      />
                    </button>
                  ))}
                </div>
              </div>
              {/* Step 2 — action configuration */}
              {actionType === "webhook" && (
                <div className="grid gap-2">
                  <Label htmlFor="webhook-url">{t.dialog.webhookUrlLabel}</Label>
                  <Input
                    id="webhook-url"
                    value={webhookUrl}
                    onChange={(event) => setWebhookUrl(event.target.value)}
                    placeholder={t.dialog.webhookUrlPlaceholder}
                    dir="ltr"
                    aria-invalid={Boolean(fieldErrors.url)}
                  />
                  {fieldError("url")}
                </div>
              )}

              {actionType === "chat_message" && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="chat-channel">{t.dialog.channelLabel}</Label>
                    <Select value={channelId} onValueChange={setChannelId}>
                      <SelectTrigger id="chat-channel">
                        <SelectValue placeholder={t.dialog.channelPlaceholder} />
                      </SelectTrigger>
                      <SelectContent>
                        {channels.map((channel) => (
                          <SelectItem key={channel.id} value={channel.id}>
                            #{channel.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldError("channelId")}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="chat-message">{t.dialog.messageLabel}</Label>
                    <Textarea
                      id="chat-message"
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      placeholder={t.dialog.messagePlaceholder}
                      rows={3}
                      aria-invalid={Boolean(fieldErrors.message)}
                    />
                    {fieldError("message")}
                  </div>
                </>
              )}

              {actionType === "create_task" && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="task-title">{t.dialog.taskTitleLabel}</Label>
                    <Input
                      id="task-title"
                      value={taskTitle}
                      onChange={(event) => setTaskTitle(event.target.value)}
                      placeholder={t.dialog.taskTitlePlaceholder}
                      aria-invalid={Boolean(fieldErrors.taskTitle)}
                    />
                    {fieldError("taskTitle")}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="task-assignee">
                      {t.dialog.assigneeLabel}{" "}
                      <span className="text-muted-foreground">
                        ({t.dialog.assigneeOptional})
                      </span>
                    </Label>
                    <Select value={assigneeId} onValueChange={setAssigneeId}>
                      <SelectTrigger id="task-assignee">
                        <SelectValue placeholder={t.dialog.assigneeOptional} />
                      </SelectTrigger>
                      <SelectContent>
                        {members.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.fullName || member.email || member.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldError("assigneeId")}
                  </div>
                </>
              )}

              {actionType && (
                <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  <span
                    className={cn(
                      "me-2 inline-block rounded-full border px-1.5 py-0 text-[10px] font-medium",
                      AUTOMATION_ACTION_BADGE_CLASSES[actionType]
                    )}
                  >
                    {t.actionTypes[actionType as keyof typeof t.actionTypes]}
                  </span>
                  <span className="font-medium text-foreground">{name}</span>
                  {triggerEvent && (
                    <span
                      className={cn(
                        "ms-2 inline-block rounded-full border px-1.5 py-0 text-[10px] font-medium",
                        AUTOMATION_TRIGGER_BADGE_CLASSES[triggerEvent]
                      )}
                    >
                      {t.triggerEvents[triggerEvent as keyof typeof t.triggerEvents]}
                    </span>
                  )}
                </div>
              )}
            </>
          )}

          {serverError && (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {serverError}
            </p>
          )}

          <DialogFooter className="sm:justify-between">
            {step === 2 ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStep(1);
                  setServerError(null);
                }}
                disabled={isPending}
              >
                <ArrowLeft className="size-4 rtl:rotate-180" />
                {t.dialog.back}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                {platform.common.cancel}
              </Button>
            )}

            {step === 1 ? (
              <Button type="submit">
                {t.dialog.next}
                <ArrowRight className="size-4 rtl:rotate-180" />
              </Button>
            ) : (
              <Button type="submit" disabled={isPending}>
                {isPending && <LoaderCircle className="size-4 animate-spin" />}
                {isEditing ? t.saveChanges : t.dialog.create}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}