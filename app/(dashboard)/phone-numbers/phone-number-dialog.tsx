"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Phone, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  phoneNumberSchema,
  type PhoneNumberFormValues,
} from "@/lib/validations/phone-numbers";
import {
  addPhoneNumber,
  updatePhoneNumber,
  type PhoneNumberWithAgent,
} from "@/lib/actions/phone-numbers";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

interface PhoneNumberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingNumber?: PhoneNumberWithAgent | null;
  agentOptions: { id: string; name: string; email: string | null }[];
  platform: Dictionary["platform"];
}

export function PhoneNumberDialog({
  open,
  onOpenChange,
  editingNumber,
  agentOptions,
  platform,
}: PhoneNumberDialogProps) {
  const t = platform.phoneNumbers.inventory;
  const isEditing = !!editingNumber;
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<PhoneNumberFormValues>({
    resolver: zodResolver(phoneNumberSchema),
    defaultValues: {
      phoneNumber: editingNumber?.phone_number ?? "",
      friendlyName: editingNumber?.friendly_name ?? "",
      capabilities: {
        voice: editingNumber?.capabilities?.voice ?? true,
        sms: editingNumber?.capabilities?.sms ?? true,
      },
      status: editingNumber?.status ?? "active",
      assignedUserId: editingNumber?.assigned_user_id ?? "",
    },
  });

  const onSubmit = (values: PhoneNumberFormValues) => {
    setServerError(null);
    startTransition(async () => {
      const res = isEditing
        ? await updatePhoneNumber(editingNumber.id, values)
        : await addPhoneNumber(values);

      if (res.status === "error") {
        setServerError(res.error ?? "Operation failed");
      } else {
        form.reset();
        onOpenChange(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            <span>{isEditing ? t.editDialogTitle : t.addDialogTitle}</span>
          </DialogTitle>
          <DialogDescription>
            {isEditing ? t.editDialogDesc : t.addDialogDesc}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
          {serverError && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
              {serverError}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="phoneNumber" className="text-xs">
              {t.number} *
            </Label>
            <Input
              id="phoneNumber"
              placeholder={t.phoneNumberPlaceholder}
              {...form.register("phoneNumber")}
              className="font-mono text-sm"
            />
            {form.formState.errors.phoneNumber && (
              <p className="text-[11px] text-destructive">
                {form.formState.errors.phoneNumber.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="friendlyName" className="text-xs">
              {t.friendlyName}
            </Label>
            <Input
              id="friendlyName"
              placeholder={t.friendlyNamePlaceholder}
              {...form.register("friendlyName")}
              className="text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{t.capabilities}</Label>
            <div className="flex items-center gap-6 pt-1">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="voiceCap"
                  checked={form.watch("capabilities.voice")}
                  onCheckedChange={(c) =>
                    form.setValue("capabilities.voice", !!c)
                  }
                />
                <Label htmlFor="voiceCap" className="text-xs font-normal cursor-pointer">
                  {t.voice}
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="smsCap"
                  checked={form.watch("capabilities.sms")}
                  onCheckedChange={(c) =>
                    form.setValue("capabilities.sms", !!c)
                  }
                />
                <Label htmlFor="smsCap" className="text-xs font-normal cursor-pointer">
                  {t.sms}
                </Label>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t.status}</Label>
              <Select
                value={form.watch("status")}
                onValueChange={(val: "active" | "inactive" | "pending") =>
                  form.setValue("status", val)
                }
              >
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active" className="text-xs">{t.active}</SelectItem>
                  <SelectItem value="inactive" className="text-xs">{t.inactive}</SelectItem>
                  <SelectItem value="pending" className="text-xs">{t.pending}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{t.assignedAgent}</Label>
              <Select
                value={form.watch("assignedUserId") || "none"}
                onValueChange={(val) =>
                  form.setValue("assignedUserId", val === "none" ? "" : val)
                }
              >
                <SelectTrigger className="text-xs truncate">
                  <SelectValue placeholder={t.selectAgent} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-xs">
                    {t.unassigned}
                  </SelectItem>
                  {agentOptions.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id} className="text-xs">
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin me-1.5" />
                  {t.saving}
                </>
              ) : (
                t.save
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
