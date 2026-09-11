"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import {
  createRoleSchema,
  updateRolePermissionsSchema,
  type CreateRoleInput,
  type UpdateRolePermissionsInput,
  type RolesActionState,
} from "@/lib/validations/roles";
import { z } from "zod";

// ================================================================
// Public return types shared by getRolesData() and the UI layer.
// ================================================================

export interface RoleWithPermissions {
  id: string;
  name: string;
  key: string;
  description: string | null;
  isSystem: boolean;
  permissionKeys: string[];
  memberCount: number;
}

export interface PermissionDefinition {
  id: string;
  key: string;
  name: string;
  description: string | null;
  module: string;
}

export interface RolesData {
  roles: RoleWithPermissions[];
  permissionCatalog: PermissionDefinition[];
}

export type RolesDataResult =
  | { status: "success"; data: RolesData }
  | { status: "error"; error: string };

// ================================================================
// Internal helpers
// ================================================================

function parseFieldErrors(
  issues: z.ZodIssue[]
): RolesActionState["fieldErrors"] {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string") {
      (fieldErrors[key] ??= []).push(issue.message);
    }
  }
  return fieldErrors;
}

type AuthResult =
  | { ok: true; organizationId: string }
  | { ok: false; error: RolesActionState };

async function authorizeRolesView(): Promise<AuthResult> {
  const userContext = await getCurrentUserContext();

  if (!userContext) {
    return {
      ok: false,
      error: { status: "error", error: "You must be signed in to do this." },
    };
  }

  if (!userContext.permissions.includes("roles.view")) {
    return {
      ok: false,
      error: { status: "error", error: "You don't have permission to view roles." },
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

async function authorizeRolesManage(): Promise<AuthResult> {
  const userContext = await getCurrentUserContext();

  if (!userContext) {
    return {
      ok: false,
      error: { status: "error", error: "You must be signed in to do this." },
    };
  }

  if (!userContext.permissions.includes("roles.manage")) {
    return {
      ok: false,
      error: { status: "error", error: "You don't have permission to manage roles." },
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

/** Build a unique key for custom roles within an organization. */
function buildCustomRoleKey(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `custom_${slug || "role"}_${suffix}`;
}

/** Canonical sort order for system role keys. */
const SYSTEM_ROLE_ORDER: Record<string, number> = {
  owner: 0,
  admin: 1,
  manager: 2,
  employee: 3,
};

// ================================================================
// READ
// ================================================================

/**
 * Returns every role in the active organization, each enriched with its
 * granted permission keys and the number of employees assigned to it,
 * plus the full permission catalog.
 *
 * Enforces `roles.view` server-side.
 */
export async function getRolesData(): Promise<RolesDataResult> {
  const auth = await authorizeRolesView();
  if (!auth.ok) {
    return { status: "error", error: auth.error.error ?? "Authorization failed." };
  }

  const orgId = auth.organizationId;
  const supabase = await createServerClient();

  const [rolesRes, rolePermsRes, userRolesRes, catalogRes] = await Promise.all([
    supabase
      .from("roles")
      .select("id, name, key, description, is_system")
      .eq("organization_id", orgId),
    supabase
      .from("role_permissions")
      .select("role_id, permission:permissions(key)")
      .eq("organization_id", orgId),
    supabase
      .from("user_roles")
      .select("role_id")
      .eq("organization_id", orgId),
    supabase
      .from("permissions")
      .select("id, key, name, description, module")
      .eq("organization_id", orgId)
      .order("module"),
  ]);

  if (rolesRes.error || !rolesRes.data) {
    return { status: "error", error: "Could not load roles. Please try again." };
  }

  if (catalogRes.error || !catalogRes.data) {
    return { status: "error", error: "Could not load the permissions catalog. Please try again." };
  }

  // Build the member count map (role_id -> count).
  const memberCounts = new Map<string, number>();
  for (const row of userRolesRes.data ?? []) {
    const rid = row.role_id as string;
    memberCounts.set(rid, (memberCounts.get(rid) ?? 0) + 1);
  }

  // Build the permission keys map (role_id -> Set<string>).
  const permKeysByRole = new Map<string, Set<string>>();
  for (const row of rolePermsRes.data ?? []) {
    const rid = row.role_id as string;
    const perm = row.permission as
      | { key?: string }
      | { key?: string }[]
      | null;
    const key = Array.isArray(perm) ? perm[0]?.key : perm?.key;
    if (typeof key === "string") {
      if (!permKeysByRole.has(rid)) permKeysByRole.set(rid, new Set());
      permKeysByRole.get(rid)!.add(key);
    }
  }

  // Sort: system roles in canonical order, custom roles alphabetically.
  const roles: RoleWithPermissions[] = rolesRes.data
    .map((r) => ({
      id: r.id,
      name: r.name,
      key: r.key,
      description: r.description,
      isSystem: r.is_system,
      permissionKeys: Array.from(permKeysByRole.get(r.id) ?? []),
      memberCount: memberCounts.get(r.id) ?? 0,
    }))
    .sort((a, b) => {
      if (a.isSystem && b.isSystem) {
        return (
          (SYSTEM_ROLE_ORDER[a.key] ?? 99) -
          (SYSTEM_ROLE_ORDER[b.key] ?? 99)
        );
      }
      if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  const permissionCatalog: PermissionDefinition[] = catalogRes.data.map((p) => ({
    id: p.id,
    key: p.key,
    name: p.name,
    description: p.description,
    module: p.module,
  }));

  return { status: "success", data: { roles, permissionCatalog } };
}

// ================================================================
// CREATE
// ================================================================

/**
 * Creates a custom role within the caller's organization.
 *
 * - Validates name and permission keys via Zod.
 * - Inserts the role row (`is_system = false`).
 * - Resolves the supplied permission keys to IDs in this org and
 *   bulk-inserts into `role_permissions`.
 * - Revalidates `/roles` and `/employees`.
 */
export async function createRole(
  data: CreateRoleInput
): Promise<RolesActionState & { roleId?: string }> {
  const auth = await authorizeRolesManage();
  if (!auth.ok) return auth.error;

  const parsed = createRoleSchema.safeParse(data);
  if (!parsed.success) {
    return {
      status: "error",
      error: null,
      fieldErrors: parseFieldErrors(parsed.error.issues),
    };
  }

  const { name, permissionKeys } = parsed.data;
  const uniqueKeys = Array.from(new Set(permissionKeys));

  const supabase = await createServerClient();

  const { data: role, error: roleError } = await supabase
    .from("roles")
    .insert({
      organization_id: auth.organizationId,
      name,
      key: buildCustomRoleKey(name),
      description: null,
      is_system: false,
    })
    .select("id")
    .single();

  if (roleError || !role) {
    return {
      status: "error",
      error: "Could not create the role. Please try again.",
    };
  }

  // Link permissions (only if the user supplied at least one).
  if (uniqueKeys.length > 0) {
    const { data: permissionRows } = await supabase
      .from("permissions")
      .select("id, key")
      .eq("organization_id", auth.organizationId)
      .in("key", uniqueKeys);

    const idByKey = new Map(
      (permissionRows ?? []).map((p) => [p.key, p.id])
    );

    const rows = uniqueKeys
      .map((k) => {
        const permissionId = idByKey.get(k);
        return permissionId
          ? { role_id: role.id, permission_id: permissionId, organization_id: auth.organizationId }
          : null;
      })
      .filter(
        (r): r is { role_id: string; permission_id: string; organization_id: string } =>
          r !== null
      );

    if (rows.length > 0) {
      const { error: rpError } = await supabase
        .from("role_permissions")
        .upsert(rows, { onConflict: "role_id,permission_id", ignoreDuplicates: true });

      if (rpError) {
        return {
          status: "error",
          error: "Role created, but its permissions could not be saved. Please try again.",
        };
      }
    }
  }

  revalidatePath("/roles");
  revalidatePath("/employees");
  return { status: "success", roleId: role.id };
}

// ================================================================
// UPDATE PERMISSIONS (optionally rename for custom roles)
// ================================================================

/**
 * Syncs the permission set for a role: removes revoked keys, inserts
 * newly granted keys. Optionally renames a custom role.
 *
 * - Blocks permission changes for the `Owner` role.
 * - Blocks renames for any system role.
 * - Revalidates `/roles` on success.
 */
export async function updateRolePermissions(
  roleId: string,
  data: UpdateRolePermissionsInput
): Promise<RolesActionState> {
  const auth = await authorizeRolesManage();
  if (!auth.ok) return auth.error;

  if (!roleId) {
    return { status: "error", error: "Missing role ID." };
  }

  const parsed = updateRolePermissionsSchema.safeParse(data);
  if (!parsed.success) {
    return {
      status: "error",
      error: null,
      fieldErrors: parseFieldErrors(parsed.error.issues),
    };
  }

  const supabase = await createServerClient();

  // Fetch the target role, scoped to this org.
  const { data: role, error: roleError } = await supabase
    .from("roles")
    .select("id, name, key, is_system")
    .eq("id", roleId)
    .eq("organization_id", auth.organizationId)
    .single();

  if (roleError || !role) {
    return {
      status: "error",
      error: "Role not found, or you don't have access to it.",
    };
  }

  // Guard: Owner role is immutable.
  if (role.key === "owner") {
    return {
      status: "error",
      error: "The Owner role always retains full access. Its permissions cannot be changed.",
    };
  }

  // Guard: system roles cannot be renamed.
  if (role.is_system && parsed.data.name !== undefined) {
    return {
      status: "error",
      error: "System roles cannot be renamed.",
    };
  }

  const { name, permissionKeys } = parsed.data;
  const uniqueKeys = Array.from(new Set(permissionKeys));

  // Resolve desired keys to permission IDs in this organization.
  let desiredIds: string[] = [];
  if (uniqueKeys.length > 0) {
    const { data: permissionRows } = await supabase
      .from("permissions")
      .select("id, key")
      .eq("organization_id", auth.organizationId)
      .in("key", uniqueKeys);

    const idByKey = new Map((permissionRows ?? []).map((p) => [p.key, p.id]));
    desiredIds = uniqueKeys
      .map((k) => idByKey.get(k))
      .filter((id): id is string => typeof id === "string");
  }

  // Fetch current permission IDs for this role.
  const { data: existingRows, error: existingError } = await supabase
    .from("role_permissions")
    .select("permission_id")
    .eq("role_id", roleId)
    .eq("organization_id", auth.organizationId);

  if (existingError) {
    return {
      status: "error",
      error: "Could not load the role's permissions. Please try again.",
    };
  }

  const currentIds = (existingRows ?? []).map(
    (r: { permission_id: string }) => r.permission_id
  );
  const currentSet = new Set(currentIds);
  const desiredSet = new Set(desiredIds);

  const toRemove = currentIds.filter((id) => !desiredSet.has(id));
  const toAdd = desiredIds.filter((id) => !currentSet.has(id));

  // Remove revoked permissions.
  if (toRemove.length > 0) {
    const { error: deleteError } = await supabase
      .from("role_permissions")
      .delete()
      .eq("role_id", roleId)
      .eq("organization_id", auth.organizationId)
      .in("permission_id", toRemove);

    if (deleteError) {
      return {
        status: "error",
        error: "Could not update the role's permissions. Please try again.",
      };
    }
  }

  // Insert newly granted permissions.
  if (toAdd.length > 0) {
    const rows = toAdd.map((permission_id) => ({
      role_id: roleId,
      permission_id,
      organization_id: auth.organizationId,
    }));

    const { error: insertError } = await supabase
      .from("role_permissions")
      .upsert(rows, { onConflict: "role_id,permission_id", ignoreDuplicates: true });

    if (insertError) {
      return {
        status: "error",
        error: "Could not update the role's permissions. Please try again.",
      };
    }
  }

  // Rename custom role (system roles are blocked above).
  if (name !== undefined && name !== role.name) {
    const { error: nameError } = await supabase
      .from("roles")
      .update({ name })
      .eq("id", roleId)
      .eq("organization_id", auth.organizationId);

    if (nameError) {
      return {
        status: "error",
        error: "Permissions updated, but the role could not be renamed. Please try again.",
      };
    }
  }

  revalidatePath("/roles");
  return { status: "success" };
}
// ================================================================
// DELETE
// ================================================================

/**
 * Deletes a custom role. Blocked if `is_system` is true or if active
 * employees are currently assigned (returns a message with the count).
 *
 * Deletes `role_permissions` explicitly, then the role itself.
 * Revalidates `/roles` and `/employees`.
 */
export async function deleteRole(roleId: string): Promise<RolesActionState> {
  const auth = await authorizeRolesManage();
  if (!auth.ok) return auth.error;

  if (!roleId) {
    return { status: "error", error: "Missing role ID." };
  }

  const supabase = await createServerClient();

  const { data: role, error: roleError } = await supabase
    .from("roles")
    .select("id, name, is_system")
    .eq("id", roleId)
    .eq("organization_id", auth.organizationId)
    .single();

  if (roleError || !role) {
    return {
      status: "error",
      error: "Role not found, or you don't have access to it.",
    };
  }

  if (role.is_system) {
    return {
      status: "error",
      error: "System roles cannot be deleted.",
    };
  }

  // Check for assigned employees.
  const { count, error: countError } = await supabase
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role_id", roleId)
    .eq("organization_id", auth.organizationId);

  if (countError) {
    return {
      status: "error",
      error: "Could not check the role's assigned employees. Please try again.",
    };
  }

  if (count && count > 0) {
    return {
      status: "error",
      error: `This role still has ${count} employee${
        count === 1 ? "" : "s"
      } assigned. Reassign them before deleting this role.`,
    };
  }

  // Delete role_permissions first (explicit), then the role itself.
  const { error: rpError } = await supabase
    .from("role_permissions")
    .delete()
    .eq("role_id", roleId)
    .eq("organization_id", auth.organizationId);

  if (rpError) {
    return {
      status: "error",
      error: "Could not delete the role. Please try again.",
    };
  }

  const { error: deleteError } = await supabase
    .from("roles")
    .delete()
    .eq("id", roleId)
    .eq("organization_id", auth.organizationId);

  if (deleteError) {
    return {
      status: "error",
      error: "Could not delete the role. Please try again.",
    };
  }

  revalidatePath("/roles");
  revalidatePath("/employees");
  return { status: "success" };
}

