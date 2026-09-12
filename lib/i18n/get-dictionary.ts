import "server-only";

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
 * Resolves the active locale from the `NEXT_LOCALE` cookie.
 * Always returns a supported locale — anything else falls back to English.
 */
export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_COOKIE)?.value;
  return raw === "ar" ? "ar" : "en";
}

/** Server-side dictionary loader for the active locale. */
export async function getDictionary(): Promise<Dictionary> {
  const locale = await getLocale();
  return dictionaries[locale];
}