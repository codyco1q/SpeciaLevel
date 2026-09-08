import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase client authenticated with the service-role key.
 *
 * The service-role key BYPASSES Row Level Security, so this client is
 * exclusively for server-side admin operations (e.g. creating an
 * organization during onboarding, where RLS would otherwise block the
 * insert/update chain for a user who has no organization yet).
 *
 * CRITICAL: never import this module from a client component — the
 * `server-only` package makes Next.js fail the build if it leaks into
 * the client bundle, protecting SUPABASE_SERVICE_ROLE_KEY.
 */
export function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}