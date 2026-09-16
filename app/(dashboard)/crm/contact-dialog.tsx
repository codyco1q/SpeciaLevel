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
} from "@/lib/validations/crm-contacts";
import {
  createContact,
  updateContact,
  type ContactSummaryRow,
} from "@/lib/actions/crm-contacts";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

interface ContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Non-null opens the dialog in edit mode with the row pre-filled. */
  contact: ContactSummaryRow | null;
  onSaved: () => void;
  /** Localized copy + validation messages for the current render. */
  platform: Dictionary["platform"];
}

/**
 * Create / edit contact dialog backed by react-hook-form + the shared
 * Zod schema. Manage-only: the CRM view only opens it for `crm.manage`
 * holders. Tags are typed as a comma-separated string and split into
 * the schema's text[] shape on submit.
 */
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
  // Seeded once per mount; the CRM view remounts this dialog (via `key`)
  // whenever its edit target or open state changes, so this stays fresh
  // without an effect (React Compiler-compatible).
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

  const handleOpenChange = (next: boolean) => {
    if (!next) setServerError(null);
    onOpenChange(next);
  };

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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t.contactDialog.editTitle : t.contactDialog.createTitle}
          </DialogTitle>
          <DialogDescription>{t.contactDialog.description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="contact-name">
                {t.contactDialog.nameLabel}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="contact-name"
                placeholder={t.contactDialog.namePlaceholder}
                {...register("name")}
                aria-invalid={Boolean(errors.name)}
              />
              {errors.name && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contact-email">
                {t.contactDialog.emailLabel}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="contact-email"
                type="email"
                placeholder={t.contactDialog.emailPlaceholder}
                {...register("email")}
                aria-invalid={Boolean(errors.email)}
              />
              {errors.email && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="contact-company">
                {t.contactDialog.companyLabel}
              </Label>
              <Input
                id="contact-company"
                placeholder={t.contactDialog.companyPlaceholder}
                {...register("company")}
                aria-invalid={Boolean(errors.company)}
              />
              {errors.company && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.company.message}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contact-phone">
                {t.contactDialog.phoneLabel}
              </Label>
              <Input
                id="contact-phone"
                type="tel"
                placeholder={t.contactDialog.phonePlaceholder}
                {...register("phone")}
                aria-invalid={Boolean(errors.phone)}
              />
              {errors.phone && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.phone.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="contact-title">
                {t.contactDialog.titleLabel}
              </Label>
              <Input
                id="contact-title"
                placeholder={t.contactDialog.titlePlaceholder}
                {...register("title")}
                aria-invalid={Boolean(errors.title)}
              />
              {errors.title && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.title.message}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contact-address">
                {t.contactDialog.addressLabel}
              </Label>
              <Input
                id="contact-address"
                placeholder={t.contactDialog.addressPlaceholder}
                {...register("address")}
                aria-invalid={Boolean(errors.address)}
              />
              {errors.address && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.address.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="contact-notes">{t.contactDialog.notesLabel}</Label>
            <Textarea
              id="contact-notes"
              rows={3}
              placeholder={t.contactDialog.notesPlaceholder}
              {...register("notes")}
              aria-invalid={Boolean(errors.notes)}
            />
            {errors.notes && (
              <p role="alert" className="text-sm text-destructive">
                {errors.notes.message}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="contact-tags">{t.contactDialog.tagsLabel}</Label>
            <Input
              id="contact-tags"
              value={tagsText}
              onChange={(event) => setTagsText(event.target.value)}
              placeholder={t.contactDialog.tagsPlaceholder}
            />
            <p className="text-xs text-muted-foreground">
              {t.contactDialog.tagsHint}
            </p>
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
              {isEdit ? t.contactDialog.save : t.contactDialog.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}