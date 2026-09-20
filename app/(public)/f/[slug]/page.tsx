import type { Metadata } from "next";
import { getPublicFormBySlug } from "@/lib/actions/forms";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { PublicFormView } from "./public-form-view";
import { Monogram } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSwitcher } from "@/components/marketing/locale-switcher";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

interface FormPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: FormPageProps): Promise<Metadata> {
  const { slug } = await params;
  const form = await getPublicFormBySlug(slug);

  if (!form) {
    return {
      title: "Form Not Found - SpeciaLevel",
    };
  }

  return {
    title: `${form.title} • ${form.organizationName} - SpeciaLevel`,
    description: form.description || `Submit ${form.title} to ${form.organizationName}`,
  };
}

export default async function PublicFormPage({ params }: FormPageProps) {
  const { slug } = await params;
  const form = await getPublicFormBySlug(slug);
  const { platform, langSwitcher } = await getDictionary();
  const locale = await getLocale();
  const t = platform.forms;

  if (!form) {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <header className="border-b border-border bg-card/50 px-6 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center justify-between">
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
              {t.public.notFound}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {t.public.notFoundHint}
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
    <PublicFormView
      form={form}
      dictionary={platform.forms}
      langSwitcher={langSwitcher}
      locale={locale}
    />
  );
}
