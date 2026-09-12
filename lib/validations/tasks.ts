import { z } from "zod";

/**
 * Shared Zod schema for tasks (create + update).
 * Used client-side (react-hook-form resolver) and re-validated
 * server-side in lib/actions/tasks.ts.
 *
 * Field names are camelCase over the wire; they are mapped to the
 * snake_case DB columns inside the server actions.
 */
export const taskStatusSchema = z.enum(["todo", "in_progress", "review", "done"]);

export const taskPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);

export const taskInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Title must be at least 2 characters.")
    .max(100, "Title must be 100 characters or fewer."),
  description: z
    .string()
    .trim()
    .max(4000, "Description must be 4000 characters or fewer.")
    .optional()
    .or(z.literal("")),
  status: taskStatusSchema,
  priority: taskPrioritySchema,
  assignedTo: z.string().uuid("Select a valid team member.").optional().or(z.literal("")),
  dueDate: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine(
      (value) => {
        if (!value) return true; // empty = no due date
        return !Number.isNaN(Date.parse(value));
      },
      { message: "Enter a valid due date." }
    ),
});

export type TaskInput = z.infer<typeof taskInputSchema>;

/** State returned by task server actions. */
export interface TaskActionState {
  status: "idle" | "success" | "error";
  error?: string | null;
  fieldErrors?: Partial<Record<keyof TaskInput, string[] | undefined>>;
}

export const initialTaskActionState: TaskActionState = {
  status: "idle",
};