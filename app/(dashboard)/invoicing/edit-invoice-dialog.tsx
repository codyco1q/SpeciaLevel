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
import { updateInvoice, type InvoiceRow } from "@/lib/actions/invoicing";
import type { InvoiceInput } from "@/lib/validations/invoicing";
import { estimateTotals, formatCurrency, lineAmount } from "./invoicing-meta";
import type { InvoiceContactOption } from "./create-invoice-dialog";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

interface LineItemState {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

interface EditInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: InvoiceRow;
  contacts: InvoiceContactOption[];
  onSaved: () => void;
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

export function EditInvoiceDialog({
  open,
  onOpenChange,
  invoice,
  contacts,
  onSaved,
  platform,
  locale,
}: EditInvoiceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <EditInvoiceForm
          key={open ? `edit-${invoice.id}-${invoice.items.length}` : "closed"}
          onOpenChange={onOpenChange}
          invoice={invoice}
          contacts={contacts}
          onSaved={onSaved}
          platform={platform}
          locale={locale}
        />
      </DialogContent>
    </Dialog>
  );
}

function EditInvoiceForm({
  onOpenChange,
  invoice,
  contacts,
  onSaved,
  platform,
  locale,
}: Omit<EditInvoiceDialogProps, "open">) {
  const t = platform.invoicing;
  const common = platform.common;
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [contactId, setContactId] = useState(invoice.contact?.id ?? "");
  const [taxRate, setTaxRate] = useState(invoice.taxRate.toString());
  const [dueDate, setDueDate] = useState(invoice.dueDate ?? "");
  const [notes, setNotes] = useState(invoice.notes ?? "");
  const [items, setItems] = useState<LineItemState[]>(
    invoice.items && invoice.items.length > 0
      ? invoice.items.map((item) => ({
          key: item.id || Math.random().toString(36).slice(2),
          description: item.description,
          quantity: item.quantity.toString(),
          unitPrice: item.unitPrice.toString(),
        }))
      : [blankItem()]
  );

  const parsedTaxRate = Math.max(0, Math.min(100, Number(taxRate) || 0));
  const { subtotal, taxAmount, total } = useMemo(
    () =>
      estimateTotals(
        items.map((i) => ({
          quantity: Number(i.quantity) || 0,
          unitPrice: Number(i.unitPrice) || 0,
        })),
        parsedTaxRate
      ),
    [items, parsedTaxRate]
  );

  function updateItem(key: string, patch: Partial<LineItemState>) {
    setItems((curr) =>
      curr.map((item) => (item.key === key ? { ...item, ...patch } : item))
    );
  }

  function addItem() {
    setItems((curr) => [...curr, blankItem()]);
  }

  function removeItem(key: string) {
    setItems((curr) => {
      if (curr.length <= 1) return curr;
      return curr.filter((item) => item.key !== key);
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);
    setFormError(null);

    const hasEmptyDescription = items.some((i) => !i.description.trim());
    if (hasEmptyDescription) {
      setFormError(t.errors.itemDescriptionRequired);
      return;
    }

    const payload: InvoiceInput = {
      contactId: contactId ? contactId : undefined,
      currency: invoice.currency,
      taxRate: parsedTaxRate,
      dueDate: dueDate.trim() ? dueDate : undefined,
      notes: notes.trim() ? notes : undefined,
      items: items.map((i) => ({
        description: i.description.trim(),
        quantity: Math.max(0, Number(i.quantity) || 0),
        unitPrice: Math.max(0, Number(i.unitPrice) || 0),
      })),
    };

    startTransition(async () => {
      const result = await updateInvoice(invoice.id, payload);
      if (result.status === "error") {
        setServerError(result.error ?? t.errors.updateFailed);
        return;
      }
      onSaved();
      onOpenChange(false);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <DialogHeader>
        <DialogTitle>
          {t.editDialog?.title ?? t.detail.edit} {invoice.invoiceNumber}
        </DialogTitle>
        <DialogDescription>
          {t.editDialog?.description ?? t.createDialog.description}
        </DialogDescription>
      </DialogHeader>

      {(serverError || formError) && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {serverError ?? formError}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="edit-contact">{t.createDialog.clientLabel}</Label>
          <Select value={contactId} onValueChange={setContactId}>
            <SelectTrigger id="edit-contact">
              <SelectValue placeholder={t.createDialog.clientPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {contacts.length === 0 ? (
                <SelectItem value="_none" disabled>
                  {t.createDialog.noClientsYet}
                </SelectItem>
              ) : (
                contacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.company ? ` (${c.company})` : ""}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="edit-dueDate">{t.createDialog.dueDateLabel}</Label>
          <Input
            id="edit-dueDate"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="edit-currency">{t.createDialog.currencyLabel}</Label>
          <Input
            id="edit-currency"
            value={invoice.currency}
            disabled
            className="bg-muted text-muted-foreground"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="edit-taxRate">{t.createDialog.taxRateLabel}</Label>
          <Input
            id="edit-taxRate"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={taxRate}
            onChange={(e) => setTaxRate(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">
            {t.createDialog.itemsSection}
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addItem}
            className="gap-1"
          >
            <Plus className="size-3.5" />
            {t.createDialog.addItem}
          </Button>
        </div>

        <div className="space-y-2">
          {items.map((item) => {
            const rowAmount = lineAmount(
              Number(item.quantity) || 0,
              Number(item.unitPrice) || 0
            );

            return (
              <div
                key={item.key}
                className="grid grid-cols-12 items-center gap-2 rounded-lg border border-border bg-card p-2"
              >
                <div className="col-span-12 sm:col-span-5">
                  <Input
                    placeholder={t.createDialog.itemDescriptionPlaceholder}
                    value={item.description}
                    onChange={(e) =>
                      updateItem(item.key, { description: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="col-span-4 sm:col-span-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={t.createDialog.itemQuantity}
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(item.key, { quantity: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="col-span-4 sm:col-span-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={t.createDialog.itemUnitPrice}
                    value={item.unitPrice}
                    onChange={(e) =>
                      updateItem(item.key, { unitPrice: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="col-span-3 sm:col-span-2 text-end text-sm font-medium tabular-nums">
                  {formatCurrency(rowAmount, invoice.currency, locale)}
                </div>

                <div className="col-span-1 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(item.key)}
                    disabled={items.length <= 1}
                    className="size-8 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="ms-auto w-full max-w-xs space-y-1 rounded-lg border border-border bg-muted/40 p-3 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>{t.createDialog.subtotal}</span>
            <span className="tabular-nums">
              {formatCurrency(subtotal, invoice.currency, locale)}
            </span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>
              {t.createDialog.tax} ({parsedTaxRate}%)
            </span>
            <span className="tabular-nums">
              {formatCurrency(taxAmount, invoice.currency, locale)}
            </span>
          </div>
          <div className="flex justify-between border-t border-border pt-1 font-semibold text-foreground">
            <span>{t.createDialog.total}</span>
            <span className="tabular-nums">
              {formatCurrency(total, invoice.currency, locale)}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="edit-notes">{t.createDialog.notesLabel}</Label>
        <Textarea
          id="edit-notes"
          rows={3}
          placeholder={t.createDialog.notesPlaceholder}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={isPending}
        >
          {common.cancel}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <LoaderCircle className="size-4 animate-spin" />}
          {t.editDialog?.save ?? common.saveChanges}
        </Button>
      </DialogFooter>
    </form>
  );
}
