"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  employeeSchema,
  type EmployeeActionState,
  type EmployeeFormValues,
} from "@/lib/validations/employees";
import { z } from "zod";
import { completeInvitation } from "@/lib/actions/invites";


/**
 * Employee (profile) management server actions.
 *
 * Security model:
 *  - The caller must hold the matching employee permission
 *    (employees.create / employees.update / employees.delete).
 *  - `organization_id` is NEVER read from the form — it is scraped from
 *    `getCurrentUserContext()`, so a user can only ever touch employees
 *    inside their own organization.
 *  - Input is re-validated with Zod server-side.
 *
 * Client choice:
 *  - The `profiles` table has no INSERT or DELETE policy (by design — a
 *    profile is created by the signup trigger), so employee creation and
 *    deletion use the service-role client after the permission gate.
 *  - Updates go through the session client, which is scoped to the active
 *    organization by RLS.
 */

function parseFieldErrors(
  issues: z.ZodIssue[]
): EmployeeActionState["fieldErrors"] {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string") {
      (fieldErrors[key] ??= []).push(issue.message);
    }
  }
  return fieldErrors;
}

function getField(formData: FormData, key: keyof EmployeeFormValues): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

type AuthResult =
  | { ok: true; organizationId: string; currentUserId: string }
  | { ok: false; error: EmployeeActionState };

/**
 * Verifies the session and that the caller has the given permission.
 */
async function authorizeEmployee(
  permission: "employees.create" | "employees.update" | "employees.delete"
): Promise<AuthResult> {
  const userContext = await getCurrentUserContext();

  if (!userContext) {
    return {
      ok: false,
      error: { status: "error", error: "You must be signed in to do this." },
    };
  }

  if (!userContext.permissions.includes(permission)) {
    return {
      ok: false,
      error: {
        status: "error",
        error: "You don't have permission to perform this action.",
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

  return {
    ok: true,
    organizationId,
    currentUserId: userContext.user.id,
  };
}

/**
 * Creates a new employee:
 *   1. Create an Auth user (auto-confirmed).
 *   2. Insert the matching profile row (service role — no RLS INSERT policy).
 *   3. Optionally assign an organization role via user_roles.
 */
export async function createEmployee(
  _prevState: EmployeeActionState,
  formData: FormData
): Promise<EmployeeActionState> {
  const auth = await authorizeEmployee("employees.create");

  if (!auth.ok) {
    return auth.error;
  }

  const parsed = employeeSchema.safeParse({
    fullName: getField(formData, "fullName"),
    email: getField(formData, "email"),
    jobTitle: getField(formData, "jobTitle"),
    departmentId: getField(formData, "departmentId"),
    roleId: getField(formData, "roleId"),
    status: getField(formData, "status"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      error: null,
      fieldErrors: parseFieldErrors(parsed.error.issues),
    };
  }

  const email = parsed.data.email.trim().toLowerCase();
  const fullName = parsed.data.fullName.trim();
  const admin = createServiceRoleClient();

  // Check if an employee with this email already belongs to this organization
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id, organization_id, status")
    .eq("email", email)
    .maybeSingle();

  if (
    existingProfile &&
    existingProfile.organization_id === auth.organizationId &&
    existingProfile.status !== "suspended"
  ) {
    return {
      status: "error",
      error: "An employee with this email already exists in your organization.",
    };
  }

  let authUserId: string | null = existingProfile?.id ?? null;

  if (authUserId) {
    // Account already exists in auth/profiles — update metadata to allow initial password registration
    await admin.auth.admin.updateUserById(authUserId, {
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        direct_add: true,
        needs_password_setup: true,
        organization_id: auth.organizationId,
      },
    });
  } else {
    // Create new Auth user with direct_add and needs_password_setup metadata
    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        direct_add: true,
        needs_password_setup: true,
        organization_id: auth.organizationId,
      },
    });

    if (authError) {
      if (
        authError.code === "email_exists" ||
        authError.status === 422 ||
        authError.message?.toLowerCase().includes("already registered") ||
        authError.message?.toLowerCase().includes("already been registered") ||
        authError.message?.toLowerCase().includes("already exists")
      ) {
        const { data: userList } = await admin.auth.admin.listUsers();
        const found = userList?.users?.find(
          (u) => (u.email ?? "").toLowerCase() === email
        );
        if (found) {
          authUserId = found.id;
          await admin.auth.admin.updateUserById(found.id, {
            email_confirm: true,
            user_metadata: {
              ...found.user_metadata,
              full_name: fullName,
              direct_add: true,
              needs_password_setup: true,
              organization_id: auth.organizationId,
            },
          });
        }
      }

      if (!authUserId) {
        console.error("[employees] createEmployee auth creation failed:", authError);
        return {
          status: "error",
          error:
            authError.message ||
            "Could not create the employee account. Please try again.",
        };
      }
    } else if (authUser?.user) {
      authUserId = authUser.user.id;
    }
  }

  if (!authUserId) {
    return {
      status: "error",
      error: "Could not create the employee account. Please try again.",
    };
  }

  // 2. Upsert profile
  const { error: profileError } = await admin
    .from("profiles")
    .upsert(
      {
        id: authUserId,
        organization_id: auth.organizationId,
        full_name: fullName,
        email,
        job_title: parsed.data.jobTitle || null,
        department_id: parsed.data.departmentId || null,
        status: parsed.data.status,
      },
      { onConflict: "id" }
    );

  if (profileError) {
    console.error("[employees] profile upsert error:", profileError);
    return {
      status: "error",
      error: "Could not create the employee profile. Please try again.",
    };
  }

  // 3. Assign role if provided
  if (parsed.data.roleId) {
    const { error: roleError } = await admin.from("user_roles").upsert(
      {
        user_id: authUserId,
        role_id: parsed.data.roleId,
        organization_id: auth.organizationId,
      },
      { onConflict: "user_id,role_id" }
    );

    if (roleError) {
      console.warn("[employees] role assignment warning:", roleError);
    }
  }

  // 4. Mark any pending invitation for this employee in this org as accepted
  await admin
    .from("organization_invitations")
    .update({ status: "accepted" })
    .eq("organization_id", auth.organizationId)
    .eq("email", email)
    .eq("status", "pending");

  revalidatePath("/employees");
  revalidatePath("/dashboard");
  return { status: "success" };
}


export type AccountPendingStatusResult =
  | {
      status: "pending_invite";
      organizationName: string;
      roleName: string;
      token: string;
      suggestedName?: string;
    }
  | {
      status: "needs_password_setup";
      organizationName: string;
      fullName?: string;
    }
  | {
      status: "normal";
    };

/**
 * Checks if an email corresponds to an active pending organization invitation
 * or a directly added account that requires its initial password setup.
 * Used by the login flow to proactively detect invited and setup accounts.
 */
export async function checkAccountPendingStatus(
  email: string
): Promise<AccountPendingStatusResult> {
  const lowerEmail = email.trim().toLowerCase();
  if (!lowerEmail || !lowerEmail.includes("@")) {
    return { status: "normal" };
  }

  const admin = createServiceRoleClient();

  // 1. Check for active pending invitation in organization_invitations
  const { data: invite } = await admin
    .from("organization_invitations")
    .select(`
      id,
      token,
      organization_id,
      role_id,
      contact_id,
      status,
      expires_at,
      organization:organizations!fk_organization_invitations_organization(name),
      role:roles!fk_organization_invitations_role(name)
    `)
    .ilike("email", lowerEmail)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (invite) {
    let suggestedName: string | undefined;
    if (invite.contact_id) {
      const { data: contact } = await admin
        .from("crm_contacts")
        .select("name, first_name, last_name")
        .eq("id", invite.contact_id)
        .maybeSingle();
      if (contact?.name) suggestedName = contact.name.trim();
      else if (contact?.first_name) {
        suggestedName = `${contact.first_name} ${contact.last_name || ""}`.trim();
      }
    }

    const orgRecord = invite.organization as unknown as { name?: string } | { name?: string }[] | null;
    const orgName = Array.isArray(orgRecord) ? orgRecord[0]?.name : orgRecord?.name;
    const roleRecord = invite.role as unknown as { name?: string } | { name?: string }[] | null;
    const roleName = Array.isArray(roleRecord) ? roleRecord[0]?.name : roleRecord?.name;

    return {
      status: "pending_invite",
      organizationName: orgName || "your workspace",
      roleName: roleName || "team member",
      token: invite.token,
      suggestedName,
    };
  }

  // 2. Check for directly added employees in profiles / auth
  const { data: profile } = await admin
    .from("profiles")
    .select(`
      id,
      organization_id,
      full_name,
      status,
      organization:organizations(name)
    `)
    .ilike("email", lowerEmail)
    .maybeSingle();

  if (profile && profile.organization_id && profile.status !== "suspended") {
    let { data: userRes } = await admin.auth.admin.getUserById(profile.id);
    let user = userRes?.user;

    if (!user) {
      const { data: listData } = await admin.auth.admin.listUsers({ perPage: 1000 });
      user =
        listData?.users?.find(
          (u) => (u.email ?? "").toLowerCase() === lowerEmail
        ) ?? null;
    }

    if (user) {
      const needsPasswordSetup =
        user.user_metadata?.needs_password_setup === true ||
        user.user_metadata?.direct_add === true ||
        !user.user_metadata?.password_registered_at;

      if (needsPasswordSetup) {
        const orgRecord = profile.organization as unknown as { name?: string } | { name?: string }[] | null;
        const orgName = Array.isArray(orgRecord) ? orgRecord[0]?.name : orgRecord?.name;
        return {
          status: "needs_password_setup",
          organizationName: orgName || "your workspace",
          fullName: profile.full_name || user.user_metadata?.full_name,
        };
      }
    }
  }

  return { status: "normal" };
}

/**
 * Handles the initial login attempt for directly added or invited employees:
 * 1. If the user has an active pending invitation, completes the invitation using
 *    their chosen password (and name), marks the invite accepted, and links them.
 * 2. If the user was directly added to an organization without a password, registers
 *    their chosen password, confirms email, and clears the setup flag.
 */
export async function handleInitialEmployeeLogin({
  email,
  password,
  fullName,
}: {
  email: string;
  password: string;
  fullName?: string;
}): Promise<
  | { status: "registered" }
  | { status: "invalid_credentials" }
  | { status: "error"; error: string }
> {
  const lowerEmail = email.trim().toLowerCase();
  if (!lowerEmail || !password) {
    return { status: "invalid_credentials" };
  }

  const admin = createServiceRoleClient();

  // 1. Check if the user has an active pending invitation
  const { data: pendingInvite } = await admin
    .from("organization_invitations")
    .select(
      "id, token, organization_id, role_id, department_id, contact_id, status, expires_at"
    )
    .ilike("email", lowerEmail)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pendingInvite) {
    if (password.length < 8) {
      return {
        status: "error",
        error: "Your password must be at least 8 characters to set up your account.",
      };
    }

    let resolvedName = fullName?.trim();
    if (!resolvedName && pendingInvite.contact_id) {
      const { data: contact } = await admin
        .from("crm_contacts")
        .select("name, first_name, last_name")
        .eq("id", pendingInvite.contact_id)
        .maybeSingle();
      if (contact?.name) resolvedName = contact.name.trim();
      else if (contact?.first_name) {
        resolvedName = `${contact.first_name} ${contact.last_name || ""}`.trim();
      }
    }

    if (!resolvedName) {
      const local = lowerEmail.split("@")[0] || "Team Member";
      resolvedName =
        local
          .replace(/[._+-]+/g, " ")
          .split(" ")
          .filter(Boolean)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ") || "Team Member";
    }

    const completeResult = await completeInvitation(
      pendingInvite.token,
      resolvedName,
      password
    );

    if (completeResult.status === "success") {
      return { status: "registered" };
    }

    return {
      status: "error",
      error: completeResult.error || "Could not set up your account credentials.",
    };
  }

  // 2. Check directly added employees with a profile in an active organization

  const { data: profile } = await admin
    .from("profiles")
    .select("id, organization_id, status, full_name")
    .ilike("email", lowerEmail)
    .maybeSingle();

  if (profile && profile.organization_id && profile.status !== "suspended") {
    let { data: userRes } = await admin.auth.admin.getUserById(profile.id);
    let user = userRes?.user;

    if (!user) {
      const { data: listData } = await admin.auth.admin.listUsers({ perPage: 1000 });
      user =
        listData?.users?.find(
          (u) => (u.email ?? "").toLowerCase() === lowerEmail
        ) ?? null;
    }

    if (user) {
      const needsPasswordSetup =
        user.user_metadata?.needs_password_setup === true ||
        user.user_metadata?.direct_add === true ||
        !user.user_metadata?.password_registered_at;

      if (needsPasswordSetup) {
        if (password.length < 8) {
          return {
            status: "error",
            error: "Your password must be at least 8 characters to set up your account.",
          };
        }

        const { error: updateErr } = await admin.auth.admin.updateUserById(user.id, {
          password,
          email_confirm: true,
          user_metadata: {
            ...user.user_metadata,
            full_name: fullName?.trim() || profile.full_name || user.user_metadata?.full_name,
            needs_password_setup: false,
            direct_add: false,
            password_registered_at: new Date().toISOString(),
          },
        });

        if (updateErr) {
          console.error("[employees] handleInitialEmployeeLogin error:", updateErr);
          return {
            status: "error",
            error: updateErr.message || "Could not set up your password. Please try again.",
          };
        }

        // Clean up any lingering pending invitations for this email
        await admin
          .from("organization_invitations")
          .update({ status: "accepted" })
          .ilike("email", lowerEmail)
          .eq("status", "pending");

        return { status: "registered" };
      }
    }
  }

  // 3. Fallback: Check auth.users directly if profile was not found but auth user exists
  const { data: listData } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const authUser = listData?.users?.find(
    (u) => (u.email ?? "").toLowerCase() === lowerEmail
  );

  if (authUser) {
    const needsPasswordSetup =
      authUser.user_metadata?.needs_password_setup === true ||
      authUser.user_metadata?.direct_add === true ||
      !authUser.user_metadata?.password_registered_at;

    if (needsPasswordSetup) {
      if (password.length < 8) {
        return {
          status: "error",
          error: "Your password must be at least 8 characters to set up your account.",
        };
      }

      const { error: updateErr } = await admin.auth.admin.updateUserById(authUser.id, {
        password,
        email_confirm: true,
        user_metadata: {
          ...authUser.user_metadata,
          full_name: fullName?.trim() || authUser.user_metadata?.full_name,
          needs_password_setup: false,
          direct_add: false,
          password_registered_at: new Date().toISOString(),
        },
      });

      if (updateErr) {
        return {
          status: "error",
          error: updateErr.message || "Could not set up your password. Please try again.",
        };
      }

      return { status: "registered" };
    }
  }

  return { status: "invalid_credentials" };
}

/**
 * Updates an existing employee's profile fields and (optionally) their
 * role mapping in user_roles. Uses the session client so RLS scopes every
 * write to the caller's organization.
 */
export async function updateEmployee(
  _prevState: EmployeeActionState,
  formData: FormData
): Promise<EmployeeActionState> {
  const auth = await authorizeEmployee("employees.update");

  if (!auth.ok) {
    return auth.error;
  }

  const employeeId = formData.get("id");

  if (typeof employeeId !== "string" || !employeeId) {
    return { status: "error", error: "Missing employee ID." };
  }

  const parsed = employeeSchema.safeParse({
    fullName: getField(formData, "fullName"),
    email: getField(formData, "email"),
    jobTitle: getField(formData, "jobTitle"),
    departmentId: getField(formData, "departmentId"),
    roleId: getField(formData, "roleId"),
    status: getField(formData, "status"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      error: null,
      fieldErrors: parseFieldErrors(parsed.error.issues),
    };
  }

  const supabase = await createServerClient();

  // Verify the target employee is in this organization before touching them.
  // (RLS would also enforce this, but an explicit check gives a clean error.)
  const { data: existing, error: existingError } = await supabase
    .from("profiles")
    .select("id, organization_id")
    .eq("id", employeeId)
    .single();

  if (existingError || !existing) {
    return {
      status: "error",
      error: "Employee not found, or you don't have access to them.",
    };
  }

  if (existing.organization_id !== auth.organizationId) {
    return {
      status: "error",
      error: "Employee not found, or you don't have access to them.",
    };
  }

  // Update profile fields.
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      email: parsed.data.email,
      job_title: parsed.data.jobTitle || null,
      department_id: parsed.data.departmentId || null,
      status: parsed.data.status,
    })
    .eq("id", employeeId)
    .eq("organization_id", auth.organizationId);

  if (profileError) {
    return {
      status: "error",
      error: "Could not update the employee. Please try again.",
    };
  }

  // Update the role mapping cleanly: remove any current role rows for this
  // employee in this org, then insert the newly chosen one (if any).
  if (parsed.data.roleId) {
    const { error: deleteRoleError } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", employeeId)
      .eq("organization_id", auth.organizationId);

    if (deleteRoleError) {
      return {
        status: "error",
        error: "Employee updated, but their previous role could not be removed.",
      };
    }

    const { error: insertRoleError } = await supabase.from("user_roles").insert({
      user_id: employeeId,
      role_id: parsed.data.roleId,
      organization_id: auth.organizationId,
    });

    if (insertRoleError) {
      return {
        status: "error",
        error: "Employee updated, but their role could not be assigned.",
      };
    }
  } else {
    // No role chosen — clear any existing role in this org.
    const { error: deleteRoleError } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", employeeId)
      .eq("organization_id", auth.organizationId);

    if (deleteRoleError) {
      return {
        status: "error",
        error: "Employee updated, but their role could not be removed.",
      };
    }
  }

  revalidatePath("/employees");
  return { status: "success" };
}

/**
 * Deletes an employee: removes the Auth user (service role), which cascades
 * to their profile via the FK constraint. Guarded by employees.delete.
 */
export async function deleteEmployee(
  _prevState: EmployeeActionState,
  formData: FormData
): Promise<EmployeeActionState> {
  const auth = await authorizeEmployee("employees.delete");

  if (!auth.ok) {
    return auth.error;
  }

  const employeeId = formData.get("id");

  if (typeof employeeId !== "string" || !employeeId) {
    return { status: "error", error: "Missing employee ID." };
  }

  // Never allow deleting yourself.
  if (employeeId === auth.currentUserId) {
    return {
      status: "error",
      error: "You cannot delete your own account.",
    };
  }

  const supabase = await createServerClient();

  // Prove this employee belongs to the caller's organization first.
  const { data: existing, error: existingError } = await supabase
    .from("profiles")
    .select("id, organization_id")
    .eq("id", employeeId)
    .single();

  if (existingError || !existing) {
    return {
      status: "error",
      error: "Employee not found, or you don't have access to them.",
    };
  }

  if (existing.organization_id !== auth.organizationId) {
    return {
      status: "error",
      error: "Employee not found, or you don't have access to them.",
    };
  }

  const admin = createServiceRoleClient();

  // 1. Unlink, reassign, and clean up dependent records to avoid foreign key
  //    violations or orphaned resources when deleting the employee.
  await Promise.allSettled([
    admin.from("user_roles").delete().eq("user_id", employeeId),
    admin.from("chat_channel_members").delete().eq("user_id", employeeId),
    admin.from("ai_prompts").update({ created_by: auth.currentUserId }).eq("created_by", employeeId),
    admin.from("ai_executions").update({ executed_by: auth.currentUserId }).eq("executed_by", employeeId),
    admin.from("automations").update({ created_by: auth.currentUserId }).eq("created_by", employeeId),
    admin.from("marketing_campaigns").update({ created_by: auth.currentUserId }).eq("created_by", employeeId),
    admin.from("marketing_social_posts").update({ created_by: auth.currentUserId }).eq("created_by", employeeId),
    admin.from("marketing_email_templates").update({ created_by: auth.currentUserId }).eq("created_by", employeeId),
    admin.from("tasks").update({ assigned_to: null }).eq("assigned_to", employeeId),
    admin.from("tasks").update({ created_by: auth.currentUserId }).eq("created_by", employeeId),
    admin.from("crm_deals").update({ assigned_to: null }).eq("assigned_to", employeeId),
    admin.from("crm_deals").update({ created_by: auth.currentUserId }).eq("created_by", employeeId),
    admin.from("invoices").update({ created_by: auth.currentUserId }).eq("created_by", employeeId),
    admin.from("calendar_events").update({ assigned_user_id: null }).eq("assigned_user_id", employeeId),
    admin.from("calendar_appointments").update({ host_user_id: auth.currentUserId }).eq("host_user_id", employeeId),
    admin.from("phone_numbers").update({ assigned_user_id: null }).eq("assigned_user_id", employeeId),
    admin.from("telecom_calls").update({ agent_id: null }).eq("agent_id", employeeId),
    admin.from("organization_invitations").update({ invited_by: auth.currentUserId }).eq("invited_by", employeeId),
    admin.from("workspace_docs").update({ created_by: auth.currentUserId }).eq("created_by", employeeId),
    admin.from("workspace_whiteboards").update({ created_by: auth.currentUserId }).eq("created_by", employeeId),
    admin.from("crm_contacts").update({ created_by: auth.currentUserId }).eq("created_by", employeeId),
    admin.from("time_entries").delete().eq("user_id", employeeId),
  ]);

  // 2. Explicitly delete the profile row to ensure it is completely removed
  //    from the organization even if auth user deletion fails or is orphaned.
  const { error: profileDeleteError } = await admin
    .from("profiles")
    .delete()
    .eq("id", employeeId)
    .eq("organization_id", auth.organizationId);

  if (profileDeleteError) {
    console.error("[employees] profile deletion error:", profileDeleteError);
    return {
      status: "error",
      error: "Could not delete the employee. Please try again.",
    };
  }

  // 3. Remove the Auth user (ignore "User not found" if they were not registered in auth.users)
  const { error: authError } = await admin.auth.admin.deleteUser(employeeId);
  if (authError && !authError.message?.toLowerCase().includes("not found")) {
    console.warn("[employees] auth deleteUser warning:", authError.message);
  }

  revalidatePath("/employees");
  return { status: "success" };
}