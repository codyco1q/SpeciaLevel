import { ArrowRight } from "lucide-react";

import { Monogram } from "@/components/marketing/brand";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

const SECTION_LINKS = ["services", "packages", "process", "faq"] as const;

export function Footer({ dict }: { dict: Dictionary }) {
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
              {dict.footer.tagline}
            </p>
          </div>

          <nav aria-label="Footer" className="flex flex-col gap-2">
            {SECTION_LINKS.map((key) => (
              <a
                key={key}
                href={`#${key}`}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {dict.nav[key]}
              </a>
            ))}
            <a
              href="#contact"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {dict.footer.bookConsultation}
            </a>
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} SpeciaLevel. {dict.footer.rights}
          </p>
          <a
            href="/login"
            className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
          >
            {dict.footer.clientLogin}
            <ArrowRight className="size-3.5 rtl:rotate-180" />
          </a>
        </div>
      </div>
    </footer>
  );
}