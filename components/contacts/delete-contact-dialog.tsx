"use client";

import { useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteContact, type ContactSummaryRow } from "@/lib/actions/contacts";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

interface DeleteContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: { id: string; name: string } | null;
  onDeleted: () => void;
  platform: Dictionary["platform"];
}

export function DeleteContactDialog({
  open,
  onOpenChange,
  contact,
  onDeleted,
  platform,
}: DeleteContactDialogProps) {
  const t = platform.crm;
  const common = platform.common;
  const [isPending, startTransition] = useTransition();

  if (!contact) return null;

  const handleDelete = () => {
    startTransition(async () => {
      const res = await deleteContact(contact.id);
      if (res.status === "success") {
        onDeleted();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.deleteContactDialog.title}</DialogTitle>
          <DialogDescription>
            {t.deleteContactDialog.description.replace("{name}", contact.name)}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {common.cancel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending && <LoaderCircle className="me-2 size-4 animate-spin" />}
            {common.delete}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
