"use client";

import { useState } from "react";
import { Plus, Trash2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FormProductItem } from "@/lib/validations/forms";
import type { Product } from "@/types/database";

interface FieldProductsManagerProps {
  products: FormProductItem[];
  allowMultiple?: boolean;
  catalogProducts: Product[];
  onChange: (products: FormProductItem[]) => void;
  onAllowMultipleChange: (allowMultiple: boolean) => void;
}

export function FieldProductsManager({
  products = [],
  allowMultiple = false,
  catalogProducts = [],
  onChange,
  onAllowMultipleChange,
}: FieldProductsManagerProps) {
  const [selectedCatalogId, setSelectedCatalogId] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [customPrice, setCustomPrice] = useState("0");

  const handleAddFromCatalog = () => {
    if (!selectedCatalogId) return;
    const cat = catalogProducts.find((p) => p.id === selectedCatalogId);
    if (!cat) return;

    onChange([
      ...products,
      {
        id: cat.id,
        title: cat.title,
        description: cat.description || undefined,
        unitPrice: Number(cat.unit_price) || 0,
        imageUrl: cat.image_url,
      },
    ]);
    setSelectedCatalogId("");
  };

  const handleAddCustom = () => {
    const title = customTitle.trim();
    if (!title) return;
    onChange([
      ...products,
      {
        id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title,
        unitPrice: parseFloat(customPrice) || 0,
      },
    ]);
    setCustomTitle("");
    setCustomPrice("0");
  };

  const handleRemove = (index: number) => {
    onChange(products.filter((_, i) => i !== index));
  };

  const availableCatalog = catalogProducts.filter(
    (cp) => !products.some((p) => p.id === cp.id)
  );

  return (
    <div className="space-y-3 pt-2 border-t border-border/60 col-span-full">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
          <Package className="size-3.5 text-primary" />
          <span>Products & Packages</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-mono">
            {products.length}
          </Badge>
        </Label>
        <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
          <Switch checked={allowMultiple} onCheckedChange={onAllowMultipleChange} />
          <span className="text-[11px] text-muted-foreground">Allow multiple</span>
        </label>
      </div>

      {products.length > 0 && (
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
          {products.map((prod, pIdx) => (
            <div
              key={prod.id || pIdx}
              className="flex items-center gap-2.5 p-2 rounded-lg border border-border/80 bg-background hover:border-foreground/20 transition-all"
            >
              {prod.imageUrl ? (
                <img
                  src={prod.imageUrl}
                  alt={prod.title}
                  className="size-7 rounded object-cover border border-border shrink-0 bg-muted/20"
                />
              ) : (
                <div className="size-7 rounded border border-dashed border-border bg-muted/20 flex items-center justify-center shrink-0 text-muted-foreground/60">
                  <Package className="size-3.5" />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-foreground truncate">{prod.title}</span>
                  <span className="text-xs font-mono font-semibold text-primary shrink-0">
                    ${Number(prod.unitPrice).toFixed(2)}
                  </span>
                </div>
                {prod.description && (
                  <p className="text-[10px] text-muted-foreground truncate">{prod.description}</p>
                )}
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemove(pIdx)}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 rounded"
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {availableCatalog.length > 0 && (
        <div className="flex items-center gap-2">
          <Select value={selectedCatalogId} onValueChange={setSelectedCatalogId}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue placeholder="Add from catalog..." />
            </SelectTrigger>
            <SelectContent>
              {availableCatalog.map((cp) => (
                <SelectItem key={cp.id} value={cp.id}>
                  {cp.title} (${Number(cp.unit_price).toFixed(2)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddFromCatalog}
            disabled={!selectedCatalogId}
            className="h-8 text-xs px-2.5 shrink-0"
          >
            Add
          </Button>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1 border-t border-border/40">
        <Input
          value={customTitle}
          onChange={(e) => setCustomTitle(e.target.value)}
          placeholder="Custom item title..."
          className="h-8 text-xs flex-1"
        />
        <div className="w-20">
          <Input
            type="number"
            min="0"
            step="0.01"
            value={customPrice}
            onChange={(e) => setCustomPrice(e.target.value)}
            placeholder="Price"
            className="h-8 text-xs"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddCustom}
          disabled={!customTitle.trim()}
          className="h-8 text-xs px-2.5 shrink-0"
        >
          Add
        </Button>
      </div>
    </div>
  );
}
