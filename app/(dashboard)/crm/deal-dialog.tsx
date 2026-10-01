"use client";

import { useEffect, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createCrmDealInputSchema,
  type CrmDealInput,
} from "@/lib/validations/crm";
import {
  convertLeadToDeal,
  createDeal,
  updateDeal,
  type DealRow,
  type MarketingLeadRow,
  type PipelineRow,
} from "@/lib/actions/crm";
import { CRM_CURRENCIES, getStageName } from "./crm-meta";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

export interface CrmMemberOption {
  id: string;
  fullName: string | null;
  email: string | null;
}

interface DealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Non-null opens the dialog in "convert inbound lead" mode. */
  lead?: MarketingLeadRow | null;
  /** Non-null opens the dialog in "edit deal" mode. */
  deal?: DealRow | null;
  /** Active organization members available for assignment. */
  members: CrmMemberOption[];
  pipelines?: PipelineRow[];
  activePipelineId?: string;
  onSaved: () => void;
  /** Localized copy + validation messages for the current render. */
  platform: Dictionary["platform"];
}

export function DealDialog({
  open,
  onOpenChange,
  lead = null,
  deal = null,
  members,
  pipelines = [],
  activePipelineId,
  onSaved,
  platform,
}: DealDialogProps) {
  const t = platform.crm;
  const common = platform.common;
  const isConvert = lead !== null && lead !== undefined;
  const isEdit = deal !== null && deal !== undefined;
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const fallbackPipelineId = activePipelineId || pipelines[0]?.id || "";
  const initialPipeline = pipelines.find((p) => p.id === (deal?.pipelineId || fallbackPipelineId)) || pipelines[0];

  const [selectedPipelineId, setSelectedPipelineId] = useState<string>(
    deal?.pipelineId || fallbackPipelineId
  );

  const currentPipeline = pipelines.find((p) => p.id === selectedPipelineId) || initialPipeline;
  const currentStages = currentPipeline?.stages || [];

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    setError,
    formState: { errors },
  } = useForm<CrmDealInput>({
    resolver: zodResolver(createCrmDealInputSchema(t.errors)),
    defaultValues: {
      title: "",
      value: 0,
      currency: "USD",
      pipelineId: fallbackPipelineId,
      stageId: currentStages[0]?.id || "",
      stage: currentStages[0]?.name.toLowerCase() || "lead",
      notes: "",
      assignedTo: "",
      contact: { name: "", email: "", company: "", phone: "" },
    },
  });

  useEffect(() => {
    if (!open) return;
    const initialPipe = pipelines.find((p) => p.id === (deal?.pipelineId || activePipelineId || pipelines[0]?.id)) || pipelines[0];
    const initialPipeId = initialPipe?.id || "";
    setSelectedPipelineId(initialPipeId);

    if (deal) {
      reset({
        title: deal.title,
        value: deal.value,
        currency: (deal.currency as "USD" | "EUR" | "GBP" | "AED" | "SAR") || "USD",
        pipelineId: deal.pipelineId || initialPipeId,
        stageId: deal.stageId || initialPipe?.stages[0]?.id || "",
        stage: deal.stage,
        notes: deal.notes ?? "",
        assignedTo: deal.assignee?.id ?? "",
        contact: {
          name: deal.contact?.name ?? "",
          email: deal.contact?.email ?? "",
          company: deal.contact?.company ?? "",
          phone: deal.contact?.phone ?? "",
        },
      });
    } else {
      reset({
        title: lead ? `${lead.name} — ${lead.company || lead.packageOfInterest || "Inquiry"}` : "",
        value: 0,
        currency: "USD",
        pipelineId: initialPipeId,
        stageId: initialPipe?.stages[0]?.id || "",
        stage: initialPipe?.stages[0]?.name.toLowerCase() || "lead",
        notes: lead ? [lead.bottleneck && `Bottleneck: ${lead.bottleneck}`, lead.packageOfInterest && `Package: ${lead.packageOfInterest}`].filter(Boolean).join("\n") : "",
        assignedTo: "",
        contact: {
          name: lead?.name ?? "",
          email: lead?.email ?? "",
          company: lead?.company ?? "",
          phone: "",
        },
      });
    }
    setServerError(null);
  }, [open, deal, lead, activePipelineId, pipelines, reset]);

  function handlePipelineSelect(pipeId: string) {
    setSelectedPipelineId(pipeId);
    setValue("pipelineId", pipeId);
    const pipe = pipelines.find((p) => p.id === pipeId);
    if (pipe && pipe.stages[0]) {
      setValue("stageId", pipe.stages[0].id);
      setValue("stage", pipe.stages[0].name.toLowerCase());
    }
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) setServerError(null);
    onOpenChange(next);
  };

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    startTransition(() => {
      const action = isEdit && deal
        ? updateDeal(deal.id, values)
        : isConvert && lead
          ? convertLeadToDeal(lead.id, values)
          : createDeal(values);
      void action.then((result) => {
        if (result.status === "error") {
          setServerError(result.error ?? t.errors.createFailed);
          if (result.fieldErrors) {
            for (const [field, messages] of Object.entries(
              result.fieldErrors
            )) {
              if (messages?.[0]) {
                setError(field as keyof CrmDealInput, {
                  type: "server",
                  message: messages[0],
                });
              }
            }
          }
          return;
        }
        onSaved();
        onOpenChange(false);
      });
    });
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>
              {isEdit
                ? t.dealDialog.editTitle
                : isConvert
                  ? t.dealDialog.convertTitle
                  : t.dealDialog.createTitle}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? t.dealDialog.editDescription
                : isConvert
                  ? t.dealDialog.convertDescription
                  : t.dealDialog.createDescription}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="deal-title">{t.dealDialog.titleLabel}</Label>
            <Input
              id="deal-title"
              placeholder={t.dealDialog.titlePlaceholder}
              {...register("title")}
              aria-invalid={Boolean(errors.title)}
            />
            {errors.title && (
              <p role="alert" className="text-sm text-destructive">
                {errors.title.message}
              </p>
            )}
          </div>

          {/* Pipeline Selector (if multiple pipelines) */}
          {pipelines.length > 1 && (
            <div className="grid gap-2">
              <Label htmlFor="deal-pipeline">{t.pipelines.pipeline}</Label>
              <Select
                value={selectedPipelineId}
                onValueChange={handlePipelineSelect}
              >
                <SelectTrigger id="deal-pipeline" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map((pipe) => (
                    <SelectItem key={pipe.id} value={pipe.id}>
                      {pipe.name} {pipe.isDefault ? `(${t.pipelines.isDefault})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="deal-value">{t.dealDialog.valueLabel}</Label>
              <Input
                id="deal-value"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                placeholder={t.dealDialog.valuePlaceholder}
                {...register("value", { valueAsNumber: true })}
                aria-invalid={Boolean(errors.value)}
                className="tabular-nums"
              />
              {errors.value && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.value.message}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="deal-currency">{t.dealDialog.currencyLabel}</Label>
              <Controller
                name="currency"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="deal-currency" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CRM_CURRENCIES.map((code) => (
                        <SelectItem key={code} value={code}>
                          {code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="deal-stage">{t.dealDialog.stageLabel}</Label>
              <Controller
                name="stageId"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value || currentStages[0]?.id || ""}
                    onValueChange={(val) => {
                      field.onChange(val);
                      const matched = currentStages.find((s) => s.id === val);
                      if (matched) setValue("stage", matched.name.toLowerCase());
                    }}
                  >
                    <SelectTrigger id="deal-stage" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currentStages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          <div className="flex items-center justify-between gap-3 w-full">
                            <div className="flex items-center gap-2">
                              <span
                                className="size-2 rounded-full shrink-0"
                                style={{ backgroundColor: stage.color || "#3b82f6" }}
                              />
                              <span>{getStageName(stage.name, t.stages as Record<string, string>)}</span>
                            </div>
                            <span className="text-[10px] font-mono text-muted-foreground ms-2">
                              {stage.stageType === "won" ? "🏆 100%" : stage.stageType === "lost" ? "❌ 0%" : `${stage.probability}%`}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="deal-assignee">{t.dealDialog.assigneeLabel}</Label>
            <Controller
              name="assignedTo"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value || "none"}
                  onValueChange={(value) =>
                    field.onChange(value === "none" ? "" : value)
                  }
                >
                  <SelectTrigger id="deal-assignee" className="w-full">
                    <SelectValue placeholder={t.unassigned} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t.unassigned}</SelectItem>
                    {members.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.fullName ?? member.email ?? t.unnamed}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="deal-notes">{t.dealDialog.notesLabel}</Label>
            <Textarea
              id="deal-notes"
              rows={2}
              placeholder={t.dealDialog.notesPlaceholder}
              {...register("notes")}
              aria-invalid={Boolean(errors.notes)}
            />
            {errors.notes && (
              <p role="alert" className="text-sm text-destructive">
                {errors.notes.message}
              </p>
            )}
          </div>

          <div className="rounded-lg border border-border bg-card/60 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">
                {t.dealDialog.contactSection}
              </p>
              <p className="text-xs text-muted-foreground">
                {t.dealDialog.contactHint}
              </p>
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="deal-contact-name">
                  {t.dealDialog.contactNameLabel}
                </Label>
                <Input
                  id="deal-contact-name"
                  placeholder={t.dealDialog.contactNamePlaceholder}
                  {...register("contact.name")}
                  aria-invalid={Boolean(errors.contact?.name)}
                />
                {errors.contact?.name && (
                  <p role="alert" className="text-sm text-destructive">
                    {errors.contact.name.message}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="deal-contact-email">
                  {t.dealDialog.contactEmailLabel}
                </Label>
                <Input
                  id="deal-contact-email"
                  type="email"
                  placeholder={t.dealDialog.contactEmailPlaceholder}
                  {...register("contact.email")}
                  aria-invalid={Boolean(errors.contact?.email)}
                />
                {errors.contact?.email && (
                  <p role="alert" className="text-sm text-destructive">
                    {errors.contact.email.message}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="deal-contact-company">
                  {t.dealDialog.contactCompanyLabel}
                </Label>
                <Input
                  id="deal-contact-company"
                  placeholder={t.dealDialog.contactCompanyPlaceholder}
                  {...register("contact.company")}
                  aria-invalid={Boolean(errors.contact?.company)}
                />
                {errors.contact?.company && (
                  <p role="alert" className="text-sm text-destructive">
                    {errors.contact.company.message}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="deal-contact-phone">
                  {t.dealDialog.contactPhoneLabel}
                </Label>
                <Input
                  id="deal-contact-phone"
                  type="tel"
                  placeholder={t.dealDialog.contactPhonePlaceholder}
                  {...register("contact.phone")}
                  aria-invalid={Boolean(errors.contact?.phone)}
                />
                {errors.contact?.phone && (
                  <p role="alert" className="text-sm text-destructive">
                    {errors.contact.phone.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {serverError && (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {serverError}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {common.cancel}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {isEdit
                ? t.dealDialog.edit
                : isConvert
                  ? t.dealDialog.convert
                  : t.dealDialog.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}