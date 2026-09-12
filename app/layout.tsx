import type { Metadata } from "next";
import { Cairo, Geist, Geist_Mono } from "next/font/google";

import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";
import { getLocale } from "@/lib/i18n/get-dictionary";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Arabic-capable typeface for the RTL locale. Loaded with next/font and
 * applied only when `html[lang="ar"]` (see globals.css), so English pages
 * keep Geist and never pay for the Arabic font file.
 */
const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
});

export const metadata: Metadata = {
  title: "SpeciaLevel",
  description: "Multi-tenant business operating system",
};

// `lang`/`dir` (and Cairo font activation) are read from the NEXT_LOCALE
// cookie at request time via getLocale(). Force dynamic rendering so no
// static/prerendered shell — which would bake in a stale `<html lang="en"
// dir="ltr">` — can ever be served after the user switches language.
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();

  // suppressHydrationWarning: next-themes patches <html> with the resolved
  // theme class (per the NEXT_THEME storage / OS preference) before hydration,
  // so the server-rendered shell intentionally carries no theme class.
  return (
    <html
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
      className={`${geistSans.variable} ${geistMono.variable} ${cairo.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

