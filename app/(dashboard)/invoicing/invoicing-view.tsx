"use client";

import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Eye,
  MoreHorizontal,
  Pencil,
  Plus,
  Share2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  deleteInvoice,
  getInvoiceById,
  getInvoices,
  updateInvoiceStatus,
  type InvoiceRow,
  type InvoicingSummary,
} from "@/lib/actions/invoicing";
import {
  INVOICE_STATUS_BADGE_CLASSES,
  formatCurrency,
  formatInvoiceDate,
} from "./invoicing-meta";
import {
  CreateInvoiceDialog,
  type InvoiceContactOption,
} from "./create-invoice-dialog";
import { EditInvoiceDialog } from "./edit-invoice-dialog";
import { ShareInvoiceDialog } from "./share-invoice-dialog";
import { InvoiceDetailDialog } from "./invoice-detail-dialog";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

interface MetricCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
  badge?: string;
}

/** Summary card styled like the dashboard's metric cards. */
function MetricCard({ icon: Icon, label, value, hint, badge }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{label}</h3>
        {badge && (
          <Badge
            variant="outline"
            className="ms-auto px-1.5 py-0 text-[10px] font-normal text-red-600"
          >
            {badge}
          </Badge>
        )}
      </div>
      <p className="text-3xl font-bold tracking-tight tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

interface InvoicingViewProps {
  initialInvoices: InvoiceRow[];
  initialSummary: InvoicingSummary;
  contacts: InvoiceContactOption[];
  canManage: boolean;
  /** Localized copy for the current render. */
  platform: Dictionary["platform"];
  locale: Locale;
}

/**
 * Invoicing orchestrator: summary cards, the invoices table with quick
 * actions (mark paid / view / delete), the create-invoice dialog (line
 * item builder), and the branded invoice preview. Mutations run through
 * the server actions and the list is refetched afterwards — the same
 * "revalidate + refetch" pattern as the CRM module.
 */
export function InvoicingView({
  initialInvoices,
  initialSummary,
  contacts,
  canManage,
  platform,
  locale,
}: InvoicingViewProps) {
  const t = platform.invoicing;
  const common = platform.common;
  const [invoices, setInvoices] = useState<InvoiceRow[]>(initialInvoices);
  const [summary, setSummary] = useState<InvoicingSummary>(initialSummary);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailInvoice, setDetailInvoice] = useState<InvoiceRow | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceRow | null>(null);
  const [sharingInvoice, setSharingInvoice] = useState<InvoiceRow | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const searchParams = useSearchParams();
  const urlNew = searchParams.get("new");

  useEffect(() => {
    if (urlNew === "true" || urlNew === "1") {
      setCreateOpen(true);
    }
  }, [urlNew]);

  /** Refetch invoices + summary aggregates. */
  async function refreshAll() {
    const list = await getInvoices();
    if (list) {
      setInvoices(list.invoices);
      setSummary(list.summary);
    }
  }

  function handleView(id: string) {
    setActionError(null);
    setConfirmDeleteId(null);
    startTransition(async () => {
      const row = await getInvoiceById(id);
      if (row) {
        setDetailInvoice(row);
      } else {
        setActionError(t.errors.notFound);
      }
    });
  }

  function handleMarkPaid(invoice: InvoiceRow) {
    setActionError(null);
    setConfirmDeleteId(null);
    startTransition(async () => {
      const result = await updateInvoiceStatus(invoice.id, "paid");
      if (result.status === "error") {
        setActionError(result.error ?? t.errors.updateFailed);
        return;
      }
      setDetailInvoice((current) =>
        current?.id === invoice.id ? { ...current, status: "paid" } : current
      );
      await refreshAll();
    });
  }

  function handleDelete(id: string) {
    setActionError(null);
    setConfirmDeleteId(null);
    startTransition(async () => {
      const result = await deleteInvoice(id);
      if (result.status === "error") {
        setActionError(result.error ?? t.errors.deleteFailed);
        return;
      }
      setDetailInvoice((current) => (current?.id === id ? null : current));
      await refreshAll();
    });
  }

  function handleSaved() {
    setCreateOpen(false);
    void refreshAll();
  }

  /** Row-level two-step delete: first click arms, second click deletes. */
  function handleRowDeleteClick(id: string) {
    if (confirmDeleteId === id) {
      handleDelete(id);
    } else {
      setConfirmDeleteId(id);
    }
  }

  const canMarkPaidRow = (invoice: InvoiceRow) =>
    canManage && invoice.status !== "paid" && invoice.status !== "cancelled";

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        {canManage && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            {t.newInvoice}
          </Button>
        )}
      </div>

      {actionError && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {actionError}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          icon={CircleDollarSign}
          label={t.metrics.totalInvoiced}
          value={formatCurrency(summary.totalInvoiced, "USD", locale)}
          hint={t.metrics.totalInvoicedHint.replace(
            "{count}",
            String(summary.invoiceCount)
          )}
        />
        <MetricCard
          icon={CheckCircle2}
          label={t.metrics.paid}
          value={formatCurrency(summary.totalPaid, "USD", locale)}
          hint={t.metrics.paidHint.replace("{count}", String(summary.paidCount))}
        />
        <MetricCard
          icon={Clock}
          label={t.metrics.outstanding}
          value={formatCurrency(summary.totalOutstanding, "USD", locale)}
          hint={t.metrics.outstandingHint.replace(
            "{count}",
            String(summary.openCount)
          )}
          badge={
            summary.overdueCount > 0
              ? `${summary.overdueCount} ${t.metrics.overdue}`
              : undefined
          }
        />
      </div>

      {/* Invoices table */}
      <div className="mt-6">
        {invoices.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center">
            <p className="text-sm font-medium">{t.noInvoicesYet}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {canManage ? t.noInvoicesYetHintManage : t.noInvoicesYetHintView}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.tableInvoiceNumber}</TableHead>
                  <TableHead>{t.tableClient}</TableHead>
                  <TableHead>{t.tableDueDate}</TableHead>
                  <TableHead className="text-end">{t.tableTotal}</TableHead>
                  <TableHead>{t.tableStatus}</TableHead>
                  <TableHead className="text-end">{common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">
                      {invoice.invoiceNumber}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {invoice.contact ? invoice.contact.name : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatInvoiceDate(invoice.dueDate, locale)}
                    </TableCell>
                    <TableCell className="text-end font-medium tabular-nums">
                      {formatCurrency(invoice.total, invoice.currency, locale)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "px-2 py-0.5 text-xs",
                          INVOICE_STATUS_BADGE_CLASSES[invoice.status]
                        )}
                      >
                        {t.statuses[invoice.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleView(invoice.id)}
                          disabled={isPending}
                        >
                          {t.viewDetails}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-foreground"
                          onClick={() => setSharingInvoice(invoice)}
                          disabled={isPending}
                          title={t.share?.shareButton ?? "Share Payment Link"}
                          aria-label={t.share?.shareButton ?? "Share Payment Link"}
                        >
                          <Share2 className="size-4" />
                        </Button>
                        {canManage && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-foreground"
                            onClick={() => setEditingInvoice(invoice)}
                            disabled={isPending || invoice.status === "paid"}
                            title={
                              invoice.status === "paid"
                                ? (t.editDialog?.cannotEditPaid ?? "Paid invoices cannot be edited.")
                                : (t.detail.edit ?? "Edit invoice")
                            }
                            aria-label={t.detail.edit ?? "Edit invoice"}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        )}
                        {canMarkPaidRow(invoice) && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleMarkPaid(invoice)}
                            disabled={isPending}
                          >
                            {t.markPaid}
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-muted-foreground hover:text-foreground"
                              aria-label={common.actions}
                              disabled={isPending}
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onSelect={() => handleView(invoice.id)}>
                              <Eye className="size-4" />
                              {t.viewDetails}
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setSharingInvoice(invoice)}>
                              <Share2 className="size-4" />
                              {t.share?.shareButton ?? "Share Payment Link"}
                            </DropdownMenuItem>
                            {canManage && (
                              <DropdownMenuItem
                                onSelect={() => setEditingInvoice(invoice)}
                                disabled={invoice.status === "paid"}
                              >
                                <Pencil className="size-4" />
                                {t.detail.edit ?? "Edit invoice"}
                              </DropdownMenuItem>
                            )}
                            {canMarkPaidRow(invoice) && (
                              <DropdownMenuItem onSelect={() => handleMarkPaid(invoice)}>
                                <CheckCircle2 className="size-4" />
                                {t.markPaid}
                              </DropdownMenuItem>
                            )}
                            {canManage && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onSelect={() => handleRowDeleteClick(invoice.id)}
                                >
                                  <Trash2 className="size-4" />
                                  {confirmDeleteId === invoice.id
                                    ? t.detail.confirmDelete
                                    : common.delete}
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <CreateInvoiceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        contacts={contacts}
        onSaved={handleSaved}
        platform={platform}
        locale={locale}
      />
      <InvoiceDetailDialog
        invoice={detailInvoice}
        onOpenChange={(open) => {
          if (!open) setDetailInvoice(null);
        }}
        canManage={canManage}
        onMarkPaid={() => {
          if (detailInvoice) handleMarkPaid(detailInvoice);
        }}
        onDelete={() => {
          if (detailInvoice) handleDelete(detailInvoice.id);
        }}
        onEdit={(invoice) => {
          setDetailInvoice(null);
          setEditingInvoice(invoice);
        }}
        onShare={(invoice) => {
          setDetailInvoice(null);
          setSharingInvoice(invoice);
        }}
        busy={isPending}
        platform={platform}
        locale={locale}
      />
      {editingInvoice && (
        <EditInvoiceDialog
          open={editingInvoice !== null}
          onOpenChange={(open) => {
            if (!open) setEditingInvoice(null);
          }}
          invoice={editingInvoice}
          contacts={contacts}
          onSaved={async () => {
            setEditingInvoice(null);
            setActionError(null);
            startTransition(async () => {
              await refreshAll();
            });
          }}
          platform={platform}
          locale={locale}
        />
      )}
      {sharingInvoice && (
        <ShareInvoiceDialog
          open={sharingInvoice !== null}
          onOpenChange={(open) => {
            if (!open) setSharingInvoice(null);
          }}
          invoice={sharingInvoice}
          platform={platform}
          locale={locale}
          onTokenRegenerated={(newToken) => {
            setInvoices((prev) =>
              prev.map((inv) =>
                inv.id === sharingInvoice.id
                  ? { ...inv, shareToken: newToken }
                  : inv
              )
            );
            setSharingInvoice((prev) =>
              prev ? { ...prev, shareToken: newToken } : null
            );
            if (detailInvoice?.id === sharingInvoice.id) {
              setDetailInvoice((prev) =>
                prev ? { ...prev, shareToken: newToken } : null
              );
            }
          }}
        />
      )}
    </div>
  );
}