import { z } from "zod";

/**
 * Shared Zod schema for attachment metadata (createAttachmentRecord).
 * Used client-side and re-validated server-side in lib/actions/attachments.ts.
 *
 * i18n: validation messages are parameterized through
 * `createAttachmentInputSchema(messages)` so the server action can pass
 * localized messages from the active dictionary. The exported
 * `attachmentInputSchema` keeps the English defaults as a fallback.
 *
 * The attachment `id` (UUID) is generated client-side BEFORE the file is
 * uploaded so the storage path can embed it
 * ({org}/tasks/{taskId}/{fileId}-{filename}) and the DB row can reference
 * the exact object. `taskId`/`messageId` are mutually exclusive.
 */

/** Hard cap mirrored by the project_assets bucket's file_size_limit (25 MB). */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

/** Max characters used by the app itself when building a storage path. */
export const MAX_ATTACHMENT_PATH_LENGTH = 1024;

/** Localized string messages consumed by the attachment schema. */
export interface AttachmentValidationMessages {
  invalidId: string;
  fileNameRequired: string;
  fileNameMax: string;
  fileSizePositive: string;
  fileSizeTooLarge: string;
  fileTypeRequired: string;
  fileTypeMax: string;
  invalidPath: string;
  missingParent: string;
  tooManyParents: string;
}

export const DEFAULT_ATTACHMENT_VALIDATION_MESSAGES: AttachmentValidationMessages =
  {
    invalidId: "Invalid identifier.",
    fileNameRequired: "A file name is required.",
    fileNameMax: "File names must be 255 characters or fewer.",
    fileSizePositive: "The file size must be a positive number of bytes.",
    fileSizeTooLarge: "Files must be 25 MB or smaller.",
    fileTypeRequired: "A file type is required.",
    fileTypeMax: "File types must be 120 characters or fewer.",
    invalidPath: "The storage path is invalid.",
    missingParent: "Choose a task or a message for this file.",
    tooManyParents: "A file can belong to only one task or message.",
  };

/**
 * Scoped path convention enforced by the project_assets storage policies:
 *   {org-uuid}/tasks/{task-uuid}/{file-uuid}-{filename}
 *   {org-uuid}/chat/{channel-uuid}/{file-uuid}-{filename}
 */
export const ATTACHMENT_STORAGE_PATH_RE =
  /^[0-9a-fA-F-]{36}\/(?:tasks|chat)\/[0-9a-fA-F-]{36}\/[0-9a-fA-F-]{36}-[^/]{1,240}$/;

export function createAttachmentInputSchema(
  messages: AttachmentValidationMessages = DEFAULT_ATTACHMENT_VALIDATION_MESSAGES
) {
  return z
    .object({
      id: z.string().uuid(messages.invalidId),
      taskId: z.string().uuid(messages.invalidId).nullable().optional(),
      messageId: z.string().uuid(messages.invalidId).nullable().optional(),
      fileName: z
        .string()
        .trim()
        .min(1, messages.fileNameRequired)
        .max(255, messages.fileNameMax),
      fileSize: z
        .number()
        .int()
        .positive(messages.fileSizePositive)
        .max(MAX_ATTACHMENT_BYTES, messages.fileSizeTooLarge),
      fileType: z
        .string()
        .trim()
        .min(1, messages.fileTypeRequired)
        .max(120, messages.fileTypeMax),
      storagePath: z
        .string()
        .trim()
        .min(1, messages.invalidPath)
        .max(MAX_ATTACHMENT_PATH_LENGTH, messages.invalidPath)
        .regex(ATTACHMENT_STORAGE_PATH_RE, messages.invalidPath),
      isClientVisible: z.boolean(),
    })
    .superRefine((data, ctx) => {
      const hasTask = Boolean(data.taskId);
      const hasMessage = Boolean(data.messageId);
      if (!hasTask && !hasMessage) {
        ctx.addIssue({
          code: "custom",
          path: ["taskId"],
          message: messages.missingParent,
        });
      } else if (hasTask && hasMessage) {
        ctx.addIssue({
          code: "custom",
          path: ["messageId"],
          message: messages.tooManyParents,
        });
      }
    });
}

export const attachmentInputSchema = createAttachmentInputSchema();

export type AttachmentInput = z.infer<typeof attachmentInputSchema>;