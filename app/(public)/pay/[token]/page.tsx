import type { Metadata } from "next";
import { getPublicInvoiceByToken } from "@/lib/actions/invoicing";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { PublicInvoiceView } from "./public-invoice-view";
import { Monogram } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSwitcher } from "@/components/marketing/locale-switcher";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

interface PayPageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({
  params,
}: PayPageProps): Promise<Metadata> {
  const { token } = await params;
  const invoice = await getPublicInvoiceByToken(token);

  if (!invoice) {
    return {
      title: "Invoice Not Found - SpeciaLevel",
    };
  }

  return {
    title: `Invoice ${invoice.invoiceNumber} • ${invoice.organizationName} - SpeciaLevel`,
    description: `View and pay invoice ${invoice.invoiceNumber} from ${invoice.organizationName}`,
  };
}

export default async function PublicPayPage({ params }: PayPageProps) {
  const { token } = await params;
  const invoice = await getPublicInvoiceByToken(token);
  const { platform, langSwitcher } = await getDictionary();
  const locale = await getLocale();
  const t = platform.invoicing;

  if (!invoice) {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <header className="border-b border-border bg-card/50 px-6 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <div className="flex items-center gap-3">
              <Monogram className="size-8 rounded-lg" />
              <span className="font-bold tracking-tight">SpeciaLevel</span>
            </div>
            <div className="flex items-center gap-2">
              <LocaleSwitcher locale={locale} dict={langSwitcher} />
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <span className="text-2xl font-bold">!</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight">
              {t.detail.notFound}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {t.publicPayment?.invoiceExpired ?? t.detail.notFoundHint}
            </p>
            <div className="mt-6">
              <Button asChild variant="outline" className="gap-2">
                <Link href="/">
                  <ArrowLeft className="size-4 rtl:rotate-180" />
                  SpeciaLevel Home
                </Link>
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <PublicInvoiceView
      invoice={invoice}
      platform={platform}
      langSwitcher={langSwitcher}
      locale={locale}
    />
  );
}
