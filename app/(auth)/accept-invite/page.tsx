import { getInvitationByToken } from "@/lib/actions/invites";
import type { InvitationDetails } from "@/lib/validations/invites";
import { AcceptInviteClient } from "./accept-invite-client";

// Reads searchParams (token) and validates it against the database at
// request time — never prerender.
export const dynamic = "force-dynamic";

/**
 * Dedicated accept-invite page.
 *
 * Linked from invitation emails / admin-copied links as
 * `/accept-invite?token=<token>`. Resolves the invite server-side and
 * renders the appropriate UI:
 *   - Logged out → sign-up form with pre-filled email + org/role preview.
 *   - Logged in  → one-click "Join [Organization]" button.
 *   - Invalid    → error message + link to standard sign-up.
 */
export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawToken = params.token;
  const token =
    typeof rawToken === "string" && rawToken.trim() ? rawToken : undefined;

  let invitation: InvitationDetails | null = null;
  let inviteError: string | null = null;

  if (token) {
    const result = await getInvitationByToken(token);
    if (result.status === "valid") {
      invitation = result.invitation;
    } else if (result.status === "accepted") {
      inviteError = "This invitation has already been accepted.";
    } else if (result.status === "expired") {
      inviteError = "This invitation link has expired. Please ask your admin to resend it.";
    } else if (result.status === "revoked") {
      inviteError = "This invitation has been revoked.";
    } else {
      inviteError = "This invitation link is invalid or has expired.";
    }
  } else {
    inviteError = "No invitation token provided.";
  }

  return (
    <AcceptInviteClient
      token={token}
      invitation={invitation}
      inviteError={inviteError}
    />
  );
}
