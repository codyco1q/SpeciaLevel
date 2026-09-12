"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";

import { setLocale } from "@/lib/actions/locale";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";
import { cn } from "@/lib/utils";

interface LocaleSwitcherProps {
  locale: Locale;
  dict: Dictionary["langSwitcher"];
  className?: string;
}

const OPTIONS: { value: Locale; label: string; shortLabel: string }[] = [
  { value: "en", label: "English", shortLabel: "EN" },
  { value: "ar", label: "العربية", shortLabel: "العربية" },
];

/**
 * Sleek segmented EN | العربية toggle. Clicking calls the setLocale server
 * action, which writes the NEXT_LOCALE cookie and refreshes the current path
 * so the whole page re-renders in the new language (and mirrors to RTL).
 */
export function LocaleSwitcher({ locale, dict, className }: LocaleSwitcherProps) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const pendingSwitch = useRef(false);

  function switchTo(next: Locale) {
    if (next === locale || isPending) return;
    pendingSwitch.current = true;
    startTransition(() => {
      void setLocale(next, pathname);
    });
  }

  // The server action redirects to the *same* URL the user is already on, so
  // the App Router client optimizes that navigation into a no-op and keeps the
  // previously-rendered server component tree — including the root layout's
  // `<html lang dir>` shell. Once the transition settles, force a router
  // refresh so the whole tree (layout + page) is re-fetched with the new
  // NEXT_LOCALE cookie and re-rendered server-side.
  useEffect(() => {
    if (pendingSwitch.current && !isPending) {
      pendingSwitch.current = false;
      router.refresh();
    }
  }, [isPending, router]);

  return (
    <div
      role="group"
      aria-label={dict.label}
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-card/60 p-0.5 transition-opacity",
        isPending && "pointer-events-none opacity-60",
        className
      )}
    >
      {OPTIONS.map((option) => {
        const active = locale === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            aria-label={option.label}
            onClick={() => switchTo(option.value)}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-semibold transition-colors",
              active
                ? "bg-accent text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.shortLabel}
          </button>
        );
      })}
    </div>
  );
}