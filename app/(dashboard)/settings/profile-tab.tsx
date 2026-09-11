"use client";

import { useEffect, useActionState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2, Save } from "lucide-react";

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
import { updateProfile } from "@/lib/actions/settings";
import {
  initialSettingsActionState,
  profileSchema,
  type ProfileSettingsValues,
  type SettingsActionState,
} from "@/lib/validations/settings";

interface ProfileTabProps {
  profile: { fullName: string | null; jobTitle: string | null };
  userEmail: string;
}

export function ProfileTab({ profile, userEmail }: ProfileTabProps) {
  const [state, formAction, isPending] = useActionState(
    async (_prevState: SettingsActionState, formData: FormData) =>
      updateProfile({
        full_name: String(formData.get("full_name") ?? ""),
        job_title: String(formData.get("job_title") ?? "") || undefined,
      }),
    initialSettingsActionState
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileSettingsValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: profile.fullName ?? "",
      job_title: profile.jobTitle ?? "",
    },
  });

  useEffect(() => {
    if (state.status === "success") {
      reset({
        full_name: profile.fullName ?? "",
        job_title: profile.jobTitle ?? "",
      });
    }
  }, [state.status, profile.fullName, profile.jobTitle, reset]);

  const fullNameError =
    errors.full_name?.message ?? state.fieldErrors?.full_name?.[0];
  const jobTitleError =
    errors.job_title?.message ?? state.fieldErrors?.job_title?.[0];

  async function onSubmit(values: ProfileSettingsValues) {
    const formData = new FormData();
    formData.set("full_name", values.full_name);
    formData.set("job_title", values.job_title ?? "");
    formAction(formData);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Personal Profile</CardTitle>
        <CardDescription>
          Your name and job title are shown to your teammates.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="profile-email">Email</Label>
            <Input
              id="profile-email"
              type="email"
              value={userEmail}
              readOnly
              disabled
              className="bg-muted/50 text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground">
              Your sign-in email cannot be changed here.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-full-name">Full name</Label>
            <Input
              id="profile-full-name"
              placeholder="Jane Smith"
              autoComplete="off"
              aria-invalid={Boolean(fullNameError)}
              {...register("full_name")}
            />
            {fullNameError && (
              <p role="alert" className="text-sm text-destructive">
                {fullNameError}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-job-title">Job title</Label>
            <Input
              id="profile-job-title"
              placeholder="e.g. Account Executive"
              autoComplete="off"
              aria-invalid={Boolean(jobTitleError)}
              {...register("job_title")}
            />
            {jobTitleError && (
              <p role="alert" className="text-sm text-destructive">
                {jobTitleError}
              </p>
            )}
          </div>

          {state.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="animate-spin" /> : <Save />}
              Save changes
            </Button>

            {state.status === "success" && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-4" />
                Profile saved.
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}