"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Lock, Menu, X } from "lucide-react";

import { LocaleSwitcher } from "@/components/marketing/locale-switcher";
import { Button } from "@/components/ui/button";
import { Monogram } from "@/components/marketing/brand";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

interface NavbarProps {
  dict: Dictionary;
  locale: Locale;
}

export function Navbar({ dict, locale }: NavbarProps) {
  const [open, setOpen] = useState(false);

  const NAV_LINKS = useMemo(
    () => [
      { href: "#services", label: dict.nav.services },
      { href: "#packages", label: dict.nav.packages },
      { href: "#process", label: dict.nav.process },
      { href: "#faq", label: dict.nav.faq },
    ],
    [dict]
  );

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-background/85 backdrop-blur-xl">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6"
      >
        <a href="#top" className="flex items-center gap-2.5">
          <Monogram />
          <span className="text-lg font-bold tracking-tight text-foreground">
            SpeciaLevel
          </span>
        </a>

        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <LocaleSwitcher locale={locale} dict={dict.langSwitcher} />
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
          >
            <Link href="/login">
              <Lock />
              {dict.nav.clientPortal}
            </Link>
          </Button>
          <Button asChild size="lg">
            <a href="#contact">
              {dict.nav.bookConsultation}
              <ArrowRight className="rtl:rotate-180" />
            </a>
          </Button>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <LocaleSwitcher locale={locale} dict={dict.langSwitcher} />
          <Button
            variant="ghost"
            size="icon"
            aria-expanded={open}
            aria-label={open ? dict.nav.closeMenu : dict.nav.openMenu}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </nav>

      {open && (
        <div className="border-t border-white/10 bg-background/95 px-4 pb-4 pt-2 backdrop-blur-xl md:hidden">
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-2 flex flex-col gap-2">
              <Button asChild size="lg">
                <a href="#contact" onClick={() => setOpen(false)}>
                  {dict.nav.bookConsultation}
                  <ArrowRight className="rtl:rotate-180" />
                </a>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/login" onClick={() => setOpen(false)}>
                  {dict.nav.clientPortal}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}