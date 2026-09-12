import { z } from "zod";

/**
 * Shared Zod schema for tasks (create + update).
 * Used client-side (react-hook-form resolver) and re-validated
 * server-side in lib/actions/tasks.ts.
 *
 * i18n: validation messages are parameterized through
 * `createTaskInputSchema(messages)` so the client forms and the server
 * action can pass localized messages from the active dictionary. The
 * exported `taskInputSchema` keeps the English defaults for callers that
 * need the schema without a locale.
 *
 * Field names are camelCase over the wire; they are mapped to the
 * snake_case DB columns inside the server actions.
 */
export const taskStatusSchema = z.enum(["todo", "in_progress", "review", "done"]);

export const taskPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);

/** Localized string messages consumed by the task schema. */
export interface TaskValidationMessages {
  titleMin: string;
  titleMax: string;
  descriptionMax: string;
  invalidAssignee: string;
  invalidDueDate: string;
}

export const DEFAULT_TASK_VALIDATION_MESSAGES: TaskValidationMessages = {
  titleMin: "Title must be at least 2 characters.",
  titleMax: "Title must be 100 characters or fewer.",
  descriptionMax: "Description must be 4000 characters or fewer.",
  invalidAssignee: "Select a valid team member.",
  invalidDueDate: "Enter a valid due date.",
};

export function createTaskInputSchema(
  messages: TaskValidationMessages = DEFAULT_TASK_VALIDATION_MESSAGES
) {
  return z.object({
    title: z
      .string()
      .trim()
      .min(2, messages.titleMin)
      .max(100, messages.titleMax),
    description: z
      .string()
      .trim()
      .max(4000, messages.descriptionMax)
      .optional()
      .or(z.literal("")),
    status: taskStatusSchema,
    priority: taskPrioritySchema,
    assignedTo: z
      .string()
      .uuid(messages.invalidAssignee)
      .optional()
      .or(z.literal("")),
    dueDate: z
      .string()
      .optional()
      .or(z.literal(""))
      .refine(
        (value) => {
          if (!value) return true; // empty = no due date
          return !Number.isNaN(Date.parse(value));
        },
        { message: messages.invalidDueDate }
      ),
  });
}

export const taskInputSchema = createTaskInputSchema();

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