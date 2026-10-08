import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Signs the user out (clears the Supabase session cookies) and sends
 * them back to /login.
 *
 * Ensures any open time tracking session is stopped immediately if the user
 * forgot to clock out before signing out.
 *
 * The sidebar posts here via `<form method="post">`, so the redirect
 * MUST be 303 (See Other → GET). A default 307 would make the browser
 * re-POST to /login and fail. The origin comes from the request URL so
 * this works on localhost, preview deploys, and production without an
 * extra APP_URL env var.
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const now = new Date();
      // Find any open time entry for this user and clock them out
      const { data: openEntries } = await supabase
        .from("time_entries")
        .select("id, clocked_in_at")
        .eq("user_id", user.id)
        .is("clocked_out_at", null);

      if (openEntries && openEntries.length > 0) {
        for (const entry of openEntries) {
          const durationSeconds = Math.max(
            0,
            Math.floor((now.getTime() - new Date(entry.clocked_in_at).getTime()) / 1000)
          );
          await supabase
            .from("time_entries")
            .update({
              clocked_out_at: now.toISOString(),
              duration_seconds: durationSeconds,
              status: "completed",
            })
            .eq("id", entry.id);
        }
      }
    }
  } catch (err) {
    // If auto-clockout encounters an error, proceed to sign out so user isn't stuck
    console.error("Auto clock-out on sign out error:", err);
  }

  await supabase.auth.signOut();

  return NextResponse.redirect(new URL("/login", request.url), {
    status: 303,
  });
}

