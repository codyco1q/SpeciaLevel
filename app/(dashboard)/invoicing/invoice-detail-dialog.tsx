"use client";

import { useState } from "react";
import { ExternalLink, LoaderCircle, Pencil, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Monogram } from "@/components/brand";
import type { InvoiceRow } from "@/lib/actions/invoicing";
import {
  INVOICE_STATUS_BADGE_CLASSES,
  formatCurrency,
  formatInvoiceDate,
} from "./invoicing-meta";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

interface InvoiceDetailDialogProps {
  invoice: InvoiceRow | null;
  onOpenChange: (open: boolean) => void;
  canManage: boolean;
  onMarkPaid: () => void;
  onDelete: () => void;
  onEdit?: (invoice: InvoiceRow) => void;
  onShare?: (invoice: InvoiceRow) => void;
  /** True while a mark-paid / delete server call is in flight. */
  busy: boolean;
  platform: Dictionary["platform"];
  locale: Locale;
}

/**
 * Branded invoice preview: SpeciaLevel header, client block, line items,
 * and totals — rendered as a clean document inside the dialog for
 * printing/sharing. Mark-paid, edit, share, and delete live here and in the table.
 */
export function InvoiceDetailDialog({
  invoice,
  onOpenChange,
  canManage,
  onMarkPaid,
  onDelete,
  onEdit,
  onShare,
  busy,
  platform,
  locale,
}: InvoiceDetailDialogProps) {
  const t = platform.invoicing;
  const common = platform.common;
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!invoice) return null;
  const { status } = invoice;
  const canMarkPaid = status !== "paid" && status !== "cancelled";

  return (
    <Dialog open={invoice !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>
            {t.detail.title} {invoice.invoiceNumber}
          </DialogTitle>
        </DialogHeader>

        {/* Brand header */}
        <div className="flex flex-wrap items-start justify-between gap-4 px-6 pt-6">
          <div className="flex items-center gap-3">
            <Monogram className="size-10 rounded-lg" />
            <div>
              <p className="text-lg font-bold tracking-tight">SpeciaLevel</p>
              <p className="text-xs text-muted-foreground">{t.detail.title}</p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "px-2 py-0.5 text-xs",
              INVOICE_STATUS_BADGE_CLASSES[status]
            )}
          >
            {t.statuses[status]}
          </Badge>
        </div>

        {/* Invoice meta */}
        <div className="grid gap-6 px-6 pt-6 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-sm font-semibold">{invoice.invoiceNumber}</p>
            <p className="text-xs text-muted-foreground">
              {t.detail.issued}: {formatInvoiceDate(invoice.createdAt, locale)}
            </p>
            <p className="text-xs text-muted-foreground">
              {t.detail.due}: {formatInvoiceDate(invoice.dueDate, locale)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t.detail.billedTo}
            </p>
            {invoice.contact ? (
              <>
                <p className="text-sm font-medium">{invoice.contact.name}</p>
                {invoice.contact.company && (
                  <p className="text-xs text-muted-foreground">
                    {invoice.contact.company}
                  </p>
                )}
                {invoice.contact.email && (
                  <p className="text-xs text-muted-foreground">
                    {invoice.contact.email}
                  </p>
                )}
                {invoice.contact.phone && (
                  <p className="text-xs text-muted-foreground">
                    {invoice.contact.phone}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </div>
        </div>

        {/* Line items */}
        <div className="px-6 pt-6">
          <div className="overflow-hidden rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.detail.description}</TableHead>
                  <TableHead className="text-end">
                    {t.detail.quantity}
                  </TableHead>
                  <TableHead className="text-end">
                    {t.detail.unitPrice}
                  </TableHead>
                  <TableHead className="text-end">{t.detail.amount}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.items.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-muted-foreground"
                    >
                      —
                    </TableCell>
                  </TableRow>
                ) : (
                  invoice.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.description}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {formatCurrency(item.unitPrice, invoice.currency, locale)}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {formatCurrency(item.amount, invoice.currency, locale)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Totals */}
          <div className="ms-auto mt-4 w-full max-w-xs space-y-1 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
            <div className="flex items-center justify-between gap-3 text-muted-foreground">
              <span>{t.detail.subtotal}</span>
              <span className="tabular-nums">
                {formatCurrency(invoice.subtotal, invoice.currency, locale)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 text-muted-foreground">
              <span>
                {t.detail.taxAmount} ({invoice.taxRate}%)
              </span>
              <span className="tabular-nums">
                {formatCurrency(invoice.taxAmount, invoice.currency, locale)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border pt-1.5 font-semibold">
              <span>{t.detail.total}</span>
              <span className="tabular-nums">
                {formatCurrency(invoice.total, invoice.currency, locale)}
              </span>
            </div>
          </div>

          {invoice.notes && (
            <div className="mt-4 rounded-lg border border-border bg-card px-4 py-3">
              <Label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t.detail.notes}
              </Label>
              <p className="text-sm whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-wrap items-center justify-between gap-2 px-6 pb-6 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              asChild
              variant="ghost"
              size="sm"
              disabled={busy}
            >
              <Link href={`/invoicing/${invoice.id}`}>
                <ExternalLink className="size-4" />
                {t.detail.openPage}
              </Link>
            </Button>
            {onShare && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onShare(invoice)}
                disabled={busy}
              >
                <Share2 className="size-4" />
                {t.share?.shareButton ?? "Share link"}
              </Button>
            )}
            {canManage && onEdit && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onEdit(invoice)}
                disabled={busy || status === "paid"}
                title={
                  status === "paid"
                    ? (t.editDialog?.cannotEditPaid ?? "Paid invoices cannot be edited.")
                    : undefined
                }
              >
                <Pencil className="size-4" />
                {t.detail.edit ?? "Edit invoice"}
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 ms-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setConfirmDelete(false);
                onOpenChange(false);
              }}
              disabled={busy}
            >
              {t.detail.close}
            </Button>
            {canManage && canMarkPaid && (
              <Button type="button" size="sm" onClick={onMarkPaid} disabled={busy}>
                {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
                {t.detail.markPaid}
              </Button>
            )}
            {canManage && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (confirmDelete) {
                    setConfirmDelete(false);
                    onDelete();
                  } else {
                    setConfirmDelete(true);
                  }
                }}
                disabled={busy}
              >
                {confirmDelete ? t.detail.confirmDelete : common.delete}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}