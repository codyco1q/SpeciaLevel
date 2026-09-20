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
} from "@/lib/actions/crm";
import { CRM_CURRENCIES, CRM_STAGES } from "./crm-meta";
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
  onSaved: () => void;
  /** Localized copy + validation messages for the current render. */
  platform: Dictionary["platform"];
}

/**
 * Create / convert / edit deal dialog backed by react-hook-form + the shared
 * Zod schema.
 */
export function DealDialog({
  open,
  onOpenChange,
  lead = null,
  deal = null,
  members,
  onSaved,
  platform,
}: DealDialogProps) {
  const t = platform.crm;
  const common = platform.common;
  const isConvert = lead !== null && lead !== undefined;
  const isEdit = deal !== null && deal !== undefined;
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    setError,
    formState: { errors },
  } = useForm<CrmDealInput>({
    resolver: zodResolver(createCrmDealInputSchema(t.errors)),
    defaultValues: {
      title: "",
      value: 0,
      currency: "USD",
      stage: "lead",
      notes: "",
      assignedTo: "",
      contact: { name: "", email: "", company: "", phone: "" },
    },
  });

  // Re-seed the form every time the dialog opens so it always reflects a
  // pristine create form, the lead being converted, or the deal being edited.
  useEffect(() => {
    if (!open) return;
    if (deal) {
      reset({
        title: deal.title,
        value: deal.value,
        currency: (deal.currency as "USD" | "EUR" | "GBP" | "AED" | "SAR") || "USD",
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
        title: "",
        value: 0,
        currency: "USD",
        stage: "lead",
        notes: "",
        assignedTo: "",
        contact: {
          name: lead?.name ?? "",
          email: lead?.email ?? "",
          company: lead?.company ?? "",
          phone: "",
        },
      });
    }
  }, [open, lead, deal, reset]);

  // Clear any leftover server error the moment the dialog closes.
  const handleOpenChange = (next: boolean) => {
    if (!next) setServerError(null);
    onOpenChange(next);
  };

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    startTransition(() => {
      const action = isEdit
        ? updateDeal(deal.id, values)
        : isConvert
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
                name="stage"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) =>
                      field.onChange(value as CrmDealInput["stage"])
                    }
                  >
                    <SelectTrigger id="deal-stage" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CRM_STAGES.map((stage) => (
                        <SelectItem key={stage} value={stage}>
                          {t.stages[stage]}
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