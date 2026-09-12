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
import type { InvitationRow } from "./page";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

interface RevokeInvitationDialogProps {
  invitation: InvitationRow;
  error: string | null;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  /** Localized copy for the current render. */
  platform: Dictionary["platform"];
}

export function RevokeInvitationDialog({
  invitation,
  error,
  isPending,
  onCancel,
  onConfirm,
  platform,
}: RevokeInvitationDialogProps) {
  const t = platform.settings;

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.revokeTitle}</DialogTitle>
          <DialogDescription>{t.revokeDescription}</DialogDescription>
        </DialogHeader>

        <p className="break-all rounded-md border bg-muted/50 px-3 py-2 text-sm font-medium">
          {invitation.email}
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
            {t.revokeInvitation}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}