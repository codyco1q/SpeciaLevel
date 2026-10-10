import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import OnboardingForm from "./onboarding-form";
import { Monogram } from "@/components/brand";

// Auth-gated page reads cookies + user context at request time.
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const userContext = await getCurrentUserContext();

  if (!userContext) {
    redirect("/login");
  }

  // Users who already belong to an organization have no business here.
  if (userContext.organization) {
    redirect("/dashboard");
  }

  // Check whether this user has any pending invitations for their email.
  // If so, show a banner that lets them jump straight to the accept-invite
  // page instead of creating a brand-new organization.
  let pendingInvite: {
    token: string;
    organizationName: string;
    roleName: string;
  } | null = null;

  const email = userContext.user.email;
  if (email) {
    const admin = createServiceRoleClient();
    const { data: invite } = await admin
      .from("organization_invitations")
      .select(
        `token,
         organization:organizations!fk_organization_invitations_organization(name),
         role:roles!fk_organization_invitations_role(name)`
      )
      .eq("email", email.toLowerCase())
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .limit(1)
      .maybeSingle();

    if (invite) {
      const orgName =
        (Array.isArray(invite.organization)
          ? invite.organization[0]?.name
          : (invite.organization as { name?: string } | null)?.name) ??
        "your organization";
      const roleName =
        (Array.isArray(invite.role)
          ? invite.role[0]?.name
          : (invite.role as { name?: string } | null)?.name) ??
        "team member";
      pendingInvite = {
        token: invite.token,
        organizationName: orgName,
        roleName,
      };
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Monogram className="mx-auto mb-4 size-12 rounded-xl" />
          <h1 className="text-2xl font-bold">Set up your workspace</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your organization to get started
          </p>
        </div>

        {pendingInvite && (
          <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
            <p className="text-sm font-medium">
              You have a pending invitation!
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              You&apos;ve been invited to join{" "}
              <span className="font-medium text-foreground">
                {pendingInvite.organizationName}
              </span>{" "}
              as{" "}
              <span className="font-medium text-foreground">
                {pendingInvite.roleName}
              </span>
              .
            </p>
            <Link
              href={`/accept-invite?token=${pendingInvite.token}`}
              className="mt-2 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Accept invitation
            </Link>
          </div>
        )}

        <OnboardingForm
          email={userContext.user.email}
          fullName={userContext.profile.full_name}
        />
      </div>
    </div>
  );
}