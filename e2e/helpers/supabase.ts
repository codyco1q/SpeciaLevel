import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { loadEnvLocal } from "../setup/load-env";

/**
 * Service-role Supabase client for E2E setup/assertions.
 *
 * This mirrors `lib/supabase/admin.ts` but lives outside the app so the
 * Playwright process (which never loads Next.js) can provision fixtures and
 * assert on persisted rows with RLS bypassed.
 *
 * Never import this from app code — it exists only under `e2e/`.
 */
export function serviceRoleClient(): SupabaseClient {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "[e2e] Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "SUPABASE_SERVICE_ROLE_KEY in .env.local before running the E2E suite."
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
