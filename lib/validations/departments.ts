import { z } from "zod";

/**
 * Shared Zod schema for creating a department.
 * Used client-side (react-hook-form resolver) and re-validated
 * server-side in lib/actions/departments.ts.
 */
export const departmentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Department name is required.")
    .max(100, "Department name must be 100 characters or fewer."),
  description: z
    .string()
    .trim()
    .max(500, "Description must be 500 characters or fewer.")
    .optional()
    .or(z.literal("")),
});

export type DepartmentFormValues = z.infer<typeof departmentSchema>;

/** General action-state shape for department mutations. */
export interface DepartmentActionState {
  status: "idle" | "success" | "error";
  error?: string | null;
  fieldErrors?: Partial<
    Record<keyof DepartmentFormValues, string[] | undefined>
  >;
}

export const initialDepartmentActionState: DepartmentActionState = {
  status: "idle",
};