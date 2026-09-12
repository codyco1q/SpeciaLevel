import type { Metadata } from "next";

import { MarketingDarkMode } from "@/components/marketing/dark-mode";
import { Footer } from "@/components/marketing/footer";
import { Navbar } from "@/components/marketing/navbar";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";

/**
 * Public-facing SpeciaLevel agency site.
 *
 * Lives in its own route group so its layout, metadata, navigation, and
 * footer stay completely separate from the authenticated app
 * (/login, /signup, /onboarding, /dashboard, ...).
 *
 * The site is dark-mode-first: the wrapper carries the `.dark` class (so the
 * SSR HTML renders dark immediately) and <MarketingDarkMode /> mirrors it onto
 * <html> after mount so portaled UI (Select popover) inherits dark tokens
 * too. On unmount the class is removed, keeping the rest of the app light.
 *
 * i18n: the layout reads the NEXT_LOCALE cookie, loads the matching
 * dictionary, and hands it to the Navbar/Footer. The `<html>` element in the
 * root layout already carries `lang`/`dir` from the same cookie; the wrapper
 * mirrors them so the whole subtree is explicitly scoped too.
 */
export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();

  return {
    metadataBase: new URL("https://specialevel.com"),
    title: dict.meta.title,
    description: dict.meta.description,
    keywords: [
      "AI workflow automation",
      "systems integration",
      "internal portals",
      "business automation",
      "lead automation",
      "SpeciaLevel",
    ],
    openGraph: {
      title: dict.meta.title,
      description: dict.meta.description,
      url: "https://specialevel.com",
      siteName: "SpeciaLevel",
      type: "website",
    },
    robots: { index: true, follow: true },
  };
}

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const dict = await getDictionary();

  return (
    <div
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
      className="dark flex min-h-screen flex-col bg-background text-foreground"
    >
      <MarketingDarkMode />
      <Navbar dict={dict} locale={locale} />
      <main className="flex-1">{children}</main>
      <Footer dict={dict} />
    </div>
  );
}