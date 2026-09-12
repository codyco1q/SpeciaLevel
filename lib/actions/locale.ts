"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
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

  // Persist the preference on the signed-in user's profile (best-effort) so
  // any new browser/device inherits the same language via the profile
  // fallback in getLocale(). The cookie alone still switches the page, so
  // a failure here never blocks the redirect.
  try {
    const { createServerClient } = await import("@/lib/supabase/server");
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await supabase
        .from("profiles")
        .update({ preferred_language: target })
        .eq("id", user.id);
    }
  } catch {
    // Not signed in, or Supabase is unavailable — the local preference still applies.
  }

  // Invalidate the full route tree so the NEXT render is guaranteed to be
  // executed server-side. Without this, the App Router keeps the cached root
  // layout (old `lang`/`dir` on <html>) and, because the redirect below
  // targets the *same* URL the user is already on, the browser never re-fetches
  // the layout segment — the page would stay in the previous language.
  revalidatePath("/", "layout");

  redirect(safePath);
}