import { z } from "zod";
import type { RichTextBlock } from "@/types/database";

/**
 * Shared Zod schema for tasks & docs (create + update).
 * Used client-side (react-hook-form resolver) and re-validated
 * server-side in lib/actions/tasks.ts.
 */
export const taskStatusSchema = z.enum([
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
]);

export const taskPrioritySchema = z.enum([
  "urgent",
  "high",
  "medium",
  "low",
  "none",
]);

export const richTextBlockTypeSchema = z.enum([
  "paragraph",
  "heading1",
  "heading2",
  "heading3",
  "bulletList",
  "numberedList",
  "todoList",
  "quote",
  "code",
  "callout",
  "divider",
  "p",
  "h1",
  "h2",
  "h3",
  "todo",
  "bullet",
]);

export const richTextBlockSchema = z.object({
  id: z.string(),
  type: richTextBlockTypeSchema,
  content: z.string().optional(),
  checked: z.boolean().optional(),
  language: z.string().optional(),
});

/** Localized string messages consumed by the task schema. */
export interface TaskValidationMessages {
  titleMin: string;
  titleMax: string;
  descriptionMax: string;
  invalidAssignee: string;
  invalidDueDate: string;
  invalidStartDate?: string;
  invalidHours?: string;
}

export const DEFAULT_TASK_VALIDATION_MESSAGES: TaskValidationMessages = {
  titleMin: "Title must be at least 1 character.",
  titleMax: "Title must be 200 characters or fewer.",
  descriptionMax: "Description must be 50000 characters or fewer.",
  invalidAssignee: "Select a valid team member.",
  invalidDueDate: "Enter a valid due date.",
  invalidStartDate: "Enter a valid start date.",
  invalidHours: "Estimated hours must be a positive number.",
};

export function createTaskInputSchema(
  messages: TaskValidationMessages = DEFAULT_TASK_VALIDATION_MESSAGES
) {
  return z.object({
    title: z
      .string()
      .trim()
      .min(1, messages.titleMin)
      .max(200, messages.titleMax),
    description: z.string().optional().or(z.literal("")),
    descriptionText: z.string().optional().or(z.literal("")),
    descriptionJson: z.array(richTextBlockSchema).optional(),
    status: taskStatusSchema.default("todo"),
    priority: taskPrioritySchema.default("medium"),
    assignedTo: z
      .string()
      .uuid(messages.invalidAssignee)
      .optional()
      .or(z.literal(""))
      .nullable(),
    dueDate: z
      .string()
      .optional()
      .or(z.literal(""))
      .nullable()
      .refine(
        (value) => {
          if (!value) return true;
          return !Number.isNaN(Date.parse(value));
        },
        { message: messages.invalidDueDate }
      ),
    startDate: z
      .string()
      .optional()
      .or(z.literal(""))
      .nullable()
      .refine(
        (value) => {
          if (!value) return true;
          return !Number.isNaN(Date.parse(value));
        },
        { message: messages.invalidStartDate || messages.invalidDueDate }
      ),
    estimatedHours: z
      .union([z.number(), z.string()])
      .optional()
      .nullable()
      .transform((val) => {
        if (val === undefined || val === null || val === "") return null;
        const num = typeof val === "number" ? val : parseFloat(val);
        return isNaN(num) ? null : Math.max(0, Math.round(num * 100) / 100);
      }),
    tags: z.array(z.string()).default([]),
    isDoc: z.boolean().default(false),
    stageId: z.string().uuid().optional().or(z.literal("")).nullable(),
    parentId: z.string().uuid().optional().or(z.literal("")).nullable(),
    orderIndex: z.number().int().default(0),
  });
}

export const taskInputSchema = createTaskInputSchema();

export type TaskInput = z.infer<typeof taskInputSchema>;

export const taskCommentInputSchema = z.object({
  taskId: z.string().uuid(),
  content: z.string().trim().min(1, "Comment cannot be empty").max(4000),
});

export type TaskCommentInput = z.infer<typeof taskCommentInputSchema>;

/** State returned by task server actions. */
export interface TaskActionState {
  status: "idle" | "success" | "error";
  error?: string | null;
  taskId?: string;
  fieldErrors?: Partial<Record<keyof TaskInput, string[] | undefined>>;
}

export const initialTaskActionState: TaskActionState = {
  status: "idle",
};
