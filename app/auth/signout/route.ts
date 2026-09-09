import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Signs the user out (clears the Supabase session cookies) and sends
 * them back to /login.
 *
 * The sidebar posts here via `<form method="post">`, so the redirect
 * MUST be 303 (See Other → GET). A default 307 would make the browser
 * re-POST to /login and fail. The origin comes from the request URL so
 * this works on localhost, preview deploys, and production without an
 * extra APP_URL env var.
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  await supabase.auth.signOut();

  return NextResponse.redirect(new URL("/login", request.url), {
    status: 303,
  });
}
