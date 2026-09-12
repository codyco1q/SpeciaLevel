"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";

import { setLocale } from "@/lib/actions/locale";
import type { Locale } from "@/lib/i18n/get-dictionary";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DashboardLocaleSwitcherProps {
  /** Active locale for the current render (from the server). */
  locale: Locale;
  /** Screen-reader / visible label (e.g. "Language" / "اللغة"). */
  label: string;
  /** Localized option labels, e.g. "English" / "العربية". */
  english: string;
  arabic: string;
}

/**
 * Compact language selector for the authenticated shell (sidebar footer and
 * the Settings → Profile tab). Selecting an option calls the `setLocale`
 * server action, which persists the preference on the user's profile AND in
 * the NEXT_LOCALE cookie, then refreshes the current path so the whole page
 * re-renders server-side in the new language (and mirrors to RTL).
 */
export function DashboardLocaleSwitcher({
  locale,
  label,
  english,
  arabic,
}: DashboardLocaleSwitcherProps) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const pendingSwitch = useRef(false);

  function switchTo(next: string) {
    if (next === locale || next === "placeholder") return;
    pendingSwitch.current = true;
    startTransition(() => {
      void setLocale(next as Locale, pathname);
    });
  }

  // Same-URL redirects from the server action are optimized into no-ops by the
  // App Router client, so the root layout's `<html lang dir>` shell would stay
  // stale. When the transition settles, force a router refresh so the whole
  // tree re-renders server-side with the new NEXT_LOCALE cookie.
  useEffect(() => {
    if (pendingSwitch.current && !isPending) {
      pendingSwitch.current = false;
      router.refresh();
    }
  }, [isPending, router]);

  return (
    <Select value={locale} onValueChange={switchTo} disabled={isPending}>
      <SelectTrigger
        aria-label={label}
        className="w-full data-[placeholder]:text-foreground"
      >
        <SelectValue>{locale === "ar" ? arabic : english}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="en">{english}</SelectItem>
        <SelectItem value="ar">{arabic}</SelectItem>
      </SelectContent>
    </Select>
  );
}