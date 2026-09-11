import { z } from "zod";

// ----------------------------------------------------------------
// Zod schemas shared between client (react-hook-form) and server
// actions in lib/actions/roles.ts.
// ----------------------------------------------------------------

const roleName = z
  .string()
  .trim()
  .min(2, "Role name must be at least 2 characters.")
  .max(50, "Role name must be 50 characters or fewer.");

/** Name-only schema (used by the client form resolver). */
export const roleNameSchema = z.object({
  name: roleName,
});

export const createRoleSchema = z.object({
  name: roleName,
  permissionKeys: z.array(z.string().trim().min(1)).default([]),
});

export const updateRolePermissionsSchema = z.object({
  name: roleName.optional(),
  permissionKeys: z.array(z.string().trim().min(1)).default([]),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRolePermissionsInput = z.infer<typeof updateRolePermissionsSchema>;

// ----------------------------------------------------------------
// Shared action-state shape for role mutations.
// ----------------------------------------------------------------

export interface RolesActionState {
  status: "idle" | "success" | "error";
  /** Top-level error message (shown below the heading). */
  error?: string | null;
  /** Map of field names to validation errors surfaced by the server action. */
  fieldErrors?: Record<string, string[] | undefined>;
}

export const initialRolesActionState: RolesActionState = {
  status: "idle",
};
