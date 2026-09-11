"use client";

import { useEffect, useActionState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2, Lock, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateOrganizationSettings } from "@/lib/actions/settings";
import {
  initialSettingsActionState,
  organizationSettingsSchema,
  TIMEZONE_OPTIONS,
  type OrganizationSettingsValues,
  type SettingsActionState,
} from "@/lib/validations/settings";

interface GeneralSettingsTabProps {
  organization: { id: string; name: string; slug: string; timezone: string };
  canManage: boolean;
}

export function GeneralSettingsTab({
  organization,
  canManage,
}: GeneralSettingsTabProps) {
  const [state, formAction, isPending] = useActionState(
    async (_prevState: SettingsActionState, formData: FormData) =>
      updateOrganizationSettings({
        name: String(formData.get("name") ?? ""),
        timezone: String(formData.get("timezone") ?? ""),
      }),
    initialSettingsActionState
  );

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<OrganizationSettingsValues>({
    resolver: zodResolver(organizationSettingsSchema),
    defaultValues: {
      name: organization.name,
      timezone: organization.timezone,
    },
  });

  // After a successful save the server re-renders with fresh data, so
  // re-sync the form with the persisted values.
  useEffect(() => {
    if (state.status === "success") {
      reset({
        name: organization.name,
        timezone: organization.timezone,
      });
    }
  }, [state.status, organization.name, organization.timezone, reset]);

  const nameError = errors.name?.message ?? state.fieldErrors?.name?.[0];
  const timezoneError =
    errors.timezone?.message ?? state.fieldErrors?.timezone?.[0];

  async function onSubmit(values: OrganizationSettingsValues) {
    const formData = new FormData();
    formData.set("name", values.name);
    formData.set("timezone", values.timezone);
    formAction(formData);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>General Settings</CardTitle>
        <CardDescription>
          Update your organization&apos;s name and default timezone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <fieldset disabled={!canManage} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization name</Label>
              <Input
                id="org-name"
                placeholder="e.g. Acme Inc."
                autoComplete="off"
                aria-invalid={Boolean(nameError)}
                {...register("name")}
              />
              {nameError && (
                <p role="alert" className="text-sm text-destructive">
                  {nameError}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-slug">Organization URL</Label>
              <Input
                id="org-slug"
                value={organization.slug}
                readOnly
                disabled
                className="bg-muted/50 text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground">
                Used in your organization&apos;s unique URL and cannot be
                changed.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="org-timezone">Timezone</Label>
              <Controller
                name="timezone"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={!canManage}
                  >
                    <SelectTrigger id="org-timezone" className="w-full sm:w-96">
                      <SelectValue placeholder="Select a timezone" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {TIMEZONE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {timezoneError && (
                <p role="alert" className="text-sm text-destructive">
                  {timezoneError}
                </p>
              )}
            </div>

            {state.error && (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            )}
          </fieldset>

          {!canManage && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-muted/50 px-4 py-3">
              <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                You can view these settings, but don&apos;t have permission to
                change them.
              </p>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {canManage && (
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Save />
                )}
                Save changes
              </Button>
            )}

            {state.status === "success" && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-4" />
                Organization settings saved.
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}