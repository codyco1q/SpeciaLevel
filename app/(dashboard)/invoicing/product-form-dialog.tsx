"use client";

import * as React from "react";
import { Loader2, Upload, Trash2, ImageIcon } from "lucide-react";
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
import { createProduct, updateProduct, uploadProductImage } from "@/lib/actions/invoicing";
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
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const isEditing = Boolean(product);

  React.useEffect(() => {
    if (open) {
      if (product) {
        setTitle(product.title);
        setDescription(product.description || "");
        setUnitPrice(String(product.unit_price ?? "0"));
        setImageUrl(product.image_url ?? null);
      } else {
        setTitle("");
        setDescription("");
        setUnitPrice("0");
        setImageUrl(null);
      }
      setErrorMessage(null);
    }
  }, [open, product]);

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("Image must be under 5MB.");
      return;
    }

    setIsUploadingImage(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await uploadProductImage(formData);
      if (res.status === "success") {
        setImageUrl(res.imageUrl);
      } else {
        setErrorMessage(res.error);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

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
          imageUrl: imageUrl || null,
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
            image_url: imageUrl || null,
            updated_at: new Date().toISOString(),
          });
        }
      } else {
        const res = await createProduct({
          title: title.trim(),
          description: description.trim(),
          unitPrice: priceNum,
          imageUrl: imageUrl || null,
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
            <Label className="text-sm font-medium">
              Product Image
            </Label>
            <div className="flex items-center gap-3">
              {imageUrl ? (
                <div className="relative group size-16 rounded-lg overflow-hidden border border-border bg-muted/20 shrink-0">
                  <img
                    src={imageUrl}
                    alt="Product preview"
                    className="size-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setImageUrl(null)}
                    disabled={isSubmitting || isUploadingImage}
                    className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove image"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ) : (
                <div className="size-16 rounded-lg border border-dashed border-border bg-muted/20 flex flex-col items-center justify-center text-muted-foreground/50 shrink-0">
                  <ImageIcon className="size-5" />
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                  onChange={handleImageFileChange}
                  className="hidden"
                  id="product-image-upload"
                  disabled={isSubmitting || isUploadingImage}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSubmitting || isUploadingImage}
                >
                  {isUploadingImage ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Upload className="size-3.5" />
                  )}
                  {imageUrl ? "Change image" : "Upload image"}
                </Button>
                <p className="text-[11px] text-muted-foreground">
                  PNG, JPG, WebP up to 5MB
                </p>
              </div>
            </div>
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
