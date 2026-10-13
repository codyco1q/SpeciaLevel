"use client";

import { BookmarkPlus, Trash2 } from "lucide-react";
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
import { NumberStepperInput } from "./number-stepper-input";
import { formatCurrency, lineAmount } from "../invoicing-meta";
import type { Product } from "@/types/database";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

export interface LineItemModel {
  key: string;
  title: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

interface InvoiceLineItemRowProps {
  index: number;
  item: LineItemModel;
  currency: string;
  locale: Locale;
  products: Product[];
  canDelete: boolean;
  onUpdate: (patch: Partial<Omit<LineItemModel, "key">>) => void;
  onRemove: () => void;
  onSelectProduct: (productId: string) => void;
  onSaveAsProduct: () => void;
  platform: Dictionary["platform"];
}

export function InvoiceLineItemRow({
  index,
  item,
  currency,
  locale,
  products,
  canDelete,
  onUpdate,
  onRemove,
  onSelectProduct,
  onSaveAsProduct,
  platform,
}: InvoiceLineItemRowProps) {
  const t = platform.invoicing;
  const tProd = t.products;
  const totalAmount = lineAmount(
    Number(item.quantity) || 0,
    Number(item.unitPrice) || 0
  );

  return (
    <div className="rounded-lg border border-border bg-card/60 p-3 sm:p-4 space-y-3 transition-colors hover:border-border/80">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
            {index + 1}
          </span>
          {products.length > 0 && (
            <Select value="" onValueChange={onSelectProduct}>
              <SelectTrigger className="h-7 text-xs w-[180px] sm:w-[220px] bg-background">
                <SelectValue placeholder={tProd?.selectProductPlaceholder ?? "Select catalog…"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__new__" className="font-medium text-primary">
                  + {tProd?.newProduct ?? "New product"}
                </SelectItem>
                {products.map((p) => {
                  const label = p.title || (p as any).name || "Item";
                  return (
                    <SelectItem key={p.id} value={p.id}>
                      {label} ({formatCurrency(Number(p.unit_price) || 0, currency, locale)})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex items-center gap-1">
          {item.title.trim() && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 px-2"
              onClick={onSaveAsProduct}
              title={tProd?.saveAsProduct ?? "Save as reusable product"}
            >
              <BookmarkPlus className="size-3.5" />
              <span className="hidden sm:inline">{tProd?.saveAsProduct ?? "Save as product"}</span>
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="size-7 p-0 text-muted-foreground hover:text-destructive"
            disabled={!canDelete}
            onClick={onRemove}
            aria-label={t.createDialog.removeItem}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
        <div className="md:col-span-6 space-y-2">
          <Input
            placeholder={tProd?.colTitle ? `${tProd.colTitle} (e.g. Website Design)` : "Item title"}
            value={item.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            aria-label="Item title"
            className="font-medium"
          />
          <Textarea
            placeholder={tProd?.colDescription ? `${tProd.colDescription} (optional details)` : "Description"}
            value={item.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            aria-label={t.createDialog.itemDescription}
            rows={2}
            className="text-xs resize-none"
          />
        </div>

        <div className="md:col-span-2 space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t.createDialog.itemQuantity}</Label>
          <NumberStepperInput
            value={item.quantity}
            onChange={(val) => onUpdate({ quantity: val })}
            min={0}
            step={1}
            aria-label={t.createDialog.itemQuantity}
          />
        </div>

        <div className="md:col-span-2 space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t.createDialog.itemUnitPrice}</Label>
          <NumberStepperInput
            value={item.unitPrice}
            onChange={(val) => onUpdate({ unitPrice: val })}
            min={0}
            step={1}
            prefix={currency}
            aria-label={t.createDialog.itemUnitPrice}
          />
        </div>

        <div className="md:col-span-2 space-y-1.5 text-end">
          <Label className="text-xs text-muted-foreground">{t.createDialog.itemAmount}</Label>
          <div className="h-9 flex items-center justify-end font-semibold text-sm tabular-nums text-foreground">
            {formatCurrency(totalAmount, currency, locale)}
          </div>
        </div>
      </div>
    </div>
  );
}
