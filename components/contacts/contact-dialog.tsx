"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
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
  createContactInputSchema,
  parseTagsInput,
  joinTagsInput,
  type ContactInput,
} from "@/lib/validations/contacts";
import {
  createContact,
  updateContact,
  type ContactSummaryRow,
} from "@/lib/actions/contacts";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

export interface ContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: ContactSummaryRow | null;
  onSaved: () => void;
  platform: Dictionary["platform"];
}

export function ContactDialog({
  open,
  onOpenChange,
  contact,
  onSaved,
  platform,
}: ContactDialogProps) {
  const t = platform.crm;
  const common = platform.common;
  const isEdit = contact !== null;
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [tagsText, setTagsText] = useState(() =>
    joinTagsInput(contact?.tags ?? [])
  );

  const defaultValues: ContactInput = {
    name: contact?.name ?? "",
    email: contact?.email ?? "",
    company: contact?.company ?? "",
    phone: contact?.phone ?? "",
    title: contact?.title ?? "",
    address: contact?.address ?? "",
    notes: contact?.notes ?? "",
    tags: contact?.tags ?? [],
  };

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ContactInput>({
    resolver: zodResolver(createContactInputSchema(t.errors)),
    defaultValues,
  });

  const onSubmit = handleSubmit((values) =>
    startTransition(async () => {
      setServerError(null);
      const payload: ContactInput = {
        ...values,
        tags: parseTagsInput(tagsText),
      };

      const result = isEdit
        ? await updateContact(contact!.id, payload)
        : await createContact(payload);

      if (result.status === "error") {
        setServerError(result.error ?? t.errors.contactCreateFailed);
        for (const [field, messages] of Object.entries(
          result.fieldErrors ?? {}
        )) {
          if (messages?.length) {
            setError(field as keyof ContactInput, {
              type: "server",
              message: messages[0],
            });
          }
        }
        return;
      }

      onSaved();
    })
  );

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) setServerError(null); onOpenChange(next); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? t.contactDialog.editTitle : t.contactDialog.createTitle}</DialogTitle>
          <DialogDescription>{t.contactDialog.description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="contact-name">{t.contactDialog.nameLabel} <span className="text-destructive">*</span></Label>
              <Input id="contact-name" placeholder={t.contactDialog.namePlaceholder} {...register("name")} aria-invalid={Boolean(errors.name)} />
              {errors.name && <p role="alert" className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contact-email">{t.contactDialog.emailLabel} <span className="text-destructive">*</span></Label>
              <Input id="contact-email" type="email" placeholder={t.contactDialog.emailPlaceholder} {...register("email")} aria-invalid={Boolean(errors.email)} />
              {errors.email && <p role="alert" className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="contact-company">{t.contactDialog.companyLabel}</Label>
              <Input id="contact-company" placeholder={t.contactDialog.companyPlaceholder} {...register("company")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contact-phone">{t.contactDialog.phoneLabel}</Label>
              <Input id="contact-phone" placeholder={t.contactDialog.phonePlaceholder} {...register("phone")} />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="contact-title">{t.contactDialog.titleLabel}</Label>
              <Input id="contact-title" placeholder={t.contactDialog.titlePlaceholder} {...register("title")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contact-address">{t.contactDialog.addressLabel}</Label>
              <Input id="contact-address" placeholder={t.contactDialog.addressPlaceholder} {...register("address")} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="contact-tags">{t.contactDialog.tagsLabel}</Label>
            <Input id="contact-tags" value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder={t.contactDialog.tagsPlaceholder} />
            <p className="text-xs text-muted-foreground">{t.contactDialog.tagsHint}</p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="contact-notes">{t.contactDialog.notesLabel}</Label>
            <Textarea id="contact-notes" rows={3} placeholder={t.contactDialog.notesPlaceholder} {...register("notes")} />
          </div>

          {serverError && (
            <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>{common.cancel}</Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <LoaderCircle className="me-2 size-4 animate-spin" />}
              {isEdit ? t.contactDialog.save : t.contactDialog.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
