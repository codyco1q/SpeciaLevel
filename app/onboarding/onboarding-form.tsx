"use client";

import { useActionState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createOrganization } from "@/lib/actions/onboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  initialOnboardingState,
  onboardingSchema,
  type OnboardingFormValues,
} from "@/lib/validations/onboarding";

interface OnboardingFormProps {
  email: string;
  fullName?: string | null;
}

export default function OnboardingForm({
  email,
  fullName,
}: OnboardingFormProps) {
  const [state, formAction, isPending] = useActionState(
    createOrganization,
    initialOnboardingState
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: { organizationName: "" },
  });

  // Zod validation happens client-side here; the server action re-validates.
  async function onSubmit(values: OnboardingFormValues) {
    const formData = new FormData();
    formData.set("organizationName", values.organizationName);
    formAction(formData);
  }

  const fieldError = errors.organizationName?.message;
  const serverFieldError = state.fieldErrors?.organizationName?.[0];
  const pending = isPending || isSubmitting;

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm"
    >
      <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        Setting up the workspace for{" "}
        <span className="font-medium text-foreground">
          {fullName || "you"}
        </span>{" "}
        · {email}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="organizationName"
          className="text-sm font-medium"
        >
          Organization Name
        </label>
        <Input
          id="organizationName"
          type="text"
          placeholder="Acme Inc."
          autoComplete="organization"
          autoFocus
          aria-invalid={Boolean(fieldError ?? serverFieldError)}
          {...register("organizationName")}
        />
        {(fieldError ?? serverFieldError) && (
          <p className="text-sm text-destructive">
            {fieldError ?? serverFieldError}
          </p>
        )}
      </div>

      {state.status === "error" && state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <Button
        type="submit"
        disabled={pending}
        className="w-full"
        size="lg"
      >
        {pending ? "Setting up your workspace…" : "Create organization"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        You&apos;ll be the <span className="font-medium">Owner</span> of this
        organization and can invite teammates from Settings.
      </p>
    </form>
  );
}