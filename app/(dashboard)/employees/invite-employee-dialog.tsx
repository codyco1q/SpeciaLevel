"use client";

import { useEffect, useActionState } from "react";
import { Controller, useWatch, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createInvitation } from "@/lib/actions/invites";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import {
  initialInviteActionState,
  invitationSchema,
  type InvitationFormValues,
  type InviteActionState,
} from "@/lib/validations/invites";

interface InviteEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: { id: string; name: string; key?: string; isSystem: boolean }[];
  departments: { id: string; name: string }[];
  contacts: {
    id: string;
    name: string;
    email: string;
    company: string | null;
  }[];
  platform: Dictionary["platform"];
}

export function InviteEmployeeDialog({
  open,
  onOpenChange,
  roles,
  departments,
  contacts,
  platform,
}: InviteEmployeeDialogProps) {
  const t = platform.settings;
  const tEmp = platform.employees;
  const [state, formAction, isPending] = useActionState(
    async (_prevState: InviteActionState, formData: FormData) =>
      createInvitation({
        email: String(formData.get("email") ?? ""),
        role_id: String(formData.get("role_id") ?? ""),
        department_id: String(formData.get("department_id") ?? "") || undefined,
        contact_id: String(formData.get("contact_id") ?? "") || undefined,
      }),
    initialInviteActionState
  );

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<InvitationFormValues>({
    resolver: zodResolver(invitationSchema),
    defaultValues: {
      email: "",
      role_id: "",
      department_id: "",
      contact_id: "",
    },
  });

  const watchedRoleId = useWatch({ control, name: "role_id" });
  const isClientRole = roles.some(
    (role) => role.id === watchedRoleId && role.key === "client"
  );

  useEffect(() => {
    if (open) {
      reset({ email: "", role_id: "", department_id: "", contact_id: "" });
    }
  }, [open, reset]);

  useEffect(() => {
    if (state.status === "success") {
      reset({ email: "", role_id: "", department_id: "", contact_id: "" });
      const timeout = setTimeout(() => onOpenChange(false), 600);
      return () => clearTimeout(timeout);
    }
  }, [state.status, reset, onOpenChange]);

  const emailError = errors.email?.message ?? state.fieldErrors?.email?.[0];
  const roleError = errors.role_id?.message ?? state.fieldErrors?.role_id?.[0];
  const departmentError =
    errors.department_id?.message ?? state.fieldErrors?.department_id?.[0];
  const contactError =
    errors.contact_id?.message ?? state.fieldErrors?.contact_id?.[0];

  async function onSubmit(values: InvitationFormValues) {
    const formData = new FormData();
    formData.set("email", values.email);
    formData.set("role_id", values.role_id);
    if (values.department_id) formData.set("department_id", values.department_id);
    if (values.contact_id) formData.set("contact_id", values.contact_id);
    formAction(formData);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tEmp?.inviteEmployee || t.inviteMember}</DialogTitle>
          <DialogDescription>
            {tEmp?.inviteEmployeeDescription || t.inviteMemberDescription}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="employee-invite-email">{t.emailLabel}</Label>
              <Input
                id="employee-invite-email"
                type="email"
                placeholder={t.emailPlaceholder}
                autoComplete="off"
                aria-invalid={Boolean(emailError)}
                {...register("email")}
              />
              {emailError && (
                <p role="alert" className="text-xs text-destructive">
                  {emailError}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="employee-invite-role">{t.roleLabel}</Label>
              <Controller
                control={control}
                name="role_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="employee-invite-role" className="w-full">
                      <SelectValue placeholder={t.selectRole} />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                          {role.isSystem ? t.roleSystemSuffix : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {roleError && (
                <p role="alert" className="text-xs text-destructive">
                  {roleError}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="employee-invite-department">
                {t.departmentLabel}
              </Label>
              <Controller
                control={control}
                name="department_id"
                render={({ field }) => (
                  <Select
                    value={field.value || "none"}
                    onValueChange={(value) =>
                      field.onChange(value === "none" ? "" : value)
                    }
                  >
                    <SelectTrigger id="employee-invite-department" className="w-full">
                      <SelectValue placeholder={t.noDepartment} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t.noDepartment}</SelectItem>
                      {departments.map((department) => (
                        <SelectItem key={department.id} value={department.id}>
                          {department.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {departmentError && (
                <p role="alert" className="text-xs text-destructive">
                  {departmentError}
                </p>
              )}
            </div>

            {isClientRole && (
              <div className="space-y-1.5">
                <Label htmlFor="employee-invite-contact">
                  {t.clientContactLabel}
                </Label>
                <Controller
                  control={control}
                  name="contact_id"
                  render={({ field }) => (
                    <Select
                      value={field.value || "none"}
                      onValueChange={(value) =>
                        field.onChange(value === "none" ? "" : value)
                      }
                    >
                      <SelectTrigger id="employee-invite-contact" className="w-full">
                        <SelectValue placeholder={t.noClientContact} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t.noClientContact}</SelectItem>
                        {contacts.map((contact) => (
                          <SelectItem key={contact.id} value={contact.id}>
                            {contact.name}
                            {contact.company ? ` — ${contact.company}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {contactError && (
                  <p role="alert" className="text-xs text-destructive">
                    {contactError}
                  </p>
                )}
              </div>
            )}
          </div>

          {state.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}

          {state.status === "success" && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="size-4 shrink-0" />
              {t.invitationSent}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {platform.common.cancel}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="animate-spin" /> : <UserPlus />}
              {t.sendInvitation}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

