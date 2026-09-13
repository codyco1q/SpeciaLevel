import Link from "next/link";
import {
  CheckCircle2,
  MessageSquareText,
  Receipt,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  INVOICE_STATUS_BADGE_CLASSES,
  formatCurrency,
  formatInvoiceDate,
} from "@/app/(dashboard)/invoicing/invoicing-meta";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";
import type {
  ClientPortalData,
  ClientPortalInvoiceRow,
} from "@/lib/actions/client-portal";

interface ClientPortalHubProps {
  userFullName: string | null;
  organizationName: string;
  data: ClientPortalData | null;
  t: Dictionary["platform"]["clientPortal"];
  platform: Dictionary["platform"];
  locale: Locale;
}

function DeliverableCard({
  data,
  t,
}: {
  data: ClientPortalData;
  t: Dictionary["platform"]["clientPortal"];
}) {
  const { tasks } = data;
  const percent =
    tasks.total === 0
      ? 0
      : Math.round((tasks.completed / tasks.total) * 100);

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row flex-wrap items-start gap-3 pb-2">
        <CheckCircle2 className="mt-0.5 size-4 text-muted-foreground" />
        <div className="flex-1">
          <CardTitle className="text-sm">{t.deliverablesTitle}</CardTitle>
          <CardDescription>{t.deliverablesHint}</CardDescription>
        </div>
        <Link
          href="/tasks"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {t.viewAllDeliverables}
          <ArrowRight className="h-3 w-3 rtl:rotate-180" />
        </Link>
      </CardHeader>
      <CardContent className="flex-1 pt-0">
        {tasks.total === 0 ? (
          <p className="text-sm text-muted-foreground">{t.noActiveTasks}</p>
        ) : (
          <>
            <div className="mb-3 flex items-center gap-6 text-sm">
              <div>
                <span className="text-xl font-bold tabular-nums">
                  {tasks.active}
                </span>{" "}
                <span className="text-muted-foreground">{t.activeTasks}</span>
              </div>
              <div>
                <span className="text-xl font-bold tabular-nums">
                  {tasks.completed}
                </span>{" "}
                <span className="text-muted-foreground">
                  {t.completedDeliverables}
                </span>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{t.progressLabel}</span>
                <span className="font-medium tabular-nums">{percent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function InvoiceCard({
  data,
  t,
  platform,
  locale,
}: {
  data: ClientPortalData;
  t: Dictionary["platform"]["clientPortal"];
  platform: Dictionary["platform"];
  locale: Locale;
}) {
  const { invoices } = data;

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row flex-wrap items-start gap-3 pb-2">
        <Receipt className="mt-0.5 size-4 text-muted-foreground" />
        <div className="flex-1">
          <CardTitle className="text-sm">{t.invoicesTitle}</CardTitle>
          <CardDescription>{t.invoicesHint}</CardDescription>
        </div>
        <Link
          href="/invoicing"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {t.viewAllInvoices}
          <ArrowRight className="h-3 w-3 rtl:rotate-180" />
        </Link>
      </CardHeader>
      <CardContent className="flex-1 pt-0">
        {invoices.recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.noInvoices}</p>
        ) : (
          <>
            <div className="mb-4 flex items-center gap-6 text-sm">
              <div>
                <span className="text-xl font-bold tabular-nums">
                  {formatCurrency(invoices.outstanding, "USD", locale)}
                </span>{" "}
                <span className="text-muted-foreground">
                  {t.outstandingBalance}
                </span>
              </div>
              <div>
                <span className="text-xl font-bold tabular-nums">
                  {formatCurrency(invoices.paid, "USD", locale)}
                </span>{" "}
                <span className="text-muted-foreground">
                  {t.paidInvoicesHint}
                </span>
              </div>
            </div>
            <div className="space-y-1.5">
              {invoices.recent.map((invoice) => (
                <InvoiceRow
                  key={invoice.id}
                  invoice={invoice}
                  platform={platform}
                  locale={locale}
                />
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function InvoiceRow({
  invoice,
  platform,
  locale,
}: {
  invoice: ClientPortalInvoiceRow;
  platform: Dictionary["platform"];
  locale: Locale;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-sm">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium tabular-nums">
          {invoice.invoiceNumber}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatInvoiceDate(invoice.createdAt, locale)}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-medium tabular-nums">
          {formatCurrency(invoice.total, invoice.currency, locale)}
        </span>
        <Badge
          variant="outline"
          className={`px-1.5 py-0 text-[10px] font-normal ${INVOICE_STATUS_BADGE_CLASSES[invoice.status] ?? ""}`}
        >
          {platform.invoicing.statuses[invoice.status] ?? invoice.status}
        </Badge>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────

export function ClientPortalHub({
  userFullName,
  data,
  t,
  platform,
  locale,
}: ClientPortalHubProps) {
  return (
    <div className="p-8">
      {/* ── Welcome banner ─────────────────────────────────────── */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">
          {t.welcomeTitle}
          {userFullName ? `, ${userFullName.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          {t.welcomeSubtitle}
        </p>
      </div>

      {/* ── Cards grid ─────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        {data && <DeliverableCard data={data} t={t} />}
        {data && (
          <InvoiceCard data={data} t={t} platform={platform} locale={locale} />
        )}
      </div>

      {/* ── Quick link: message the team ───────────────────────── */}
      <div className="mt-6">
        <Card>
          <CardContent className="flex items-center justify-between gap-4 py-5">
            <div className="flex items-center gap-3">
              <MessageSquareText className="size-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-semibold">{t.messageTeamTitle}</p>
                <p className="text-xs text-muted-foreground">
                  {t.messageTeamHint}
                </p>
              </div>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/chat">
                {t.openMessages}
                <ArrowRight className="ms-1.5 h-3 w-3 rtl:rotate-180" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}