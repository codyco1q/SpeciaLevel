"use client";

import { useActionState, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { submitMarketingLead } from "@/lib/actions/marketing-leads";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import {
  createMarketingLeadSchema,
  initialMarketingLeadState,
  MARKETING_PACKAGE_OPTIONS,
  type MarketingLeadFormValues,
} from "@/lib/validations/marketing-leads";

export function ContactForm({
  dict,
}: {
  dict: Dictionary["contact"]["form"];
}) {
  const [state, formAction, isPending] = useActionState(
    submitMarketingLead,
    initialMarketingLeadState
  );

  const schema = useMemo(() => createMarketingLeadSchema(dict), [dict]);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<MarketingLeadFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      company: "",
      bottleneck: "",
      packageOfInterest: "not-sure",
    },
  });

  async function onSubmit(values: MarketingLeadFormValues) {
    const formData = new FormData();
    formData.set("name", values.name);
    formData.set("email", values.email);
    formData.set("company", values.company);
    formData.set("bottleneck", values.bottleneck);
    formData.set("packageOfInterest", values.packageOfInterest);
    formAction(formData);
  }

  const pending = isPending || isSubmitting;

  function fieldError(field: keyof MarketingLeadFormValues) {
    return errors[field]?.message ?? state.fieldErrors?.[field]?.[0];
  }

  if (state.status === "success") {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-16 text-center">
        <CheckCircle2 className="size-10 text-emerald-400" />
        <h3 className="mt-4 text-xl font-semibold text-foreground">
          {dict.successTitle}
        </h3>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {dict.successBody}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">{dict.nameLabel}</Label>
          <Input
            id="name"
            type="text"
            placeholder={dict.namePlaceholder}
            autoComplete="name"
            aria-invalid={Boolean(fieldError("name"))}
            {...register("name")}
          />
          {fieldError("name") && (
            <p className="text-sm text-destructive">{fieldError("name")}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">{dict.emailLabel}</Label>
          <Input
            id="email"
            type="email"
            placeholder={dict.emailPlaceholder}
            autoComplete="email"
            aria-invalid={Boolean(fieldError("email"))}
            {...register("email")}
          />
          {fieldError("email") && (
            <p className="text-sm text-destructive">{fieldError("email")}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="company">{dict.companyLabel}</Label>
        <Input
          id="company"
          type="text"
          placeholder={dict.companyPlaceholder}
          autoComplete="organization"
          aria-invalid={Boolean(fieldError("company"))}
          {...register("company")}
        />
        {fieldError("company") && (
          <p className="text-sm text-destructive">{fieldError("company")}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="bottleneck">{dict.bottleneckLabel}</Label>
        <Textarea
          id="bottleneck"
          rows={4}
          placeholder={dict.bottleneckPlaceholder}
          aria-invalid={Boolean(fieldError("bottleneck"))}
          {...register("bottleneck")}
        />
        {fieldError("bottleneck") && (
          <p className="text-sm text-destructive">
            {fieldError("bottleneck")}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label id="package-label">{dict.packageLabel}</Label>
        <Controller
          name="packageOfInterest"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger
                aria-labelledby="package-label"
                size="md"
                className="h-9 w-full"
              >
                <SelectValue placeholder={dict.packagePlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {MARKETING_PACKAGE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {dict.packageOptions[option.value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {state.status === "error" && state.error && (
        <Alert variant="destructive">
          <AlertTitle>{dict.errorTitle}</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            {dict.sending}
          </>
        ) : (
          dict.submit
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        {dict.footnote}
      </p>
    </form>
  );
}
