"use client";

import { useEffect, useActionState } from "react";
import { Controller, useForm } from "react-hook-form";
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
import {
  initialInviteActionState,
  invitationSchema,
  type InvitationFormValues,
  type InviteActionState,
} from "@/lib/validations/invites";

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: { id: string; name: string; isSystem: boolean }[];
  departments: { id: string; name: string }[];
}

export function InviteMemberDialog({
  open,
  onOpenChange,
  roles,
  departments,
}: InviteMemberDialogProps) {
  const [state, formAction, isPending] = useActionState(
    async (_prevState: InviteActionState, formData: FormData) =>
      createInvitation({
        email: String(formData.get("email") ?? ""),
        role_id: String(formData.get("role_id") ?? ""),
        department_id: String(formData.get("department_id") ?? "") || undefined,
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
    defaultValues: { email: "", role_id: "", department_id: "" },
  });

  // Reset the form every time the dialog opens.
  useEffect(() => {
    if (open) {
      reset({ email: "", role_id: "", department_id: "" });
    }
  }, [open, reset]);

  // Close shortly after a successful save.
  useEffect(() => {
    if (state.status === "success") {
      reset({ email: "", role_id: "", department_id: "" });
      const timeout = setTimeout(() => onOpenChange(false), 500);
      return () => clearTimeout(timeout);
    }
  }, [state.status, reset, onOpenChange]);

  const emailError = errors.email?.message ?? state.fieldErrors?.email?.[0];
  const roleError = errors.role_id?.message ?? state.fieldErrors?.role_id?.[0];
  const departmentError =
    errors.department_id?.message ?? state.fieldErrors?.department_id?.[0];

  async function onSubmit(values: InvitationFormValues) {
    const formData = new FormData();
    formData.set("email", values.email);
    formData.set("role_id", values.role_id);
    formData.set("department_id", values.department_id ?? "");
    formAction(formData);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite a member</DialogTitle>
          <DialogDescription>
            They&apos;ll get a signup link with a role and optional department.
            The link expires in 7 days.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="teammate@example.com"
              autoComplete="off"
              aria-invalid={Boolean(emailError)}
              {...register("email")}
            />
            {emailError && (
              <p role="alert" className="text-sm text-destructive">
                {emailError}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <Controller
                control={control}
                name="role_id"
                render={({ field }) => (
                  <Select
                    value={field.value || "none"}
                    onValueChange={(value) =>
                      field.onChange(value === "none" ? "" : value)
                    }
                  >
                    <SelectTrigger id="invite-role" className="w-full">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select a role</SelectItem>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                          {role.isSystem ? " (system)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {roleError && (
                <p role="alert" className="text-sm text-destructive">
                  {roleError}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-department">Department (optional)</Label>
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
                    <SelectTrigger id="invite-department" className="w-full">
                      <SelectValue placeholder="No department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No department</SelectItem>
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
                <p role="alert" className="text-sm text-destructive">
                  {departmentError}
                </p>
              )}
            </div>
          </div>

          {state.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}

          {state.status === "success" && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="size-4 shrink-0" />
              Invitation sent — share the link from the list.
            </div>
          )}

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="animate-spin" /> : <UserPlus />}
              Send invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}