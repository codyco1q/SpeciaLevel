import { ArrowRight } from "lucide-react";

import { Monogram } from "@/components/marketing/brand";

const FOOTER_LINKS = [
  { href: "#services", label: "Services" },
  { href: "#packages", label: "Packages" },
  { href: "#process", label: "Process" },
  { href: "#faq", label: "FAQ" },
  { href: "#contact", label: "Book a Consultation" },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/10 bg-background">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm space-y-3">
            <a href="#top" className="flex items-center gap-2.5">
              <Monogram />
              <span className="text-lg font-bold tracking-tight text-foreground">
                SpeciaLevel
              </span>
            </a>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Custom AI workflow automation, systems integration, and internal
              portals — built for the way your business actually operates.
            </p>
          </div>

          <nav aria-label="Footer" className="flex flex-col gap-2">
            {FOOTER_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} SpeciaLevel. All rights reserved.</p>
          <a
            href="/login"
            className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
          >
            Client Login
            <ArrowRight className="size-3.5" />
          </a>
        </div>
      </div>
    </footer>
  );
}