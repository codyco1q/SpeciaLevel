"use client";

import { useTransition } from "react";
import { deleteContact, type ContactSummaryRow } from "@/lib/actions/contacts";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";

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
    <DeleteConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t.deleteContactDialog.title}
      description={t.deleteContactDialog.description.replace("{name}", contact.name)}
      onConfirm={handleDelete}
      isDeleting={isPending}
    />
  );
}
