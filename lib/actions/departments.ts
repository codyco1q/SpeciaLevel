"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import {
  departmentSchema,
  type DepartmentActionState,
  type DepartmentFormValues,
} from "@/lib/validations/departments";
import { z } from "zod";

/**
 * Department management server actions.
 *
 * Security model:
 *  - The caller must hold the `departments.manage` permission (from the
 *    server-side session context).
 *  - `organization_id` is NEVER read from the form — it is scraped from
 *    `getCurrentUserContext()`, so a user can only ever touch departments
 *    inside their own organization.
 *  - Input is re-validated with Zod server-side.
 */

function parseFieldErrors(
  issues: z.ZodIssue[]
): DepartmentActionState["fieldErrors"] {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string") {
      (fieldErrors[key] ??= []).push(issue.message);
    }
  }
  return fieldErrors;
}

function getField(
  formData: FormData,
  key: keyof DepartmentFormValues
): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/**
 * Shared permission + org-scope gate. Returns the session-scoped
 * organization ID on success, or a null-marker object for the error path.
 */
async function authorizeDepartmentManage(): Promise<
  | { ok: true; organizationId: string }
  | { ok: false; error: DepartmentActionState }
> {
  const userContext = await getCurrentUserContext();

  if (!userContext) {
    return { ok: false, error: { status: "error", error: "You must be signed in to do this." } };
  }

  if (!userContext.permissions.includes("departments.manage")) {
    return {
      ok: false,
      error: {
        status: "error",
        error: "You don't have permission to manage departments.",
      },
    };
  }

  const organizationId = userContext.organization?.id;

  if (!organizationId) {
    return {
      ok: false,
      error: { status: "error", error: "No organization found for your account." },
    };
  }

  return { ok: true, organizationId };
}

/** Create a department in the caller's organization. */
export async function createDepartment(
  _prevState: DepartmentActionState,
  formData: FormData
): Promise<DepartmentActionState> {
  const auth = await authorizeDepartmentManage();

  if (!auth.ok) {
    return auth.error;
  }

  const parsed = departmentSchema.safeParse({
    name: getField(formData, "name"),
    description: getField(formData, "description"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      error: null,
      fieldErrors: parseFieldErrors(parsed.error.issues),
    };
  }

  const supabase = await createServerClient();

  const { error } = await supabase
    .from("departments")
    .insert({
      organization_id: auth.organizationId,
      name: parsed.data.name,
      description: parsed.data.description || null,
    });

  if (error) {
    // Unique constraint: (organization_id, name)
    if (error.code === "23505") {
      return {
        status: "error",
        fieldErrors: { name: ["A department with this name already exists."] },
      };
    }
    return {
      status: "error",
      error: "Could not create the department. Please try again.",
    };
  }

  revalidatePath("/departments");
  return { status: "success" };
}

/** Update an existing department in the caller's organization. */
export async function updateDepartment(
  _prevState: DepartmentActionState,
  formData: FormData
): Promise<DepartmentActionState> {
  const auth = await authorizeDepartmentManage();

  if (!auth.ok) {
    return auth.error;
  }

  const departmentId = formData.get("id");

  if (typeof departmentId !== "string" || !departmentId) {
    return { status: "error", error: "Missing department ID." };
  }

  const parsed = departmentSchema.safeParse({
    name: getField(formData, "name"),
    description: getField(formData, "description"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      error: null,
      fieldErrors: parseFieldErrors(parsed.error.issues),
    };
  }

  const supabase = await createServerClient();

  // RLS + the org scope keeps this scoped to the caller's organization.
  const { error } = await supabase
    .from("departments")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
    })
    .eq("id", departmentId)
    .eq("organization_id", auth.organizationId);

  if (error) {
    if (error.code === "23505") {
      return {
        status: "error",
        fieldErrors: { name: ["A department with this name already exists."] },
      };
    }
    return {
      status: "error",
      error: "Could not update the department. Please try again.",
    };
  }

  revalidatePath("/departments");
  return { status: "success" };
}

/**
 * Delete a department.
 * Employees currently assigned to the department are checked first — if any
 * exist, the deletion is rejected with a message asking the caller to
 * reassign them first.
 */
export async function deleteDepartment(
  _prevState: DepartmentActionState,
  formData: FormData
): Promise<DepartmentActionState> {
  const auth = await authorizeDepartmentManage();

  if (!auth.ok) {
    return auth.error;
  }

  const departmentId = formData.get("id");

  if (typeof departmentId !== "string" || !departmentId) {
    return { status: "error", error: "Missing department ID." };
  }

  const supabase = await createServerClient();

  // Refuse to delete departments that still have employees, so we never
  // silently orphan profiles. The RLS scope keeps this within the org.
  const { count, error: countError } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("department_id", departmentId)
    .eq("organization_id", auth.organizationId);

  if (countError) {
    return {
      status: "error",
      error: "Could not check the department's employees. Please try again.",
    };
  }

  if (count && count > 0) {
    return {
      status: "error",
      error: `This department still has ${count} employee${
        count === 1 ? "" : "s"
      } assigned. Reassign or delete them before removing the department.`,
    };
  }

  const { error } = await supabase
    .from("departments")
    .delete()
    .eq("id", departmentId)
    .eq("organization_id", auth.organizationId);

  if (error) {
    return {
      status: "error",
      error: "Could not delete the department. Please try again.",
    };
  }

  revalidatePath("/departments");
  return { status: "success" };
}