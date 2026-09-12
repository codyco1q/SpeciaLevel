import type { Metadata } from "next";

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
 * Theming: dark mode is no longer hard-coded here. The root layout wraps the
 * whole app in a next-themes <ThemeProvider> (attribute="class",
 * defaultTheme="system"), so the marketing site follows the user's system
 * preference and the ThemeToggle in the navbar controls Light / Dark /
 * System exactly like the client portal. All section components use shadcn
 * theme tokens so they render correctly in both modes.
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
      className="flex min-h-screen flex-col bg-background text-foreground"
    >
      <Navbar dict={dict} locale={locale} />
      <main className="flex-1">{children}</main>
      <Footer dict={dict} />
    </div>
  );
}