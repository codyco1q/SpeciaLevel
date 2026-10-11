"use client";

import { useMemo, useState, useTransition } from "react";
import { BookmarkPlus, LoaderCircle, Plus, Trash2, PackagePlus } from "lucide-react";
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
import { createInvoice, createProduct } from "@/lib/actions/invoicing";
import type { InvoiceInput } from "@/lib/validations/invoicing";
import type { Product } from "@/types/database";
import { INVOICING_CURRENCIES, estimateTotals, formatCurrency, lineAmount } from "./invoicing-meta";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

export interface InvoiceContactOption {
  id: string;
  name: string;
  email: string;
  company: string | null;
}

type LineItemState = LineItemModel;

export interface CreateInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Organization contacts (from crm_contacts) for the client selector. */
  contacts: InvoiceContactOption[];
  products?: Product[];
  onProductsChange?: (products: Product[]) => void;
  onSaved: () => void;
  /** Localized copy for the current render. */
  platform: Dictionary["platform"];
  locale: Locale;
}

function blankItem(): LineItemState {
  return {
    key: Math.random().toString(36).slice(2),
    title: "",
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
  products = [],
  onProductsChange,
  onSaved,
  platform,
  locale,
}: CreateInvoiceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] sm:max-w-4xl lg:max-w-5xl overflow-y-auto">
        <CreateInvoiceForm
          key={open ? "invoice-create-form" : "invoice-create-form-closed"}
          onOpenChange={onOpenChange}
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

function CreateInvoiceForm({
  onOpenChange,
  contacts,
  products = [],
  onProductsChange,
  onSaved,
  platform,
  locale,
}: Omit<CreateInvoiceDialogProps, "open">) {
  const t = platform.invoicing;
  const common = platform.common;
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [availableProducts, setAvailableProducts] = useState<Product[]>(products);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [targetItemKeyForProduct, setTargetItemKeyForProduct] = useState<string | null>(null);

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

  async function handleSaveItemAsProduct(item: LineItemState) {
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

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError(null);
    setFormError(null);

    const trimmed = items.map((item) => {
      const title = item.title.trim() || item.description.trim();
      const description = item.description.trim() || item.title.trim();
      return {
        title,
        description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
      };
    });

    if (trimmed.length === 0 || trimmed.every((item) => item.title === "")) {
      setFormError(t.errors.itemsRequired);
      return;
    }
    if (trimmed.some((item) => item.title === "")) {
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

        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          {/* Top metadata grid: 4 columns on large screens */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                {t.createDialog.taxRateLabel} (%)
              </Label>
              <NumberStepperInput
                id="invoice-tax-rate"
                value={taxRate}
                onChange={setTaxRate}
                min={0}
                max={100}
                step={0.5}
                suffix="%"
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

          {/* Line items section */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {t.createDialog.itemsSection}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t.products?.sectionSubtitle ?? "Add items, pick from saved products, or create products on the fly."}
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
                  {t.products?.newProduct ?? "New product"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setItems((current) => [...current, blankItem()])}
                  className="gap-1.5 text-xs"
                >
                  <Plus className="size-3.5" />
                  {t.createDialog.addItem}
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <InvoiceLineItemRow
                  key={item.key}
                  index={idx}
                  item={item}
                  currency={currency}
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
          </div>

            {/* Live totals */}
            <div className="ms-auto w-full max-w-xs space-y-1.5 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
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
                <span className="tabular-nums text-primary font-bold">
                  {formatCurrency(total, currency, locale)}
                </span>
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

          <DialogFooter className="gap-2 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {common.cancel}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <LoaderCircle className="h-4 w-4 animate-spin mr-2" />}
              {t.createDialog.create}
            </Button>
          </DialogFooter>
        </form>

        <ProductFormDialog
          open={productDialogOpen}
          onOpenChange={setProductDialogOpen}
          product={null}
          currency={currency}
          locale={locale}
          platform={platform}
          onSuccess={handleProductDialogSuccess}
        />
    </>
  );
}