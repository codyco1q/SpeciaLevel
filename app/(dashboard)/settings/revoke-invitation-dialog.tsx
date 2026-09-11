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

interface RevokeInvitationDialogProps {
  invitation: InvitationRow;
  error: string | null;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function RevokeInvitationDialog({
  invitation,
  error,
  isPending,
  onCancel,
  onConfirm,
}: RevokeInvitationDialogProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Revoke invitation?</DialogTitle>
          <DialogDescription>
            Revoking this invitation invalidates its signup link immediately.
          </DialogDescription>
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
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
            Revoke invitation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}