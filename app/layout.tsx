import type { Metadata } from "next";
import { Cairo, Geist, Geist_Mono } from "next/font/google";

import "./globals.css";

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
  title: "UpLevel",
  description: "Multi-tenant business operating system",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
      className={`${geistSans.variable} ${geistMono.variable} ${cairo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

