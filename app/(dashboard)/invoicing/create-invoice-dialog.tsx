"use client";

import { useMemo, useState, useTransition } from "react";
import { LoaderCircle, Plus, Trash2 } from "lucide-react";
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
import { createInvoice } from "@/lib/actions/invoicing";
import type { InvoiceInput } from "@/lib/validations/invoicing";
import { INVOICING_CURRENCIES, estimateTotals, formatCurrency, lineAmount } from "./invoicing-meta";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

export interface InvoiceContactOption {
  id: string;
  name: string;
  email: string;
  company: string | null;
}

interface LineItemState {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

interface CreateInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Organization contacts (from crm_contacts) for the client selector. */
  contacts: InvoiceContactOption[];
  onSaved: () => void;
  /** Localized copy for the current render. */
  platform: Dictionary["platform"];
  locale: Locale;
}

function blankItem(): LineItemState {
  return {
    key: Math.random().toString(36).slice(2),
    description: "",
    quantity: "1",
    unitPrice: "0",
  };
}

/**
 * Create invoice dialog with a dynamic line-item builder. Line items are
 * plain controlled state (a live subtotal/tax/total estimate updates as
 * you type); the server re-validates everything with Zod and computes the
 * authoritative totals inside the atomic `create_invoice` RPC.
 *
 * The form lives in a keyed child component so that every open remounts
 * it with pristine state — the React-recommended way to reset a form
 * without a state-resetting effect.
 */
export function CreateInvoiceDialog({
  open,
  onOpenChange,
  contacts,
  onSaved,
  platform,
  locale,
}: CreateInvoiceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <CreateInvoiceForm
          key={open ? "invoice-create-form" : "invoice-create-form-closed"}
          onOpenChange={onOpenChange}
          contacts={contacts}
          onSaved={onSaved}
          platform={platform}
          locale={locale}
        />
      </DialogContent>
    </Dialog>
  );
}

function CreateInvoiceForm({
  onOpenChange,
  contacts,
  onSaved,
  platform,
  locale,
}: Omit<CreateInvoiceDialogProps, "open">) {
  const t = platform.invoicing;
  const common = platform.common;
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [contactId, setContactId] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [taxRate, setTaxRate] = useState("0");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItemState[]>([blankItem()]);

  const parsedTaxRate = Math.max(0, Math.min(100, Number(taxRate) || 0));
  const { subtotal, taxAmount, total } = useMemo(
    () =>
      estimateTotals(
        items.map((item) => ({
          quantity: Number(item.quantity) || 0,
          unitPrice: Number(item.unitPrice) || 0,
        })),
        parsedTaxRate
      ),
    [items, parsedTaxRate]
  );

  function updateItem(
    key: string,
    patch: Partial<Omit<LineItemState, "key">>
  ) {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item))
    );
  }

  function removeItem(key: string) {
    setItems((current) =>
      current.length > 1 ? current.filter((item) => item.key !== key) : current
    );
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError(null);
    setFormError(null);

    const trimmed = items.map((item) => ({
      description: item.description.trim(),
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
    }));

    if (trimmed.length === 0 || trimmed.every((item) => item.description === "")) {
      setFormError(t.errors.itemsRequired);
      return;
    }
    if (trimmed.some((item) => item.description === "")) {
      setFormError(t.errors.itemDescriptionRequired);
      return;
    }
    if (
      trimmed.some(
        (item) => Number.isNaN(item.quantity) || item.quantity < 0
      )
    ) {
      setFormError(t.errors.itemQuantityInvalid);
      return;
    }
    if (
      trimmed.some(
        (item) => Number.isNaN(item.unitPrice) || item.unitPrice < 0
      )
    ) {
      setFormError(t.errors.itemUnitPriceInvalid);
      return;
    }

    const payload: InvoiceInput = {
      contactId,
      currency,
      taxRate: parsedTaxRate,
      dueDate,
      notes,
      items: trimmed,
    };

    startTransition(async () => {
      const result = await createInvoice(payload);
      if (result.status === "error") {
        setServerError(result.error ?? t.errors.createFailed);
        return;
      }
      onSaved();
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t.createDialog.title}</DialogTitle>
        <DialogDescription>
          {t.createDialog.description}
        </DialogDescription>
      </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Client + due date */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="invoice-client">{t.createDialog.clientLabel}</Label>
              <Select value={contactId} onValueChange={setContactId}>
                <SelectTrigger id="invoice-client" className="w-full">
                  <SelectValue placeholder={t.createDialog.clientPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.name}
                      {contact.email ? ` — ${contact.email}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {contacts.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  {t.createDialog.noClientsYet}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="invoice-due-date">
                {t.createDialog.dueDateLabel}
              </Label>
              <Input
                id="invoice-due-date"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>
          </div>

          {/* Currency + tax rate */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="invoice-currency">
                {t.createDialog.currencyLabel}
              </Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="invoice-currency" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVOICING_CURRENCIES.map((code) => (
                    <SelectItem key={code} value={code}>
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="invoice-tax-rate">
                {t.createDialog.taxRateLabel}
              </Label>
              <Input
                id="invoice-tax-rate"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={taxRate}
                onChange={(event) => setTaxRate(event.target.value)}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="grid gap-2">
            <Label htmlFor="invoice-notes">{t.createDialog.notesLabel}</Label>
            <Textarea
              id="invoice-notes"
              rows={2}
              placeholder={t.createDialog.notesPlaceholder}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          {/* Line items */}
          <div className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">
                {t.createDialog.itemsSection}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setItems((current) => [...current, blankItem()])}
              >
                <Plus className="size-4" />
                {t.createDialog.addItem}
              </Button>
            </div>

            <div className="overflow-hidden rounded-lg border border-border">
              <div className="grid grid-cols-12 gap-2 border-b border-border bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
                <span className="col-span-5">
                  {t.createDialog.itemDescription}
                </span>
                <span className="col-span-2">{t.createDialog.itemQuantity}</span>
                <span className="col-span-2">
                  {t.createDialog.itemUnitPrice}
                </span>
                <span className="col-span-2 text-end">
                  {t.createDialog.itemAmount}
                </span>
                <span className="col-span-1" />
              </div>
              <div className="divide-y divide-border">
                {items.map((item) => (
                  <div
                    key={item.key}
                    className="grid grid-cols-12 items-center gap-2 px-3 py-2"
                  >
                    <Input
                      className="col-span-5"
                      placeholder={t.createDialog.itemDescriptionPlaceholder}
                      value={item.description}
                      onChange={(event) =>
                        updateItem(item.key, {
                          description: event.target.value,
                        })
                      }
                      aria-label={t.createDialog.itemDescription}
                    />
                    <Input
                      className="col-span-2"
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.quantity}
                      onChange={(event) =>
                        updateItem(item.key, { quantity: event.target.value })
                      }
                      aria-label={t.createDialog.itemQuantity}
                    />
                    <Input
                      className="col-span-2"
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(event) =>
                        updateItem(item.key, { unitPrice: event.target.value })
                      }
                      aria-label={t.createDialog.itemUnitPrice}
                    />
                    <span className="col-span-2 truncate text-end text-sm tabular-nums text-foreground">
                      {formatCurrency(
                        lineAmount(
                          Number(item.quantity) || 0,
                          Number(item.unitPrice) || 0
                        ),
                        currency,
                        locale
                      )}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="col-span-1 size-7 justify-self-end p-0 text-muted-foreground hover:text-destructive"
                      disabled={items.length === 1}
                      onClick={() => removeItem(item.key)}
                      aria-label={t.createDialog.removeItem}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Live totals */}
            <div className="ms-auto w-full max-w-xs space-y-1 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
              <div className="flex items-center justify-between gap-3 text-muted-foreground">
                <span>{t.createDialog.subtotal}</span>
                <span className="tabular-nums">
                  {formatCurrency(subtotal, currency, locale)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-muted-foreground">
                <span>{t.createDialog.tax}</span>
                <span className="tabular-nums">
                  {formatCurrency(taxAmount, currency, locale)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border pt-1.5 text-sm font-semibold">
                <span>{t.createDialog.total}</span>
                <span className="tabular-nums">
                  {formatCurrency(total, currency, locale)}
                </span>
              </div>
            </div>
          </div>

          {formError && (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {formError}
            </p>
          )}
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
              {t.createDialog.create}
            </Button>
          </DialogFooter>
        </form>
    </>
  );
}