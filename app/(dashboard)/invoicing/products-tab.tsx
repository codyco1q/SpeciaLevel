"use client";

import * as React from "react";
import { Plus, Search, Edit2, Trash2, Package, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProductFormDialog } from "./product-form-dialog";
import { deleteProduct } from "@/lib/actions/invoicing";
import { formatCurrency } from "./invoicing-meta";
import type { Product } from "@/types/database";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

export interface ProductsTabProps {
  products: Product[];
  canManage: boolean;
  platform: Dictionary["platform"];
  locale: Locale;
  currency?: string;
  onProductsChange?: (products: Product[]) => void;
}

export function ProductsTab({
  products,
  canManage,
  platform,
  locale,
  currency = "USD",
  onProductsChange,
}: ProductsTabProps) {
  const t = platform.invoicing;
  const tProd = t.products;

  const [search, setSearch] = React.useState("");
  const [formDialogOpen, setFormDialogOpen] = React.useState(false);
  const [editingProduct, setEditingProduct] = React.useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = React.useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const filteredProducts = React.useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q))
    );
  }, [products, search]);

  const handleCreateNew = () => {
    setEditingProduct(null);
    setFormDialogOpen(true);
  };

  const handleEdit = (prod: Product) => {
    setEditingProduct(prod);
    setFormDialogOpen(true);
  };

  const handleFormSuccess = (saved: Product) => {
    let next: Product[];
    const exists = products.some((p) => p.id === saved.id);
    if (exists) {
      next = products.map((p) => (p.id === saved.id ? saved : p));
    } else {
      next = [saved, ...products];
    }
    onProductsChange?.(next);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingProduct) return;
    setIsDeleting(true);
    try {
      const res = await deleteProduct(deletingProduct.id);
      if (res.status === "error") {
        console.error(res.error);
      } else {
        const next = products.filter((p) => p.id !== deletingProduct.id);
        onProductsChange?.(next);
        setDeletingProduct(null);
      }
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {tProd?.title ?? "Products & Services"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {tProd?.subtitle ?? "Create and manage reusable line items for quick invoice creation."}
          </p>
        </div>
        {canManage && (
          <Button onClick={handleCreateNew} className="gap-2 shrink-0">
            <Plus className="size-4" />
            {tProd?.newProduct ?? "New product"}
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tProd?.searchPlaceholder ?? "Search products by title or description…"}
            className="pl-9"
          />
        </div>
      </div>

      {filteredProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Package className="size-6 text-muted-foreground" />
          </div>
          <h3 className="mt-3 text-base font-semibold text-foreground">
            {search ? "No matching products" : (tProd?.emptyTitle ?? "No products yet")}
          </h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {search
              ? "Try adjusting your search terms."
              : (tProd?.emptySubtitle ?? "Add reusable line items to quickly compose invoices in seconds.")}
          </p>
          {canManage && !search && (
            <Button onClick={handleCreateNew} variant="outline" className="mt-4 gap-2">
              <Plus className="size-4" />
              {tProd?.newProduct ?? "New product"}
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[35%]">{tProd?.colTitle ?? "Product"}</TableHead>
                <TableHead className="w-[35%]">{tProd?.colDescription ?? "Description"}</TableHead>
                <TableHead className="w-[15%] text-end">{tProd?.colUnitPrice ?? "Unit Price"}</TableHead>
                {canManage && <TableHead className="w-[15%] text-end">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((prod) => (
                <TableRow key={prod.id}>
                  <TableCell className="font-medium text-foreground">
                    <div className="flex items-center gap-3">
                      {prod.image_url ? (
                        <img
                          src={prod.image_url}
                          alt={prod.title}
                          className="size-9 rounded-md object-cover border border-border shrink-0 bg-muted/20"
                        />
                      ) : (
                        <div className="size-9 rounded-md border border-dashed border-border bg-muted/20 flex items-center justify-center shrink-0 text-muted-foreground/50">
                          <Package className="size-4" />
                        </div>
                      )}
                      <span className="truncate">{prod.title}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {prod.description || <span className="text-muted-foreground/50 italic">—</span>}
                  </TableCell>
                  <TableCell className="text-end font-mono tabular-nums">
                    {formatCurrency(Number(prod.unit_price) || 0, currency, locale)}
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-end">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(prod)}
                          aria-label="Edit product"
                          className="h-8 w-8 p-0"
                        >
                          <Edit2 className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingProduct(prod)}
                          aria-label="Delete product"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ProductFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        product={editingProduct}
        platform={platform}
        currency={currency}
        locale={locale}
        onSuccess={handleFormSuccess}
      />

      <Dialog open={Boolean(deletingProduct)} onOpenChange={(open) => !open && setDeletingProduct(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tProd?.confirmDeleteTitle ?? "Delete Product"}</DialogTitle>
            <DialogDescription>
              {tProd?.confirmDeleteBody ?? "Are you sure you want to delete this product? Existing invoices will not be affected."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-3">
            <Button
              type="button"
              variant="outline"
              disabled={isDeleting}
              onClick={() => setDeletingProduct(null)}
            >
              {platform.common?.cancel ?? "Cancel"}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeleting}
              onClick={handleDeleteConfirm}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                platform.common?.delete ?? "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
