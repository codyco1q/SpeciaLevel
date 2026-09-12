"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Lock, Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Monogram } from "@/components/marketing/brand";

const NAV_LINKS = [
  { href: "#services", label: "Services" },
  { href: "#packages", label: "Packages" },
  { href: "#process", label: "Process" },
  { href: "#faq", label: "FAQ" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

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
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
          >
            <Link href="/login">
              <Lock />
              Client Portal
            </Link>
          </Button>
          <Button asChild size="lg">
            <a href="#contact">
              Book a Consultation
              <ArrowRight />
            </a>
          </Button>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X /> : <Menu />}
        </Button>
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
                  Book a Consultation
                  <ArrowRight />
                </a>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/login" onClick={() => setOpen(false)}>
                  Client Portal
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}