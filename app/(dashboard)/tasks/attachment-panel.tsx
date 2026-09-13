"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Download,
  Eye,
  EyeOff,
  FileText,
  LoaderCircle,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { createBrowserClient } from "@/lib/supabase/client";
import {
  createAttachmentRecord,
  deleteAttachment,
  getTaskAttachments,
  type AttachmentRow,
} from "@/lib/actions/attachments";
import { formatFileSize, newUuid, sanitizeFileName } from "@/lib/utils/files";
import { MAX_ATTACHMENT_BYTES } from "@/lib/validations/attachments";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

interface AttachmentPanelProps {
  taskId: string;
  organizationId: string;
  /** Internal member with `tasks.view` — can upload new files. */
  canUpload: boolean;
  /** Holds `tasks.manage` — can delete anyone's attachments. */
  canManage: boolean;
  currentUserId: string;
  /** Task's own client-visible flag — seeds the per-file checkbox default. */
  taskClientVisible: boolean;
  /** Localized copy for the current render. */
  platform: Dictionary["platform"];
}
/**
 * Task Attachments & Deliverables panel. Uploads go straight from the
 * browser to the private `project_assets` bucket (storage RLS scopes the
 * path to the caller's organization), then a metadata row is persisted via
 * `createAttachmentRecord`. Download links are one-hour signed URLs.
 */
export function AttachmentPanel({
  taskId,
  organizationId,
  canUpload,
  canManage,
  currentUserId,
  taskClientVisible,
  platform,
}: AttachmentPanelProps) {
  const t = platform.attachments;
  const inputRef = useRef<HTMLInputElement>(null);

  const [attachments, setAttachments] = useState<AttachmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibleToClient, setVisibleToClient] = useState(taskClientVisible);
  const [dragActive, setDragActive] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null
  );

  const loadAttachments = useCallback(async () => {
    const result = await getTaskAttachments(taskId);
    setAttachments(result.status === "success" ? result.attachments : []);
    setLoading(false);
  }, [taskId]);

  useEffect(() => {
    let cancelled = false;
    getTaskAttachments(taskId).then((result) => {
      if (cancelled) return;
      setAttachments(result.status === "success" ? result.attachments : []);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  const uploadFiles = async (files: FileList | File[]) => {
    if (!canUpload || uploading) return;
    setError(null);

    for (const file of Array.from(files)) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setError(t.errors.fileTooLarge);
        continue;
      }
      if (file.size === 0) {
        setError(t.errors.fileEmpty);
        continue;
      }

      setUploading(true);
      const id = newUuid();
      const storagePath = `${organizationId}/tasks/${taskId}/${id}-${sanitizeFileName(file.name)}`;

      try {
        const supabase = createBrowserClient();
        const { error: uploadError } = await supabase.storage
          .from("project_assets")
          .upload(storagePath, file, {
            cacheControl: "3600",
            contentType: file.type || "application/octet-stream",
            upsert: false,
          });

        if (uploadError) {
          console.error("[attachments] upload failed:", uploadError.message);
          setError(t.errors.uploadFailed);
          continue;
        }

        const result = await createAttachmentRecord({
          id,
          taskId,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type || "application/octet-stream",
          storagePath,
          isClientVisible: visibleToClient,
        });

        if (result.status === "error") {
          // The object is stored but the metadata row failed — remove the
          // orphan so the private bucket doesn't accumulate garbage.
          await supabase.storage.from("project_assets").remove([storagePath]);
          setError(result.error);
          continue;
        }
      } catch (caught) {
        console.error("[attachments] upload threw:", caught);
        setError(t.errors.uploadFailed);
      }
    }

    setUploading(false);
    await loadAttachments();
  };

  const handleFilesChosen = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) void uploadFiles(files);
    event.target.value = "";
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    if (event.dataTransfer.files.length > 0) {
      void uploadFiles(event.dataTransfer.files);
    }
  };

  const confirmDelete = async (attachment: AttachmentRow) => {
    if (deletingId) return;
    if (confirmingDeleteId !== attachment.id) {
      setConfirmingDeleteId(attachment.id);
      return;
    }
    setDeletingId(attachment.id);
    setError(null);
    const result = await deleteAttachment(attachment.id);
    setDeletingId(null);
    setConfirmingDeleteId(null);
    if (result.status === "error") {
      setError(result.error);
      return;
    }
    await loadAttachments();
  };
const canDelete = (attachment: AttachmentRow) =>
    canManage || attachment.uploadedBy.id === currentUserId;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t.title}
        </h4>
        {loading && (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            {t.loading}
          </span>
        )}
      </div>

      {canUpload && (
        <div className="space-y-3">
          {/* Upload dropzone */}
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={cn(
              "flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-4 py-5 text-center transition-colors",
              dragActive
                ? "border-primary bg-primary/5"
                : "border-border hover:border-foreground/20"
            )}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFilesChosen}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <UploadCloud className="h-4 w-4" />
              )}
              {uploading ? t.uploading : t.upload}
            </Button>
            <p className="text-xs text-muted-foreground">
              {t.uploadHint} · {t.maxSizeHint}
            </p>
          </div>

          {/* Visibility toggle */}
          <div className="flex items-start gap-2">
            <Checkbox
              id="attachment-client-visible"
              checked={visibleToClient}
              onCheckedChange={(checked) =>
                setVisibleToClient(checked === true)
              }
              disabled={uploading}
            />
            <div className="grid gap-0.5">
              <Label
                htmlFor="attachment-client-visible"
                className="text-sm leading-tight"
              >
                {t.visibleToClient}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t.visibleToClientHint}
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {/* Attachment list */}
      <ul className="space-y-1.5">
        {!loading && attachments.length === 0 && (
          <li className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4 shrink-0" />
            {t.noAttachments}
          </li>
        )}
        {attachments.map((attachment) => {
          const uploaderName =
            attachment.uploadedBy.fullName ??
            attachment.uploadedBy.email ??
            "";
          return (
            <li
              key={attachment.id}
              className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-sm"
            >
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{attachment.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(attachment.fileSize)}
                  <span className="mx-1">·</span>
                  <span className="inline-flex items-center gap-0.5">
                    {attachment.isClientVisible ? (
                      <Eye className="h-3 w-3" />
                    ) : (
                      <EyeOff className="h-3 w-3" />
                    )}
                    {attachment.isClientVisible
                      ? t.visibleToClient
                      : t.fileHidden}
                  </span>
                  {uploaderName && (
                    <>
                      <span className="mx-1">·</span>
                      {t.uploadedBy.replace("{name}", uploaderName)}
                    </>
                  )}
                </p>
              </div>
{attachment.downloadUrl && (
                <a
                  href={attachment.downloadUrl}
                  download={attachment.fileName}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={t.download}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Download className="h-4 w-4" />
                </a>
              )}
              {canDelete(attachment) && (
                <Button
                  type="button"
                  variant={
                    confirmingDeleteId === attachment.id
                      ? "destructive"
                      : "ghost"
                  }
                  size="icon"
                  onClick={() => void confirmDelete(attachment)}
                  disabled={deletingId === attachment.id}
                  aria-label={
                    confirmingDeleteId === attachment.id
                      ? t.confirmDelete
                      : t.delete
                  }
                >
                  {deletingId === attachment.id ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}