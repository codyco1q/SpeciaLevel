"use client";

import { useMemo, useState, useTransition } from "react";
import { LoaderCircle, Plus, PackagePlus } from "lucide-react";
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
import { NumberStepperInput } from "./components/number-stepper-input";
import { InvoiceLineItemRow, type LineItemModel } from "./components/invoice-line-item-row";
import { ProductFormDialog } from "./product-form-dialog";
import { updateInvoice, createProduct, type InvoiceRow } from "@/lib/actions/invoicing";
import type { InvoiceInput } from "@/lib/validations/invoicing";
import type { Product } from "@/types/database";
import { estimateTotals, formatCurrency, lineAmount } from "./invoicing-meta";
import type { InvoiceContactOption } from "./create-invoice-dialog";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

export interface EditInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: InvoiceRow;
  contacts: InvoiceContactOption[];
  products?: Product[];
  onProductsChange?: (products: Product[]) => void;
  onSaved: () => void;
  platform: Dictionary["platform"];
  locale: Locale;
}

function blankItem(): LineItemModel {
  return {
    key: Math.random().toString(36).slice(2),
    title: "",
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
  products = [],
  onProductsChange,
  onSaved,
  platform,
  locale,
}: EditInvoiceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] sm:max-w-4xl lg:max-w-5xl overflow-y-auto">
        <EditInvoiceForm
          key={open ? `edit-${invoice.id}-${invoice.items.length}` : "closed"}
          onOpenChange={onOpenChange}
          invoice={invoice}
          contacts={contacts}
          products={products}
          onProductsChange={onProductsChange}
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
  products = [],
  onProductsChange,
  onSaved,
  platform,
  locale,
}: Omit<EditInvoiceDialogProps, "open">) {
  const t = platform.invoicing;
  const common = platform.common;
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [availableProducts, setAvailableProducts] = useState<Product[]>(products);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [targetItemKeyForProduct, setTargetItemKeyForProduct] = useState<string | null>(null);

  const [contactId, setContactId] = useState(invoice.contact?.id ?? "");
  const [taxRate, setTaxRate] = useState(invoice.taxRate.toString());
  const [dueDate, setDueDate] = useState(invoice.dueDate ?? "");
  const [notes, setNotes] = useState(invoice.notes ?? "");
  const [items, setItems] = useState<LineItemModel[]>(() =>
    invoice.items && invoice.items.length > 0
      ? invoice.items.map((item, idx) => ({
          key: item.id || `item_${idx + 1}`,
          title: item.title || item.description || "",
          description: item.description || "",
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

  function updateItem(key: string, patch: Partial<LineItemModel>) {
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

  function handleProductSelected(itemKey: string, productId: string) {
    if (productId === "__new__") {
      setTargetItemKeyForProduct(itemKey);
      setProductDialogOpen(true);
      return;
    }
    const found = availableProducts.find((p) => p.id === productId);
    if (!found) return;

    updateItem(itemKey, {
      title: found.title,
      description: found.description ?? "",
      unitPrice: String(found.unit_price ?? "0"),
    });
  }

  function handleProductDialogSuccess(newProduct: Product) {
    const updated = [newProduct, ...availableProducts.filter((p) => p.id !== newProduct.id)];
    setAvailableProducts(updated);
    onProductsChange?.(updated);

    if (targetItemKeyForProduct) {
      updateItem(targetItemKeyForProduct, {
        title: newProduct.title,
        description: newProduct.description ?? "",
        unitPrice: String(newProduct.unit_price ?? "0"),
      });
      setTargetItemKeyForProduct(null);
    } else {
      setItems((current) => [
        ...current,
        {
          key: Math.random().toString(36).slice(2),
          title: newProduct.title,
          description: newProduct.description ?? "",
          quantity: "1",
          unitPrice: String(newProduct.unit_price ?? "0"),
        },
      ]);
    }
  }

  async function handleSaveItemAsProduct(item: LineItemModel) {
    if (!item.title.trim()) {
      setFormError(t.errors?.itemDescriptionRequired ?? "Product title is required");
      return;
    }
    try {
      const res = await createProduct({
        title: item.title.trim(),
        description: item.description.trim() || undefined,
        unitPrice: Math.max(0, Number(item.unitPrice) || 0),
      });
      if (res.status === "success" && res.data) {
        const updated = [res.data, ...availableProducts];
        setAvailableProducts(updated);
        onProductsChange?.(updated);
      } else if (res.status === "error") {
        setServerError(res.error);
      }
    } catch {
      setServerError("Failed to save product");
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);
    setFormError(null);

    const hasEmpty = items.some((i) => !i.title.trim() && !i.description.trim());
    if (hasEmpty) {
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
        title: i.title.trim() || i.description.trim(),
        description: i.description.trim() || i.title.trim(),
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
          <NumberStepperInput
            id="edit-taxRate"
            min={0}
            max={100}
            step={0.5}
            suffix="%"
            value={taxRate}
            onChange={setTaxRate}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <Label className="text-base font-semibold">
              {t.createDialog.itemsSection}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t.products?.sectionSubtitle ?? "Pick catalog products or enter custom line items with titles and descriptions."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setTargetItemKeyForProduct(null);
                setProductDialogOpen(true);
              }}
              className="gap-1.5 text-xs"
            >
              <PackagePlus className="size-3.5" />
              {t.products?.newProduct ?? "New Product"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addItem}
              className="gap-1 text-xs"
            >
              <Plus className="size-3.5" />
              {t.createDialog.addItem}
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {items.map((item, index) => (
            <InvoiceLineItemRow
              key={item.key}
              item={item}
              index={index}
              currency={invoice.currency}
              locale={locale}
              products={availableProducts}
              canDelete={items.length > 1}
              onUpdate={(patch) => updateItem(item.key, patch)}
              onRemove={() => removeItem(item.key)}
              onSelectProduct={(productId) => handleProductSelected(item.key, productId)}
              onSaveAsProduct={() => handleSaveItemAsProduct(item)}
              platform={platform}
            />
          ))}
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

      <DialogFooter className="flex flex-row items-center justify-end gap-3 pt-4 border-t border-border">
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

      <ProductFormDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        product={null}
        currency={invoice.currency}
        locale={locale}
        platform={platform}
        onSuccess={handleProductDialogSuccess}
      />
    </form>
  );
}
