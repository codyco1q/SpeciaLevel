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
import type { Dictionary } from "@/lib/i18n/get-dictionary";
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
  /** Localized copy for the current render. */
  platform: Dictionary["platform"];
}

export function GeneralSettingsTab({
  organization,
  canManage,
  platform,
}: GeneralSettingsTabProps) {
  const t = platform.settings;
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
        <CardTitle>{t.generalTitle}</CardTitle>
        <CardDescription>{t.generalDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <fieldset disabled={!canManage} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">{t.orgName}</Label>
              <Input
                id="org-name"
                placeholder={t.orgNamePlaceholder}
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
              <Label htmlFor="org-slug">{t.orgUrl}</Label>
              <Input
                id="org-slug"
                value={organization.slug}
                readOnly
                disabled
                className="bg-muted/50 text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground">{t.orgUrlHint}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="org-timezone">{t.timezone}</Label>
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
                      <SelectValue placeholder={t.selectTimezone} />
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
              <p className="text-sm text-muted-foreground">{t.noManageNote}</p>
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
                {platform.common.saveChanges}
              </Button>
            )}

            {state.status === "success" && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-4" />
                {t.orgSaved}
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}