import { z } from "zod";

export const employeeStatusSchema = z.enum([
  "active",
  "suspended",
  "invited",
]);

export const employeeStatusLabels: Record<
  z.infer<typeof employeeStatusSchema>,
  string
> = {
  active: "Active",
  suspended: "Suspended",
  invited: "Invited",
};

export const employeeStatusBadgeVariants: Record<
  z.infer<typeof employeeStatusSchema>,
  "default" | "secondary" | "outline" | "destructive"
> = {
  active: "default",
  suspended: "destructive",
  invited: "outline",
};

/**
 * Shared Zod schema for creating/editing an employee.
 * Used client-side (react-hook-form resolver) and re-validated
 * server-side in lib/actions/employees.ts.
 */
export const employeeSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Full name is required.")
    .max(120, "Full name must be 120 characters or fewer."),
  email: z.string().trim().email("Enter a valid email address.").max(254),
  jobTitle: z
    .string()
    .trim()
    .max(100, "Job title must be 100 characters or fewer.")
    .optional()
    .or(z.literal("")),
  departmentId: z.string().uuid().optional().or(z.literal("")),
  roleId: z.string().uuid().optional().or(z.literal("")),
  status: employeeStatusSchema,
});

export type EmployeeFormValues = z.infer<typeof employeeSchema>;

/** State returned by employee server actions. */
export interface EmployeeActionState {
  status: "idle" | "success" | "error";
  error?: string | null;
  fieldErrors?: Partial<Record<keyof EmployeeFormValues, string[] | undefined>>;
}

export const initialEmployeeActionState: EmployeeActionState = {
  status: "idle",
};