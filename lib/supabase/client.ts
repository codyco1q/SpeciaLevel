import { createBrowserClient as createSsrBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client for Client Components (login, signup, etc.).
 *
 * MUST use `@supabase/ssr`'s `createBrowserClient` — NOT the plain
 * `createClient` from `@supabase/supabase-js`.
 *
 * Why: the SSR browser client persists the session to cookies, which is
 * the only channel `proxy.ts` (edge) and `lib/supabase/server.ts` (server
 * components / actions) can read. The plain client persists to
 * localStorage only, so the server never sees the session: login succeeds
 * in the browser, then `proxy.ts` sees no user and bounces straight back
 * to /login — the "silent hang / no redirect" bug.
 */
export function createBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env file."
    );
  }

  return createSsrBrowserClient(supabaseUrl, supabaseAnonKey);
}
