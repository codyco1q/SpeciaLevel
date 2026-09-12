"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  defaultLocale,
  LOCALE_COOKIE,
  locales,
  type Locale,
} from "@/lib/i18n/get-dictionary";

/**
 * Persists the active UI locale in the `NEXT_LOCALE` cookie and refreshes
 * the current path so the page re-renders server-side in the new language.
 *
 * The client passes the current pathname so the refresh lands back on the
 * same route (marketing pages are single-page; there are no `/ar` prefixes).
 */
export async function setLocale(locale: Locale, pathname: string = "/") {
  const target = locales.includes(locale) ? locale : defaultLocale;
  const safePath = pathname.startsWith("/") ? pathname : "/";

  (await cookies()).set(LOCALE_COOKIE, target, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  redirect(safePath);
}