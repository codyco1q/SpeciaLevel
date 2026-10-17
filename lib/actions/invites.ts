"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import {
  createInvitationSchema,
  type AcceptInvitationResult,
  type InvitationLookupResult,
  type InviteActionState,
} from "@/lib/validations/invites";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { sendInvitationEmailViaBrevo } from "@/lib/services/brevo";

function parseFieldErrors(
  issues: z.ZodIssue[]
): InviteActionState["fieldErrors"] {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string") {
      (fieldErrors[key] ??= []).push(issue.message);
    }
  }
  return fieldErrors;
}

/**
 * Cryptographically-random token used in /signup?invite=[token] links.
 * Matches the downloadToken approach used by onboarding.
 */
function generateInviteToken(length = 32): string {
  const alphabet =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function getCanonicalSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "");
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`.replace(/\/+$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`.replace(/\/+$/, "");
  }
  return "http://localhost:3000";
}

/**
 * Dispatches an automated invitation notification.
 * Primary delivery is routed through Brevo's transactional email REST API.
 * The invite link directs the recipient directly to the organization-scoped
 * acceptance page (/accept-invite?token=<token>) where they confirm details
 * and set their password.
 */
async function dispatchInvitationEmail({
  email,
  token,
  organizationId,
  roleName,
  orgName,
  inviterName,
  inviterEmail,
}: {
  email: string;
  token: string;
  organizationId: string;
  roleName?: string;
  orgName?: string;
  inviterName?: string;
  inviterEmail?: string;
}) {
  const siteUrl = getCanonicalSiteUrl();
  const inviteRedirectUrl = `${siteUrl}/accept-invite?token=${token}`;

  // 1. Outbound transactional email delivery via Brevo REST API
  try {
    await sendInvitationEmailViaBrevo({
      recipientEmail: email,
      inviteUrl: inviteRedirectUrl,
      organizationName: orgName,
      roleName,
      inviterName,
      inviterEmail,
    });
  } catch (brevoErr) {
    console.error("[invites] Brevo invitation email dispatch error:", brevoErr);
  }

  // 2. Outbound webhook notification for external email deliverability / integrations
  const webhookUrl = process.env.ORGANIZATION_WEBHOOK_URL || process.env.MARKETING_LEADS_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      void fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "employee.invitation_sent",
          recipient_email: email,
          organization_id: organizationId,
          organization_name: orgName,
          role_name: roleName,
          inviter_name: inviterName,
          invite_link: inviteRedirectUrl,
          token,
          timestamp: new Date().toISOString(),
        }),
      }).catch((webhookErr) => {
        console.warn("[invites] Webhook email notification error:", webhookErr);
      });
    } catch {
      // non-blocking
    }
  }
}

async function requireInviteManage(): Promise<
  | {
      ok: true;
      organizationId: string;
      userId: string;
      orgName?: string;
      inviterName?: string;
      inviterEmail?: string;
    }
  | { ok: false; error: InviteActionState }
> {
  const userContext = await getCurrentUserContext();
  const dict = await getDictionary();
  const err = dict.platform.settings.errors;

  if (!userContext) {
    return {
      ok: false,
      error: { status: "error", error: err.signedIn },
    };
  }

  const isOwnerOrAdmin = userContext.roles.some(
    (role) => role.key === "owner" || role.key === "admin"
  );
  const canManage =
    isOwnerOrAdmin ||
    hasPermission("settings.manage", userContext.permissions) ||
    hasPermission("employees.manage", userContext.permissions) ||
    hasPermission("employees.create", userContext.permissions) ||
    hasPermission("users.invite", userContext.permissions);

  if (!canManage) {
    return {
      ok: false,
      error: {
        status: "error",
        error: err.noPermissionInvites,
      },
    };
  }

  const organizationId = userContext.organization?.id;
  if (!organizationId) {
    return {
      ok: false,
      error: {
        status: "error",
        error: err.noOrg,
      },
    };
  }

  return {
    ok: true,
    organizationId,
    userId: userContext.user.id,
    orgName: userContext.organization?.name,
    inviterName: userContext.profile?.full_name || undefined,
    inviterEmail: userContext.profile?.email || userContext.user?.email || undefined,
  };
}
/**
 * Create a member invitation for the current organization.
 *
 * Enforces tenant-scoping on the payload:
 *  - the role must belong to the current org
 *  - the (optional) department must belong to the current org
 *  - no duplicate pending invite for the same email
 *  - the invited email must not already be an org member
 *
 * Requires the `settings.manage` permission.
 */
export async function createInvitation(data: {
  email: string;
  role_id: string;
  department_id?: string;
  contact_id?: string;
}): Promise<InviteActionState> {
  const auth = await requireInviteManage();
  if (!auth.ok) return auth.error;

  const dict = await getDictionary();
  const err = dict.platform.settings.errors;

  const parsed = createInvitationSchema(err).safeParse(data);
  if (!parsed.success) {
    return {
      status: "error",
      error: null,
      fieldErrors: parseFieldErrors(parsed.error.issues),
    };
  }

  const email = parsed.data.email.toLowerCase();
  const { role_id } = parsed.data;
  const department_id =
    parsed.data.department_id && parsed.data.department_id !== "none"
      ? parsed.data.department_id
      : undefined;
  // Client-role invites may pre-link a CRM contact; "none" mirrors the
  // department sentinel used by the Radix Select.
  const contact_id =
    parsed.data.contact_id && parsed.data.contact_id !== "none"
      ? parsed.data.contact_id
      : undefined;

  const supabase = await createServerClient();

  // The role must belong to the current organization.
  const { data: role } = await supabase
    .from("roles")
    .select("id, name")
    .eq("id", role_id)
    .eq("organization_id", auth.organizationId)
    .maybeSingle();

  if (!role) {
    return {
      status: "error",
      error: err.roleNotFound,
    };
  }

  // The optional department must belong to the current organization.
  if (department_id) {
    const { data: department } = await supabase
      .from("departments")
      .select("id")
      .eq("id", department_id)
      .eq("organization_id", auth.organizationId)
      .maybeSingle();

    if (!department) {
      return {
        status: "error",
        error: err.departmentNotFound,
      };
    }
  }

  // The optional client contact must belong to the current organization.
  if (contact_id) {
    const { data: contact } = await supabase
      .from("crm_contacts")
      .select("id")
      .eq("id", contact_id)
      .eq("organization_id", auth.organizationId)
      .maybeSingle();

    if (!contact) {
      return {
        status: "error",
        error: err.contactNotFound,
      };
    }
  }

  // Reject a duplicate pending invite for the same email in this org.
  const { data: duplicate } = await supabase
    .from("organization_invitations")
    .select("id")
    .eq("organization_id", auth.organizationId)
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle();

  if (duplicate) {
    return {
      status: "error",
      error: err.invitePending,
    };
  }

  // Reject inviting someone who is already a member.
  const { data: existingMember } = await supabase
    .from("profiles")
    .select("id")
    .eq("organization_id", auth.organizationId)
    .eq("email", email)
    .maybeSingle();

  if (existingMember) {
    return {
      status: "error",
      error: err.alreadyMember,
    };
  }

  const token = generateInviteToken();

  const { error: insertError } = await supabase
    .from("organization_invitations")
    .insert({
      organization_id: auth.organizationId,
      email,
      role_id,
      department_id: department_id || null,
      contact_id: contact_id || null,
      invited_by: auth.userId,
      token,
      status: "pending",
      // expires_at defaults to now() + 7 days in the database.
    });

  if (insertError) {
    return {
      status: "error",
      error: err.inviteCreateFailed,
    };
  }

  const siteUrl = getCanonicalSiteUrl();
  const inviteUrl = `${siteUrl}/accept-invite?token=${token}`;

  // Deliver the invitation email using Brevo and outbound webhook setup.
  await dispatchInvitationEmail({
    email,
    token,
    organizationId: auth.organizationId,
    roleName: role.name,
    orgName: auth.orgName,
    inviterName: auth.inviterName,
    inviterEmail: auth.inviterEmail,
  });

  revalidatePath("/employees");
  revalidatePath("/settings");
  return { status: "success", inviteUrl, token };
}

/**
 * Resend / renew a pending invitation in the current organization.
 * Extends the expiration date by 7 days and resets status to pending.
 */
export async function resendInvitation(
  invitationId: string
): Promise<InviteActionState> {
  const auth = await requireInviteManage();
  if (!auth.ok) return auth.error;

  const dict = await getDictionary();
  const err = dict.platform.settings.errors;

  const admin = createServiceRoleClient();
  
  // 1. Fetch invite to get the token, email, role, organization, and inviter
  const { data: invite, error: fetchError } = await admin
    .from("organization_invitations")
    .select(`
      id,
      email,
      token,
      role:roles!fk_organization_invitations_role(name),
      organization:organizations!fk_organization_invitations_organization(name),
      invited_by_profile:profiles!fk_organization_invitations_invited_by(full_name, email)
    `)
    .eq("id", invitationId)
    .eq("organization_id", auth.organizationId)
    .single();
    
  if (fetchError || !invite) {
    return { status: "error", error: "Invitation not found." };
  }

  // 2. Extend expiration by 7 days and reset status to pending
  const newExpiration = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  // Ensure invitation has a valid token
  const token = invite.token || generateInviteToken();

  const { error: updateError } = await admin
    .from("organization_invitations")
    .update({
      token,
      expires_at: newExpiration,
      status: "pending",
    })
    .eq("id", invitationId)
    .eq("organization_id", auth.organizationId);

  if (updateError) {
    return {
      status: "error",
      error: err.inviteCreateFailed || "Could not resend invitation.",
    };
  }

  // 3. Deliver the renewed invitation email using Brevo
  const roleRecord = invite.role as unknown as { name?: string } | { name?: string }[] | null;
  const roleName = Array.isArray(roleRecord) ? roleRecord[0]?.name : roleRecord?.name;
  const orgRecord = invite.organization as unknown as { name?: string } | { name?: string }[] | null;
  const orgName = Array.isArray(orgRecord) ? orgRecord[0]?.name : orgRecord?.name;
  const inviterProfile = invite.invited_by_profile as unknown as
    | { full_name?: string; email?: string }
    | { full_name?: string; email?: string }[]
    | null;
  const inviterRecord = Array.isArray(inviterProfile) ? inviterProfile[0] : inviterProfile;
  const inviterName = inviterRecord?.full_name || auth.inviterName;
  const inviterEmail = inviterRecord?.email || auth.inviterEmail;

  const siteUrl = getCanonicalSiteUrl();
  const inviteUrl = `${siteUrl}/accept-invite?token=${token}`;

  await dispatchInvitationEmail({
    email: invite.email,
    token,
    organizationId: auth.organizationId,
    roleName,
    orgName: orgName || auth.orgName,
    inviterName,
    inviterEmail,
  });

  revalidatePath("/employees");
  revalidatePath("/settings");
  return { status: "success", inviteUrl, token };
}

/**
 * Revoke a pending invitation in the current organization.
 * Requires member management permission.
 */
export async function revokeInvitation(
  invitationId: string
): Promise<InviteActionState> {
  const auth = await requireInviteManage();
  if (!auth.ok) return auth.error;

  const dict = await getDictionary();
  const err = dict.platform.settings.errors;

  const supabase = await createServerClient();

  const { data: invitation, error: fetchError } = await supabase
    .from("organization_invitations")
    .select("id, status, organization_id")
    .eq("id", invitationId)
    .single();

  if (fetchError || !invitation) {
    return {
      status: "error",
      error: err.inviteNotFound,
    };
  }

  if (invitation.organization_id !== auth.organizationId) {
    return {
      status: "error",
      error: err.inviteNotFound,
    };
  }

  if (invitation.status === "accepted") {
    return {
      status: "error",
      error: err.inviteAlreadyAccepted,
    };
  }

  if (invitation.status === "revoked") {
    return { status: "success" };
  }

  const { error: updateError } = await supabase
    .from("organization_invitations")
    .update({ status: "revoked" })
    .eq("id", invitationId)
    .eq("organization_id", auth.organizationId);

  if (updateError) {
    return {
      status: "error",
      error: err.inviteRevokeFailed,
    };
  }

  revalidatePath("/employees");
  revalidatePath("/settings");
  return { status: "success" };
}

// ---------------------------------------------------------------------------
// Public invite acceptance — /signup?invite=<token>
// ---------------------------------------------------------------------------

/**
 * PostgREST returns a to-one join as an object (or null) and a to-many join
 * as an array; normalize both to a nullable field value.
 */
function pickJoinedValue(value: unknown, key: string): string | null {
  if (!value) return null;
  const row = Array.isArray(value) ? value[0] : value;
  if (row && typeof row === "object" && key in row) {
    const field = (row as Record<string, unknown>)[key];
    return typeof field === "string" ? field : null;
  }
  return null;
}

/**
 * Resolve a public invite token for the signup page. Called BEFORE the
 * invited user has an account, so it reads through the service-role client —
 * RLS forbids anon/authenticated reads of invitation tokens to everyone who
 * is not already a member of the inviting organization.
 */
export async function getInvitationByToken(
  token: string
): Promise<InvitationLookupResult> {
  if (!token || token.length > 512) {
    return { status: "not_found" };
  }

  const admin = createServiceRoleClient();

  const { data, error } = await admin
    .from("organization_invitations")
    .select(
      `id, email, organization_id, role_id, department_id, status, expires_at,
       organization:organizations!fk_organization_invitations_organization(name),
       role:roles!fk_organization_invitations_role(name),
       department:departments!fk_organization_invitations_department(name)`
    )
    .eq("token", token)
    .maybeSingle();

  if (error || !data) {
    return { status: "not_found" };
  }

  if (data.status === "accepted") return { status: "accepted" };
  if (data.status === "revoked") return { status: "revoked" };
  if (data.status === "expired") return { status: "expired" };
  if (new Date(data.expires_at).getTime() <= Date.now()) {
    return { status: "expired" };
  }

  // Only a `pending` invitation that has not yet expired reaches this point.
  return {
    status: "valid",
    invitation: {
      token,
      email: data.email,
      organizationName:
        pickJoinedValue(data.organization, "name") ?? "your organization",
      roleName: pickJoinedValue(data.role, "name") ?? "team member",
      departmentName: pickJoinedValue(data.department, "name"),
      expiresAt: data.expires_at,
    },
  };
}

/**
 * Finalize an invited sign-up: link the signed-in user's profile to the
 * inviting organization, assign the pre-configured role, and mark the
 * invitation accepted.
 *
 * The user's identity comes from the cookie session (never client input) and
 * the invite is only honored for the exact email it was sent to. Writes use
 * the service-role client so they succeed for a brand-new member who holds no
 * RLS privileges yet, mirroring the onboarding action.
 */
export async function acceptInvitation(
  token: string,
  fullName?: string
): Promise<AcceptInvitationResult> {
  const userClient = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();

  if (authError || !user) {
    return {
      status: "error",
      error: "You must be signed in to accept an invitation.",
    };
  }

  const admin = createServiceRoleClient();

  const { data: invitation, error: fetchError } = await admin
    .from("organization_invitations")
    .select(
      "id, email, organization_id, role_id, department_id, contact_id, status, expires_at"
    )
    .eq("token", token)
    .maybeSingle();

  if (fetchError || !invitation) {
    return {
      status: "error",
      error: "This invitation link is invalid or has expired.",
    };
  }

  if (invitation.status === "accepted") {
    return {
      status: "error",
      error: "This invitation has already been accepted.",
    };
  }

  if (invitation.status !== "pending") {
    return {
      status: "error",
      error: "This invitation link is invalid or has expired.",
    };
  }

  if (new Date(invitation.expires_at).getTime() <= Date.now()) {
    return {
      status: "error",
      error: "This invitation link has expired.",
    };
  }

  // Security: only the invited email may accept this invite.
  if ((user.email ?? "").toLowerCase() !== invitation.email.toLowerCase()) {
    return {
      status: "error",
      error: "This invitation was sent to a different email address.",
    };
  }

  // 1. Link the signup-trigger-created profile to the inviting org, the
  //    pre-assigned department, and the optional client contact (a deleted
  //    department/contact nulls the FK first).
  const profileUpdate: {
    organization_id: string;
    department_id: string | null;
    contact_id: string | null;
    full_name?: string;
  } = {
    organization_id: invitation.organization_id,
    department_id: invitation.department_id,
    contact_id: invitation.contact_id,
  };
  if (fullName?.trim()) {
    profileUpdate.full_name = fullName.trim();
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update(profileUpdate)
    .eq("id", user.id);

  if (profileError) {
    return {
      status: "error",
      error: "Could not add you to the organization. Please try again.",
    };
  }

  // 2. Assign the pre-configured role. Upsert keeps a double-submit or retry
  //    from tripping the unique (user_id, role_id) constraint.
  const { error: roleError } = await admin
    .from("user_roles")
    .upsert(
      {
        user_id: user.id,
        role_id: invitation.role_id,
        organization_id: invitation.organization_id,
      },
      { onConflict: "user_id,role_id" }
    );

  if (roleError) {
    return {
      status: "error",
      error: "Your invitation could not be fully processed. Please try again.",
    };
  }

  // 3. Mark the invitation as accepted (guarded to the still-pending row).
  const { error: acceptError } = await admin
    .from("organization_invitations")
    .update({ status: "accepted" })
    .eq("id", invitation.id)
    .eq("status", "pending");

  if (acceptError) {
    return {
      status: "error",
      error: "Your invitation could not be fully processed. Please try again.",
    };
  }

  // Bust cached layout data so /dashboard renders the member's new org,
  // role, and permissions on the very next request.
  revalidatePath("/dashboard", "layout");
  revalidatePath("/", "layout");

  return { status: "success" };
}

/**
 * Public invitation acceptance:
 * Verifies the invitation token, sets up the Auth user with their chosen password,
 * marks email as confirmed, connects their profile to the organization with their
 * assigned role, and marks the invitation accepted.
 */
export async function completeInvitation(
  token: string,
  fullName: string,
  password: string
): Promise<AcceptInvitationResult> {
  if (!token || token.length > 512) {
    return {
      status: "error",
      error: "This invitation link is invalid or has expired.",
    };
  }

  const trimmedName = fullName?.trim();
  if (!trimmedName) {
    return {
      status: "error",
      error: "Full name is required.",
    };
  }

  if (!password || password.length < 8) {
    return {
      status: "error",
      error: "Password must be at least 8 characters.",
    };
  }

  const admin = createServiceRoleClient();

  const { data: invitation, error: fetchError } = await admin
    .from("organization_invitations")
    .select(
      "id, email, organization_id, role_id, department_id, contact_id, status, expires_at"
    )
    .eq("token", token)
    .maybeSingle();

  if (fetchError || !invitation) {
    return {
      status: "error",
      error: "This invitation link is invalid or has expired.",
    };
  }

  if (invitation.status === "accepted") {
    return {
      status: "error",
      error: "This invitation has already been accepted.",
    };
  }

  if (invitation.status !== "pending") {
    return {
      status: "error",
      error: "This invitation link is invalid or has expired.",
    };
  }

  if (new Date(invitation.expires_at).getTime() <= Date.now()) {
    return {
      status: "error",
      error: "This invitation link has expired.",
    };
  }

  const email = invitation.email.toLowerCase();

  // Find or create the Auth user
  let authUserId: string | null = null;
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingProfile) {
    authUserId = existingProfile.id;
    const { error: updateErr } = await admin.auth.admin.updateUserById(existingProfile.id, {
      password,
      email_confirm: true,
      user_metadata: {
        full_name: trimmedName,
        needs_password_setup: false,
        organization_id: invitation.organization_id,
      },
    });
    if (updateErr) {
      console.error("[invites] Error updating auth user in completeInvitation:", updateErr);
      return {
        status: "error",
        error: updateErr.message || "Could not set up account credentials.",
      };
    }
  } else {
    const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: trimmedName,
        needs_password_setup: false,
        organization_id: invitation.organization_id,
      },
    });

    if (createErr) {
      if (
        createErr.code === "email_exists" ||
        createErr.status === 422 ||
        createErr.message?.toLowerCase().includes("already registered") ||
        createErr.message?.toLowerCase().includes("already been registered") ||
        createErr.message?.toLowerCase().includes("already exists")
      ) {
        const { data: userList } = await admin.auth.admin.listUsers({ perPage: 1000 });
        const found = userList?.users?.find(
          (u) => (u.email ?? "").toLowerCase() === email
        );
        if (found) {
          authUserId = found.id;
          await admin.auth.admin.updateUserById(found.id, {
            password,
            email_confirm: true,
            user_metadata: {
              ...found.user_metadata,
              full_name: trimmedName,
              needs_password_setup: false,
              organization_id: invitation.organization_id,
            },
          });
        }
      }

      if (!authUserId) {
        console.error("[invites] createUser error in completeInvitation:", createErr);
        return {
          status: "error",
          error: createErr.message || "Could not create user account.",
        };
      }
    } else if (newUser?.user) {
      authUserId = newUser.user.id;
    }
  }

  if (!authUserId) {
    return {
      status: "error",
      error: "Could not process user account.",
    };
  }

  // 1. Link / update profile
  const { error: profileError } = await admin
    .from("profiles")
    .upsert(
      {
        id: authUserId,
        organization_id: invitation.organization_id,
        department_id: invitation.department_id,
        contact_id: invitation.contact_id,
        full_name: trimmedName,
        email,
        status: "active",
      },
      { onConflict: "id" }
    );

  if (profileError) {
    console.error("[invites] completeInvitation profile upsert error:", profileError);
    return {
      status: "error",
      error: "Could not link account to organization.",
    };
  }

  // 2. Assign role
  const { error: roleError } = await admin
    .from("user_roles")
    .upsert(
      {
        user_id: authUserId,
        role_id: invitation.role_id,
        organization_id: invitation.organization_id,
      },
      { onConflict: "user_id,role_id" }
    );

  if (roleError) {
    console.error("[invites] completeInvitation role assign error:", roleError);
    return {
      status: "error",
      error: "Could not assign role permissions.",
    };
  }

  // 3. Mark invitation accepted
  await admin
    .from("organization_invitations")
    .update({ status: "accepted" })
    .eq("id", invitation.id)
    .eq("status", "pending");

  revalidatePath("/dashboard", "layout");
  revalidatePath("/employees");
  revalidatePath("/", "layout");

  return { status: "success" };
}