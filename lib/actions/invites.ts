"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import {
  invitationSchema,
  type AcceptInvitationResult,
  type InvitationLookupResult,
  type InviteActionState,
} from "@/lib/validations/invites";

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

async function requireInviteManage(): Promise<
  | { ok: true; organizationId: string; userId: string }
  | { ok: false; error: InviteActionState }
> {
  const userContext = await getCurrentUserContext();
  if (!userContext) {
    return {
      ok: false,
      error: { status: "error", error: "You must be signed in to do this." },
    };
  }

  if (!hasPermission("settings.manage", userContext.permissions)) {
    return {
      ok: false,
      error: {
        status: "error",
        error: "You don't have permission to manage invitations.",
      },
    };
  }

  const organizationId = userContext.organization?.id;
  if (!organizationId) {
    return {
      ok: false,
      error: {
        status: "error",
        error: "No organization found for your account.",
      },
    };
  }

  return { ok: true, organizationId, userId: userContext.user.id };
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
}): Promise<InviteActionState> {
  const auth = await requireInviteManage();
  if (!auth.ok) return auth.error;

  const parsed = invitationSchema.safeParse(data);
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

  const supabase = await createServerClient();

  // The role must belong to the current organization.
  const { data: role } = await supabase
    .from("roles")
    .select("id")
    .eq("id", role_id)
    .eq("organization_id", auth.organizationId)
    .maybeSingle();

  if (!role) {
    return {
      status: "error",
      error: "Role not found, or you don't have access to it.",
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
        error: "Department not found, or you don't have access to it.",
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
      error: "An invitation for this email is already pending.",
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
      error: "This person is already a member of your organization.",
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
      invited_by: auth.userId,
      token,
      status: "pending",
      // expires_at defaults to now() + 7 days in the database.
    });

  if (insertError) {
    return {
      status: "error",
      error: "Could not create the invitation. Please try again.",
    };
  }

  revalidatePath("/settings");
  return { status: "success" };
}

/**
 * Revoke a pending invitation in the current organization.
 * Requires the `settings.manage` permission.
 */
export async function revokeInvitation(
  invitationId: string
): Promise<InviteActionState> {
  const auth = await requireInviteManage();
  if (!auth.ok) return auth.error;

  const supabase = await createServerClient();

  const { data: invitation, error: fetchError } = await supabase
    .from("organization_invitations")
    .select("id, status, organization_id")
    .eq("id", invitationId)
    .single();

  if (fetchError || !invitation) {
    return {
      status: "error",
      error: "Invitation not found, or you don't have access to it.",
    };
  }

  if (invitation.organization_id !== auth.organizationId) {
    return {
      status: "error",
      error: "Invitation not found, or you don't have access to it.",
    };
  }

  if (invitation.status === "accepted") {
    return {
      status: "error",
      error: "This invitation has already been accepted.",
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
      error: "Could not revoke the invitation. Please try again.",
    };
  }

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
      "id, email, organization_id, role_id, department_id, status, expires_at"
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

  // 1. Link the signup-trigger-created profile to the inviting org and the
  //    pre-assigned department (a deleted department nulls the FK first).
  const profileUpdate: {
    organization_id: string;
    department_id: string | null;
    full_name?: string;
  } = {
    organization_id: invitation.organization_id,
    department_id: invitation.department_id,
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