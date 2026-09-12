import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import en from "./dictionaries/en.json";
import ar from "./dictionaries/ar.json";

/** Name of the cookie that stores the active UI locale. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

export const locales = ["en", "ar"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

/**
 * The shape of every dictionary is locked to `en.json` — the source of
 * truth. Client components import this type with `import type` (erased at
 * compile time), so the `server-only` guard never reaches the browser.
 */
export type Dictionary = typeof en;

const dictionaries: Record<Locale, Dictionary> = { en, ar };

/**
 * Resolves the active locale:
 *
 *  1. The `NEXT_LOCALE` cookie wins when present.
 *  2. Otherwise a signed-in user falls back to the `preferred_language`
 *     persisted on their profile — so an Arabic user lands on Arabic from
 *     any new browser/device even before they touch the switcher.
 *  3. Everything else resolves to the default locale.
 *
 * Wrapped in React's `cache()` so every server component in a request
 * shares one resolution (cookie read + optional profile lookup) instead of
 * repeating the work for the root layout, route layouts, and page.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_COOKIE)?.value;
  if (raw === "ar" || raw === "en") return raw;

  // No cookie — prefer the signed-in user's persisted language. The dynamic
  // import keeps Supabase modules out of any bundle that only needs the
  // dictionary type, and the try/catch degrades gracefully when Supabase
  // env vars are missing (e.g. static prerendering) or outside an auth scope.
  try {
    const { createServerClient } = await import("@/lib/supabase/server");
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("preferred_language")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.preferred_language === "ar") return "ar";
    }
  } catch {
    // Fall through to the default locale.
  }

  return defaultLocale;
});

/** Server-side dictionary loader for the active locale. */
export async function getDictionary(): Promise<Dictionary> {
  const locale = await getLocale();
  return dictionaries[locale];
}