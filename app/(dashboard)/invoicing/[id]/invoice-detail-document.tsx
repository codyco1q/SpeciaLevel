"use client";

import { useState, useTransition } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Edit,
  LoaderCircle,
  Printer,
  Share2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Monogram } from "@/components/brand";
import {
  updateInvoiceStatus,
  type InvoiceRow,
} from "@/lib/actions/invoicing";
import {
  INVOICE_STATUS_BADGE_CLASSES,
  formatCurrency,
  formatInvoiceDate,
} from "../invoicing-meta";
import { EditInvoiceDialog } from "../edit-invoice-dialog";
import { ShareInvoiceDialog } from "../share-invoice-dialog";
import type { InvoiceContactOption } from "../create-invoice-dialog";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

interface InvoiceDetailDocumentProps {
  invoice: InvoiceRow | null;
  canManage: boolean;
  contacts?: InvoiceContactOption[];
  organizationName: string;
  platform: Dictionary["platform"];
  locale: Locale;
}

/**
 * Full-page printable invoice document at /invoicing/[id].
 *
 * The invoice data is fetched server-side through getInvoiceById()
 * (RLS-enforced) and passed down as props, so rendering never refetches
 * or widens the access scope. This client component owns the two
 * interactive bits: the print trigger (window.print along with the
 * @media print stylesheet in globals.css) and the mark-paid mutation
 * (gated on `invoicing.manage`, which Client roles never hold).
 */
export function InvoiceDetailDocument({
  invoice,
  canManage,
  contacts = [],
  organizationName,
  platform,
  locale,
}: InvoiceDetailDocumentProps) {
  const t = platform.invoicing;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  /* ── Not found / no access ────────────────────────────────────── */
  if (!invoice) {
    return (
      <div className="p-8 print:p-0">
        <div className="mb-6 flex print:hidden">
          <Button type="button" asChild variant="ghost" size="sm">
            <Link href="/invoicing">
              <ArrowLeft className="size-4 rtl:rotate-180" />
              {t.detail.back}
            </Link>
          </Button>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-2xl font-bold tracking-tight">
            {t.detail.notFound}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t.detail.notFoundHint}
          </p>
        </div>
      </div>
    );
  }

  const { status } = invoice;
  const canMarkPaid =
    canManage && status !== "paid" && status !== "cancelled";
  const canEdit = canManage && status !== "paid";

  /* ── Mark-paid handler ────────────────────────────────────────── */
  const handleMarkPaid = () => {
    setActionError(null);
    startTransition(async () => {
      const result = await updateInvoiceStatus(invoice.id, "paid");
      if (result.status === "error") {
        setActionError(result.error ?? t.errors.updateFailed);
      } else {
        // Re-render the server component so the fetched invoice (and
        // therefore the status badge + pay button) reflects the update.
        router.refresh();
      }
    });
  };

  /* ── Render ───────────────────────────────────────────────────── */
  return (
    <div className="p-8 print:p-0">
      {/* Actions bar — screen only */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button type="button" asChild variant="ghost" size="sm">
          <Link href="/invoicing">
            <ArrowLeft className="size-4 rtl:rotate-180" />
            {t.detail.back}
          </Link>
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditOpen(true)}
            >
              <Edit className="size-4" />
              {t.detail.edit ?? "Edit invoice"}
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={() => setShareOpen(true)}
          >
            <Share2 className="size-4" />
            {t.share?.shareButton ?? "Share Payment Link"}
          </Button>

          {canMarkPaid && (
            <Button
              type="button"
              onClick={handleMarkPaid}
              disabled={isPending}
            >
              {isPending ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              {t.detail.markPaid}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => window.print()}
          >
            <Printer className="size-4" />
            {t.detail.print}
          </Button>
        </div>
      </div>

      {actionError && (
        <p className="mb-4 text-sm text-destructive print:hidden">
          {actionError}
        </p>
      )}

      {/* Printable A4 document (see the @media print block in
          globals.css; .print-document forces black-on-white) */}
      <div className="print-document rounded-xl border border-border bg-card p-8 shadow-sm print:rounded-none print:border-0 print:p-0">
        {/* ── Brand header ──────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex items-center gap-3">
            <Monogram className="size-12 rounded-xl" />
            <div>
              <p className="text-xl font-bold tracking-tight">
                SpeciaLevel
              </p>
              <p className="text-sm text-muted-foreground">
                {organizationName}
              </p>
            </div>
          </div>

          <div className="space-y-1 text-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t.detail.invoiceNumber}
              </p>
              <p className="text-base font-semibold">
                {invoice.invoiceNumber}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t.detail.issued}
              </p>
              <p className="text-sm tabular-nums">
                {formatInvoiceDate(invoice.createdAt, locale)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t.detail.due}
              </p>
              <p className="text-sm tabular-nums">
                {formatInvoiceDate(invoice.dueDate, locale)}
              </p>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "mt-2 px-2.5 py-0.5 text-xs",
                INVOICE_STATUS_BADGE_CLASSES[status]
              )}
            >
              {t.statuses[status]}
            </Badge>
          </div>
        </div>

        <hr className="my-8 border-border" />

        {/* ── Client block ──────────────────────────────────────── */}
        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t.detail.billedTo}
            </p>
            {invoice.contact ? (
              <div className="space-y-0.5 text-sm">
                <p className="font-semibold">{invoice.contact.name}</p>
                {invoice.contact.company && (
                  <p className="text-muted-foreground">
                    {invoice.contact.company}
                  </p>
                )}
                {invoice.contact.email && (
                  <p className="text-muted-foreground">
                    {invoice.contact.email}
                  </p>
                )}
                {invoice.contact.phone && (
                  <p className="text-muted-foreground">
                    {invoice.contact.phone}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t.detail.noClient}
              </p>
            )}
          </div>
        </div>
        {/* ── Line items ────────────────────────────────────────── */}
        <div className="mt-8 overflow-hidden rounded-lg border border-border print:rounded-none">
          <Table>
            <TableHeader className="bg-muted/50 [&_tr]:border-b">
              <TableRow>
                <TableHead>{t.detail.description}</TableHead>
                <TableHead className="w-24 text-end">
                  {t.detail.quantity}
                </TableHead>
                <TableHead className="w-32 text-end">
                  {t.detail.unitPrice}
                </TableHead>
                <TableHead className="w-32 text-end">
                  {t.detail.amount}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="[&>tr]:border-b">
              {invoice.items.map((item) => (
                <TableRow key={item.id} className="[&_td]:py-3">
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-end tabular-nums">
                    {item.quantity}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {formatCurrency(
                      item.unitPrice,
                      invoice.currency,
                      locale
                    )}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {formatCurrency(
                      item.amount,
                      invoice.currency,
                      locale
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* ── Financial summary ─────────────────────────────────── */}
        <div className="ms-auto mt-8 w-full max-w-xs space-y-1.5 text-sm">
          <div className="flex items-center justify-between gap-4 text-muted-foreground">
            <span>{t.detail.subtotal}</span>
            <span className="tabular-nums">
              {formatCurrency(
                invoice.subtotal,
                invoice.currency,
                locale
              )}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 text-muted-foreground">
            <span>
              {t.detail.taxAmount} ({invoice.taxRate}%)
            </span>
            <span className="tabular-nums">
              {formatCurrency(
                invoice.taxAmount,
                invoice.currency,
                locale
              )}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 border-t-2 border-border pt-2 text-base font-bold">
            <span>{t.detail.total}</span>
            <span className="tabular-nums">
              {formatCurrency(invoice.total, invoice.currency, locale)}
            </span>
          </div>
        </div>

        {/* ── Notes ─────────────────────────────────────────────── */}
        {invoice.notes && (
          <div className="mt-8 rounded-lg border border-border bg-muted/30 px-4 py-3 print:border-0 print:bg-transparent print:p-0">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t.detail.notes}
            </p>
            <p className="whitespace-pre-wrap text-sm">
              {invoice.notes}
            </p>
          </div>
        )}
      </div>

      {/* Edit Invoice Dialog */}
      {canEdit && (
        <EditInvoiceDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          invoice={invoice}
          contacts={contacts}
          onSaved={() => router.refresh()}
          platform={platform}
          locale={locale}
        />
      )}

      {/* Share Payment Link Dialog */}
      <ShareInvoiceDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        invoice={invoice}
        platform={platform}
        locale={locale}
        onTokenRegenerated={() => router.refresh()}
      />
    </div>
  );
}