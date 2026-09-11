import { getInvitationByToken } from "@/lib/actions/invites";
import type { InvitationDetails } from "@/lib/validations/invites";
import SignupForm from "./signup-form";

// Reads searchParams (invite token) and validates it against the database at
// request time — never prerender the public sign-up page ahead of time.
export const dynamic = "force-dynamic";

/**
 * Public sign-up page.
 *
 * With `?invite=<token>` the invitation is validated server-side; a valid
 * token renders the invite-aware form (locked email, org/role preview), an
 * invalid/expired/revoked one renders a warning plus standard sign-up.
 */
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawInvite = params.invite;
  const inviteToken =
    typeof rawInvite === "string" && rawInvite.trim() ? rawInvite : undefined;

  let invitation: InvitationDetails | null = null;
  let inviteError: string | null = null;

  if (inviteToken) {
    const result = await getInvitationByToken(inviteToken);
    if (result.status === "valid") {
      invitation = result.invitation;
    } else {
      // One generic message — never reveal whether a token was missing,
      // revoked, expired, or already used.
      inviteError = "This invitation link is invalid or has expired.";
    }
  }

  return (
    <SignupForm
      inviteToken={inviteToken}
      invitation={invitation}
      inviteError={inviteError}
    />
  );
}