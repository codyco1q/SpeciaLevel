"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import {
  invitationSchema,
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