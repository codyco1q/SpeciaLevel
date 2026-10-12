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

  const admin = createServiceRoleClient();

  // 1. Create the Auth user. `email_confirm: true` means they can sign in
  //    once they set a password (or via a later invite flow).
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName },
  });

  if (authError) {
    if (authError.message?.toLowerCase().includes("already registered")) {
      return {
        status: "error",
        error: "An account with this email already exists.",
      };
    }
    return {
      status: "error",
      error: "Could not create the employee account. Please try again.",
    };
  }

  if (!authUser.user) {
    return {
      status: "error",
      error: "Could not create the employee account. Please try again.",
    };
  }

  // 2. Create / update the profile. Since the `on_auth_user_created` trigger
  //    on auth.users automatically inserts a bare profile row with null organization_id,
  //    we must upsert onConflict: "id" so the employee profile is reliably populated.
  const { error: profileError } = await admin
    .from("profiles")
    .upsert(
      {
        id: authUser.user.id,
        organization_id: auth.organizationId,
        full_name: parsed.data.fullName,
        email: parsed.data.email,
        job_title: parsed.data.jobTitle || null,
        department_id: parsed.data.departmentId || null,
        status: parsed.data.status,
      },
      { onConflict: "id" }
    );

  if (profileError) {
    console.error("[employees] profile upsert error:", profileError);
    // Roll back the auth user so we don't leave a dangling account.
    await admin.auth.admin.deleteUser(authUser.user.id);
    return {
      status: "error",
      error: "Could not create the employee profile. Please try again.",
    };
  }

  // 3. Assign the role, if one was chosen.
  if (parsed.data.roleId) {
    const { error: roleError } = await admin.from("user_roles").insert({
      user_id: authUser.user.id,
      role_id: parsed.data.roleId,
      organization_id: auth.organizationId,
    });

    if (roleError) {
      // Non-fatal: the employee exists, just without a role. Surface a hint.
      return {
        status: "error",
        error:
          "The employee was created, but their role could not be assigned. Please edit them to assign a role.",
      };
    }
  }

  revalidatePath("/employees");
  return { status: "success" };
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