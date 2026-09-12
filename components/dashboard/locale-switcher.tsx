"use client";

import { usePathname } from "next/navigation";
import { useTransition } from "react";

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
  const [isPending, startTransition] = useTransition();

  function switchTo(next: string) {
    if (next === locale || next === "placeholder") return;
    startTransition(() => {
      void setLocale(next as Locale, pathname);
    });
  }

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