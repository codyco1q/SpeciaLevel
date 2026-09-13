"use server";

import { revalidatePath } from "next/cache";

import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import {
  createAttachmentInputSchema,
  type AttachmentInput,
} from "@/lib/validations/attachments";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export interface AttachmentPerson {
  id: string;
  fullName: string | null;
  email: string | null;
}

export interface AttachmentRow {
  id: string;
  taskId: string | null;
  messageId: string | null;
  fileName: string;
  fileSize: number;
  fileType: string;
  storagePath: string;
  isClientVisible: boolean;
  uploadedAt: string;
  uploadedBy: AttachmentPerson;
  downloadUrl: string | null;
}

interface AttachmentJoinRow {
  id: string;
  task_id: string | null;
  message_id: string | null;
  file_name: string;
  file_size: number;
  file_type: string;
  storage_path: string;
  is_client_visible: boolean;
  uploaded_by:
    | { id: string; full_name: string | null; email: string | null }
    | { id: string; full_name: string | null; email: string | null }[]
    | null;
  created_at: string;
}

export type AttachmentActionResult =
  | {
      status: "success";
      attachments: AttachmentRow[];
      attachment: AttachmentRow | null;
    }
  | { status: "error"; error: string };

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function toAttachmentRow(
  row: AttachmentJoinRow
): Omit<AttachmentRow, "downloadUrl"> {
  const uploader = firstOf(row.uploaded_by);
  return {
    id: row.id,
    taskId: row.task_id,
    messageId: row.message_id,
    fileName: row.file_name,
    fileSize: row.file_size,
    fileType: row.file_type,
    storagePath: row.storage_path,
    isClientVisible: row.is_client_visible,
    uploadedAt: row.created_at,
    uploadedBy: uploader
      ? { id: uploader.id, fullName: uploader.full_name ?? null, email: uploader.email ?? null }
      : { id: "", fullName: null, email: null },
  };
}

const ATTACHMENT_SELECT = `
  id, task_id, message_id, file_name, file_size, file_type, storage_path,
  is_client_visible, created_at,
  uploaded_by:profiles!fk_file_attachments_uploaded_by(id, full_name, email)
`;

type AttachmentAuthResult =
  | { ok: true; organizationId: string; userId: string; isClient: boolean }
  | { ok: false; error: AttachmentActionResult };
async function requireAttachmentView(
  permission: "tasks.view" | "chat.view"
): Promise<AttachmentAuthResult> {
  const userContext = await getCurrentUserContext();
  const dict = await getDictionary();
  const err = dict.platform.attachments.errors;

  if (!userContext) {
    return { ok: false, error: { status: "error", error: err.signedIn } };
  }
  if (!hasPermission(permission, userContext.permissions)) {
    return { ok: false, error: { status: "error", error: err.noPermission } };
  }

  const organizationId = userContext.organization?.id;
  if (!organizationId) {
    return { ok: false, error: { status: "error", error: err.noOrg } };
  }

  return {
    ok: true,
    organizationId,
    userId: userContext.user.id,
    isClient: userContext.roles.some((role) => role.key === "client"),
  };
}

/**
 * Signs a one-hour download URL for an attachment using the caller's
 * (RLS-enforced) session. Returns null when signing fails so a single
 * unreadable object never breaks the whole list.
 */
export async function signAttachmentDownloadUrl(
  storagePath: string
): Promise<string | null> {
  try {
    const supabase = await createServerClient();
    const { data } = await supabase.storage
      .from("project_assets")
      .createSignedUrl(storagePath, 3600);
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

async function mapRowsWithUrls(
  rows: AttachmentJoinRow[],
  isClient: boolean
): Promise<AttachmentRow[]> {
  // Client callers are filtered strictly to client-visible files at the
  // app layer (defensive — 00014 RLS already enforces the same rule).
  const visibleRows = isClient
    ? rows.filter((row) => row.is_client_visible)
    : rows;

  const urlPromises = visibleRows.map((row) =>
    signAttachmentDownloadUrl(row.storage_path)
  );
  const urls = await Promise.all(urlPromises);

  return visibleRows.map((row, index) => ({
    ...toAttachmentRow(row),
    downloadUrl: urls[index],
  }));
}

/**
 * Lists a task's attachments with one-hour signed download URLs. Requires
 * `tasks.view`; Client-role callers are filtered strictly to files that are
 * client-visible and reachable through the 00013 task scoping.
 */
export async function getTaskAttachments(
  taskId: string
): Promise<AttachmentActionResult> {
  const auth = await requireAttachmentView("tasks.view");
  if (!auth.ok) return auth.error;

  const dict = await getDictionary();
  if (!taskId) {
    return {
      status: "error",
      error: dict.platform.attachments.errors.missingId,
    };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("file_attachments")
    .select(ATTACHMENT_SELECT)
    .eq("organization_id", auth.organizationId)
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[attachments] task list failed:", error.message);
    return {
      status: "error",
      error: dict.platform.attachments.errors.listFailed,
    };
  }

  const attachments = await mapRowsWithUrls(
    (data ?? []) as unknown as AttachmentJoinRow[],
    auth.isClient
  );

  return { status: "success", attachments, attachment: null };
}

/**
 * Lists a message's attachments with signed download URLs. Requires
 * `chat.view`; chat bubbles use this to render inline file cards. The 00014
 * client policy only lets a Client caller see files in channels they can
 * read.
 */
export async function getMessageAttachments(
  messageId: string
): Promise<AttachmentActionResult> {
  const auth = await requireAttachmentView("chat.view");
  if (!auth.ok) return auth.error;

  const dict = await getDictionary();
  if (!messageId) {
    return {
      status: "error",
      error: dict.platform.attachments.errors.missingId,
    };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("file_attachments")
    .select(ATTACHMENT_SELECT)
    .eq("organization_id", auth.organizationId)
    .eq("message_id", messageId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[attachments] message list failed:", error.message);
    return {
      status: "error",
      error: dict.platform.attachments.errors.listFailed,
    };
  }

  const attachments = await mapRowsWithUrls(
    (data ?? []) as unknown as AttachmentJoinRow[],
    auth.isClient
  );

  return { status: "success", attachments, attachment: null };
}
/**
 * Persists a file_attachments row after the browser already uploaded the
 * object to `project_assets`. `organization_id` / `uploaded_by` come from
 * the session. The parent (task or message) must exist in the caller's
 * organization, and the storage path must follow the scoped convention.
 * Client-role callers are denied at the app layer (RLS backstops this).
 */
export async function createAttachmentRecord(
  data: unknown
): Promise<AttachmentActionResult> {
  const userContext = await getCurrentUserContext();
  const dict = await getDictionary();
  const err = dict.platform.attachments.errors;

  if (!userContext) return { status: "error", error: err.signedIn };

  const organizationId = userContext.organization?.id;
  if (!organizationId) return { status: "error", error: err.noOrg };

  const permissions = userContext.permissions;
  const isClient = userContext.roles.some((role) => role.key === "client");
  const raw = data as Partial<AttachmentInput> | undefined;

  // The parent determines which module permission applies.
  const hasTaskParent = Boolean(raw?.taskId);
  const hasMessageParent = Boolean(raw?.messageId);
  const hasTaskView = hasPermission("tasks.view", permissions);
  const hasChatView = hasPermission("chat.view", permissions);

  if (!hasTaskView && !hasChatView) {
    return { status: "error", error: err.noPermission };
  }
  if (hasTaskParent && !hasTaskView) {
    return { status: "error", error: err.noPermission };
  }
  if (hasMessageParent && !hasChatView) {
    return { status: "error", error: err.noPermission };
  }
  if (isClient) {
    return { status: "error", error: err.noPermission };
  }

  const parsed = createAttachmentInputSchema(err).safeParse(data);
  if (!parsed.success) {
    return {
      status: "error",
      error: parsed.error.issues[0]?.message ?? err.invalidRecord,
    };
  }

  const {
    id,
    taskId,
    messageId,
    fileName,
    fileSize,
    fileType,
    storagePath,
    isClientVisible,
  } = parsed.data;

  const supabase = await createServerClient();

  // Verify the parent exists in the caller's organization so a foreign id
  // can never be linked (FK + RLS backstops this as well).
  if (taskId) {
    const { data: parent } = await supabase
      .from("tasks")
      .select("id")
      .eq("id", taskId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!parent) return { status: "error", error: err.parentNotFound };
  } else if (messageId) {
    const { data: parent } = await supabase
      .from("chat_messages")
      .select("id")
      .eq("id", messageId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!parent) return { status: "error", error: err.parentNotFound };
  }

  const { data: inserted, error } = await supabase
    .from("file_attachments")
    .insert({
      id,
      organization_id: organizationId,
      task_id: taskId ?? null,
      message_id: messageId ?? null,
      file_name: fileName,
      file_size: fileSize,
      file_type: fileType,
      storage_path: storagePath,
      is_client_visible: isClientVisible,
      uploaded_by: userContext.user.id,
    })
    .select(ATTACHMENT_SELECT)
    .single();

  if (error) {
    console.error("[attachments] record insert failed:", error.message);
    return { status: "error", error: err.recordFailed };
  }

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/chat");

  const row = inserted as unknown as AttachmentJoinRow;
  const downloadUrl = await signAttachmentDownloadUrl(row.storage_path);

  return {
    status: "success",
    attachment: { ...toAttachmentRow(row), downloadUrl },
    attachments: [],
  };
}

/**
 * Deletes an attachment: removes the object from `project_assets` first,
 * then the metadata row. Callers must hold `tasks.manage` / `chat.manage`
 * OR be the original uploader. Organization scoping is always enforced.
 */
export async function deleteAttachment(
  attachmentId: string
): Promise<AttachmentActionResult> {
  const userContext = await getCurrentUserContext();
  const dict = await getDictionary();
  const err = dict.platform.attachments.errors;

  if (!userContext) return { status: "error", error: err.signedIn };

  const organizationId = userContext.organization?.id;
  if (!organizationId) return { status: "error", error: err.noOrg };
  if (!attachmentId) return { status: "error", error: err.missingId };

  const permissions = userContext.permissions;
  const canManageTasks = hasPermission("tasks.manage", permissions);
  const canManageChat = hasPermission("chat.manage", permissions);
  const canViewAny =
    hasPermission("tasks.view", permissions) ||
    hasPermission("chat.view", permissions);

  if (!canManageTasks && !canManageChat && !canViewAny) {
    return { status: "error", error: err.noPermission };
  }

  const supabase = await createServerClient();

  const { data: row, error: fetchError } = await supabase
    .from("file_attachments")
    .select("id, storage_path, uploaded_by")
    .eq("id", attachmentId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (fetchError || !row) {
    console.error(
      "[attachments] delete fetch failed:",
      fetchError?.message ?? "no row"
    );
    return { status: "error", error: err.notFound };
  }

  // A view-only member may only delete files they uploaded themselves.
  const isUploader = row.uploaded_by === userContext.user.id;
  if (!canManageTasks && !canManageChat && !isUploader) {
    return { status: "error", error: err.noPermission };
  }

  // Storage object first, then the DB row — the project_assets DELETE
  // policy only requires org scoping + an internal role, so the object can
  // be removed even before the metadata row is gone.
  const { error: removeError } = await supabase.storage
    .from("project_assets")
    .remove([row.storage_path]);
  if (removeError) {
    console.error("[attachments] storage remove failed:", removeError.message);
    return { status: "error", error: err.deleteFailed };
  }

  const { error: deleteError } = await supabase
    .from("file_attachments")
    .delete()
    .eq("id", attachmentId)
    .eq("organization_id", organizationId);

  if (deleteError) {
    console.error("[attachments] row delete failed:", deleteError.message);
    return { status: "error", error: err.deleteFailed };
  }

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/chat");

  return { status: "success", attachments: [], attachment: null };
}
