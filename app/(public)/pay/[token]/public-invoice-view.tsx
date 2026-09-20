"use client";

import { useState } from "react";
import {
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  Info,
  Printer,
  ShieldCheck,
} from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Monogram } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSwitcher } from "@/components/marketing/locale-switcher";
import { cn } from "@/lib/utils";
import type { PublicInvoiceData } from "@/lib/actions/invoicing";
import {
  INVOICE_STATUS_BADGE_CLASSES,
  formatCurrency,
  formatInvoiceDate,
} from "@/app/(dashboard)/invoicing/invoicing-meta";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

interface PublicInvoiceViewProps {
  invoice: PublicInvoiceData;
  platform: Dictionary["platform"];
  langSwitcher: Dictionary["langSwitcher"];
  locale: Locale;
}

export function PublicInvoiceView({
  invoice,
  platform,
  langSwitcher,
  locale,
}: PublicInvoiceViewProps) {
  const t = platform.invoicing;
  const pay = t.publicPayment;
  const common = platform.common;

  const [payModalOpen, setPayModalOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const isPaid = invoice.status === "paid";

  async function copyText(field: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <div className="min-h-screen bg-muted/20 text-foreground flex flex-col print:bg-white print:text-black">
      {/* ── Top Navbar ────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 px-6 py-4 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Monogram className="size-8 rounded-lg" />
            <div>
              <span className="text-sm font-bold tracking-tight">SpeciaLevel</span>
              <span className="ms-2 text-xs text-muted-foreground">
                {pay?.brandSubtitle ?? "Official Invoice"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LocaleSwitcher locale={locale} dict={langSwitcher} />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* ── Main Container ───────────────────────────────────── */}
      <main className="mx-auto my-8 w-full max-w-4xl flex-1 px-4 sm:px-6 print:m-0 print:max-w-none print:p-0">
        {/* Status Callout (when paid) */}
        {isPaid && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-700 dark:text-emerald-400 print:hidden">
            <CheckCircle2 className="size-5 shrink-0" />
            <div className="text-sm font-medium">
              {pay?.alreadyPaidNotice ??
                "This invoice has been marked as paid. No further action is required."}
            </div>
          </div>
        )}

        {/* ── Invoice Document Card ───────────────────────────── */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-10 print:rounded-none print:border-0 print:p-0 print:shadow-none">
          {/* Header Row */}
          <div className="flex flex-wrap items-start justify-between gap-6 border-b border-border pb-8">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Building2 className="size-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">
                    {invoice.organizationName}
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    {pay?.brandSubtitle ?? "Official Invoice"}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-1 text-end">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t.detail.invoiceNumber}
              </p>
              <p className="text-xl font-bold">{invoice.invoiceNumber}</p>
              <div className="pt-1">
                <Badge
                  variant="outline"
                  className={cn(
                    "px-3 py-1 text-xs font-medium",
                    INVOICE_STATUS_BADGE_CLASSES[invoice.status]
                  )}
                >
                  {t.statuses[invoice.status]}
                </Badge>
              </div>
            </div>
          </div>

          {/* Details Row: Billed To & Dates */}
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t.detail.billedTo}
              </p>
              {invoice.contact ? (
                <div className="text-sm">
                  <p className="font-semibold text-foreground">
                    {invoice.contact.name}
                  </p>
                  {invoice.contact.company && (
                    <p className="text-muted-foreground">
                      {invoice.contact.company}
                    </p>
                  )}
                  <p className="text-muted-foreground">{invoice.contact.email}</p>
                </div>
              ) : (
                <p className="text-sm italic text-muted-foreground">
                  {t.detail.noClient}
                </p>
              )}
            </div>

            <div className="space-y-2 sm:text-end">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t.detail.issued}:{" "}
                </span>
                <span className="text-sm font-medium">
                  {formatInvoiceDate(invoice.createdAt, locale)}
                </span>
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t.detail.due}:{" "}
                </span>
                <span className="text-sm font-medium">
                  {formatInvoiceDate(invoice.dueDate, locale)}
                </span>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="mt-8 overflow-hidden rounded-xl border border-border print:rounded-none">
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
                  <TableRow key={item.id} className="[&_td]:py-3.5">
                    <TableCell className="font-medium">
                      {item.description}
                    </TableCell>
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
                    <TableCell className="text-end tabular-nums font-medium">
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

          {/* Financial Summary Card */}
          <div className="ms-auto mt-8 w-full max-w-xs space-y-2 text-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>{t.detail.subtotal}</span>
              <span className="tabular-nums">
                {formatCurrency(invoice.subtotal, invoice.currency, locale)}
              </span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>
                {t.detail.taxAmount} ({invoice.taxRate}%)
              </span>
              <span className="tabular-nums">
                {formatCurrency(invoice.taxAmount, invoice.currency, locale)}
              </span>
            </div>
            <div className="flex items-center justify-between border-t-2 border-border pt-2 text-lg font-bold text-foreground">
              <span>{t.detail.total}</span>
              <span className="tabular-nums text-primary">
                {formatCurrency(invoice.total, invoice.currency, locale)}
              </span>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="mt-8 rounded-xl border border-border bg-muted/30 p-4 print:border-0 print:bg-transparent print:p-0">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t.detail.notes}
              </p>
              <p className="whitespace-pre-wrap text-sm text-foreground">
                {invoice.notes}
              </p>
            </div>
          )}
        </div>

        {/* ── Public Action Bar ── */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-sm print:hidden">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="size-5 text-emerald-500" />
            <span>Secure Invoicing & Payment via SpeciaLevel</span>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => window.print()}
              className="gap-2"
            >
              <Printer className="size-4" />
              {pay?.print ?? t.detail.print}
            </Button>

            {!isPaid && (
              <Button
                type="button"
                size="lg"
                onClick={() => setPayModalOpen(true)}
                className="gap-2 px-6 font-semibold"
              >
                <CreditCard className="size-4" />
                {pay?.payNow ?? "Pay Now"}
              </Button>
            )}
          </div>
        </div>
      </main>

      {/* ── Payment Instructions Modal ───────────────────────────── */}
      <Dialog open={payModalOpen} onOpenChange={setPayModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CreditCard className="size-5" />
            </div>
            <DialogTitle>
              {pay?.payNowModalTitle ?? "Payment Instructions"}
            </DialogTitle>
            <DialogDescription>
              {(
                pay?.payNowModalSubtitle ??
                "Direct Bank Transfer details for {invoiceNumber}"
              ).replace("{invoiceNumber}", invoice.invoiceNumber)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <span>{pay?.bankName ?? "Bank Name"}</span>
                <span className="text-foreground font-medium normal-case">
                  {pay?.bankValue ?? "SpeciaLevel Corporate Banking"}
                </span>
              </div>

              <div className="border-t border-border pt-2 space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{pay?.iban ?? "IBAN / Account Number"}</span>
                  <button
                    type="button"
                    onClick={() =>
                      copyText(
                        "iban",
                        pay?.ibanValue ?? "SA0380000000608010167519"
                      )
                    }
                    className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline"
                  >
                    {copiedField === "iban" ? (
                      <Check className="size-3 text-emerald-500" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                    {copiedField === "iban" ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="font-mono text-xs font-semibold text-foreground select-all">
                  {pay?.ibanValue ?? "SA0380000000608010167519"}
                </p>
              </div>

              <div className="border-t border-border pt-2 space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{pay?.swift ?? "SWIFT / BIC"}</span>
                  <button
                    type="button"
                    onClick={() =>
                      copyText("swift", pay?.swiftValue ?? "SPECUS33XXX")
                    }
                    className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline"
                  >
                    {copiedField === "swift" ? (
                      <Check className="size-3 text-emerald-500" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                    {copiedField === "swift" ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="font-mono text-xs font-semibold text-foreground select-all">
                  {pay?.swiftValue ?? "SPECUS33XXX"}
                </p>
              </div>

              <div className="border-t border-border pt-2 space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{pay?.reference ?? "Payment Reference"}</span>
                  <button
                    type="button"
                    onClick={() => copyText("ref", invoice.invoiceNumber)}
                    className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline"
                  >
                    {copiedField === "ref" ? (
                      <Check className="size-3 text-emerald-500" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                    {copiedField === "ref" ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="font-mono text-xs font-bold text-primary select-all">
                  {invoice.invoiceNumber}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
              <Info className="size-4 shrink-0 text-primary mt-0.5" />
              <p>
                {pay?.onlinePaymentsComingSoon ??
                  "Online credit card and Apple Pay processing is coming soon. Please complete your transfer using the bank details above."}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPayModalOpen(false)}
            >
              {t.detail.close}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="mt-auto border-t border-border bg-card/40 py-6 text-center text-xs text-muted-foreground print:hidden">
        <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-2 px-6 sm:flex-row">
          <div className="flex items-center gap-2">
            <Monogram className="size-5 rounded" />
            <span>SpeciaLevel • Business Operating System</span>
          </div>
          <p>© {new Date().getFullYear()} SpeciaLevel. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
