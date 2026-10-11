"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NumberStepperInput } from "./components/number-stepper-input";
import { createProduct, updateProduct } from "@/lib/actions/invoicing";
import type { Product } from "@/types/database";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

export interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
  platform: Dictionary["platform"];
  locale?: Locale;
  currency?: string;
  onSuccess?: (product: Product) => void;
}

export function ProductFormDialog({
  open,
  onOpenChange,
  product,
  platform,
  locale = "en",
  currency = "USD",
  onSuccess,
}: ProductFormDialogProps) {
  const t = platform.invoicing;
  const tProd = t.products;

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [unitPrice, setUnitPrice] = React.useState("0");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const isEditing = Boolean(product);

  React.useEffect(() => {
    if (open) {
      if (product) {
        setTitle(product.title);
        setDescription(product.description || "");
        setUnitPrice(String(product.unit_price ?? "0"));
      } else {
        setTitle("");
        setDescription("");
        setUnitPrice("0");
      }
      setErrorMessage(null);
    }
  }, [open, product]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage(t.errors.itemTitleRequired || "Product title is required.");
      return;
    }
    const priceNum = parseFloat(unitPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      setErrorMessage(t.errors.itemUnitPriceInvalid || "Invalid unit price.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (isEditing && product) {
        const res = await updateProduct(product.id, {
          title: title.trim(),
          description: description.trim(),
          unitPrice: priceNum,
        });
        if (res.status === "error") {
          setErrorMessage(res.error);
        } else {
          onOpenChange(false);
          onSuccess?.({
            ...product,
            title: title.trim(),
            description: description.trim(),
            unit_price: priceNum,
            updated_at: new Date().toISOString(),
          });
        }
      } else {
        const res = await createProduct({
          title: title.trim(),
          description: description.trim(),
          unitPrice: priceNum,
        });
        if (res.status === "error") {
          setErrorMessage(res.error);
        } else {
          onOpenChange(false);
          if (res.data) onSuccess?.(res.data);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? (tProd?.editDialogTitle ?? "Edit Product") : (tProd?.createDialogTitle ?? "Create Reusable Product")}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? (tProd?.editDialogDescription ?? "Update this product's title, description, or unit price.")
              : (tProd?.createDialogDescription ?? "Define a reusable line item with a title, description, and standard unit price.")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {errorMessage && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {errorMessage}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="product-title" className="text-sm font-medium">
              {tProd?.titleLabel ?? "Product Title"} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="product-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={tProd?.titlePlaceholder ?? "e.g. Website Design"}
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="product-description" className="text-sm font-medium">
              {tProd?.descriptionLabel ?? "Description"}
            </Label>
            <Textarea
              id="product-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={tProd?.descriptionPlaceholder ?? "Scope of work, notes (optional)"}
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="product-price" className="text-sm font-medium">
              {tProd?.unitPriceLabel ?? "Default Unit Price"}
            </Label>
            <NumberStepperInput
              id="product-price"
              value={unitPrice}
              onChange={setUnitPrice}
              min={0}
              step={1}
              prefix={currency}
              disabled={isSubmitting}
            />
          </div>

          <DialogFooter className="gap-2 pt-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              {platform.common?.cancel ?? "Cancel"}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {locale === "ar" ? "جارٍ الحفظ..." : "Saving..."}
                </>
              ) : (
                tProd?.save ?? "Save Product"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
