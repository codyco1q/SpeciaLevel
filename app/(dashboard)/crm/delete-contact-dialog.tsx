"use client";

import { AlertTriangle, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ContactSummaryRow } from "@/lib/actions/crm-contacts";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

interface DeleteContactDialogProps {
  contact: ContactSummaryRow;
  error: string | null;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  /** Localized copy for the current render. */
  platform: Dictionary["platform"];
}

/** Confirm-destroy dialog for a directory row (manage-only). */
export function DeleteContactDialog({
  contact,
  error,
  isPending,
  onCancel,
  onConfirm,
  platform,
}: DeleteContactDialogProps) {
  const t = platform.crm;

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.deleteContactDialog.title}</DialogTitle>
          <DialogDescription>
            {t.deleteContactDialog.description.replace("{name}", contact.name)}
          </DialogDescription>
        </DialogHeader>

        <p className="rounded-md border bg-muted/50 px-3 py-2 text-sm font-medium">
          {contact.name}
        </p>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {error}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            {platform.common.cancel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
            {t.deleteContactDialog.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}