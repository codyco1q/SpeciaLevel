import type { Metadata } from "next";

import { MarketingDarkMode } from "@/components/marketing/dark-mode";
import { Footer } from "@/components/marketing/footer";
import { Navbar } from "@/components/marketing/navbar";

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
 */
export const metadata: Metadata = {
  metadataBase: new URL("https://specialevel.com"),
  title: "SpeciaLevel — Custom AI Automation & Systems Integration",
  description:
    "SpeciaLevel designs and builds custom AI workflow automations, systems integrations, and internal portals that eliminate manual work and connect your operations.",
  keywords: [
    "AI workflow automation",
    "systems integration",
    "internal portals",
    "business automation",
    "lead automation",
    "SpeciaLevel",
  ],
  openGraph: {
    title: "SpeciaLevel — Custom AI Automation & Systems Integration",
    description:
      "Custom AI workflow automation, systems integration, and internal portals built for the way your business actually operates.",
    url: "https://specialevel.com",
    siteName: "SpeciaLevel",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dark flex min-h-screen flex-col bg-background text-foreground">
      <MarketingDarkMode />
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}