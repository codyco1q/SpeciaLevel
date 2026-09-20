"use client";

import { useState, useTransition } from "react";
import { Monogram } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSwitcher } from "@/components/marketing/locale-switcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, LoaderCircle, Send } from "lucide-react";
import { submitPublicForm } from "@/lib/actions/forms";
import type { PublicFormData } from "@/lib/validations/forms";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

interface PublicFormViewProps {
  form: PublicFormData;
  dictionary: Dictionary["platform"]["forms"];
  langSwitcher: Dictionary["langSwitcher"];
  locale: Locale;
}

export function PublicFormView({
  form,
  dictionary,
  langSwitcher,
  locale,
}: PublicFormViewProps) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [serverSuccessMessage, setServerSuccessMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const t = dictionary.public;

  const handleFieldChange = (fieldId: string, value: string) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
    if (errors[fieldId]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    for (const field of form.fields) {
      const val = formData[field.id]?.trim() || "";

      if (field.required && !val) {
        newErrors[field.id] = t.requiredFieldError;
        continue;
      }

      if (val && field.type === "email") {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(val)) {
          newErrors[field.id] = t.invalidEmailError;
        }
      }

      if (val && field.type === "number") {
        if (isNaN(Number(val))) {
          newErrors[field.id] = t.invalidNumberError;
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) return;

    startTransition(async () => {
      const res = await submitPublicForm(form.slug, formData);
      if (res.status === "success") {
        if (res.redirectUrl) {
          window.location.href = res.redirectUrl;
          return;
        }
        setServerSuccessMessage(
          res.successMessage || form.settings.successMessage
        );
        setSubmitted(true);
      } else {
        setServerError(res.error || "Failed to submit. Please try again.");
      }
    });
  };
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground antialiased selection:bg-primary/20">
      {/* Top Header */}
      <header className="border-b border-border bg-card/60 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Monogram className="size-8 rounded-lg" />
            <div>
              <p className="text-sm font-bold tracking-tight">
                {form.organizationName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LocaleSwitcher locale={locale} dict={langSwitcher} />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Form Container */}
      <main className="flex flex-1 items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-xl">
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-10 shadow-lg transition-all">
            {submitted ? (
              <div className="py-8 text-center">
                <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-8" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight">
                  {t.submittedSuccess}
                </h2>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
                  {serverSuccessMessage || form.settings.successMessage}
                </p>
                <div className="mt-8">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFormData({});
                      setSubmitted(false);
                    }}
                  >
                    Submit another response
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Form Header */}
                <div className="border-b border-border pb-5">
                  <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                    {form.title}
                  </h1>
                  {form.description && (
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {form.description}
                    </p>
                  )}
                </div>

                {serverError && (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive font-medium">
                    {serverError}
                  </div>
                )}

                {/* Form Fields */}
                <div className="space-y-4">
                  {form.fields.map((field) => (
                    <div key={field.id} className="space-y-1.5">
                      <Label
                        htmlFor={field.id}
                        className="text-xs font-semibold"
                      >
                        {field.label}
                        {field.required && (
                          <span className="text-destructive ml-1">*</span>
                        )}
                      </Label>

                      {field.type === "textarea" ? (
                        <Textarea
                          id={field.id}
                          rows={4}
                          value={formData[field.id] || ""}
                          onChange={(e) =>
                            handleFieldChange(field.id, e.target.value)
                          }
                          placeholder={field.placeholder || ""}
                          className={
                            errors[field.id] ? "border-destructive" : ""
                          }
                        />
                      ) : field.type === "select" ? (
                        <Select
                          value={formData[field.id] || ""}
                          onValueChange={(val) =>
                            handleFieldChange(field.id, val)
                          }
                        >
                          <SelectTrigger
                            id={field.id}
                            className={
                              errors[field.id] ? "border-destructive" : ""
                            }
                          >
                            <SelectValue
                              placeholder={
                                field.placeholder || t.selectPlaceholder
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {(field.options || []).map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          id={field.id}
                          type={
                            field.type === "email"
                              ? "email"
                              : field.type === "phone"
                              ? "tel"
                              : field.type === "number"
                              ? "number"
                              : "text"
                          }
                          value={formData[field.id] || ""}
                          onChange={(e) =>
                            handleFieldChange(field.id, e.target.value)
                          }
                          placeholder={field.placeholder || ""}
                          className={
                            errors[field.id] ? "border-destructive" : ""
                          }
                        />
                      )}

                      {field.helpText && (
                        <p className="text-[11px] text-muted-foreground">
                          {field.helpText}
                        </p>
                      )}

                      {errors[field.id] && (
                        <p className="text-xs font-medium text-destructive">
                          {errors[field.id]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Submit Button */}
                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={isPending}
                    className="w-full h-11 text-sm font-semibold gap-2"
                  >
                    {isPending ? (
                      <>
                        <LoaderCircle className="size-4 animate-spin" />
                        <span>{t.submitting}</span>
                      </>
                    ) : (
                      <>
                        <span>
                          {form.settings.submitButtonText || t.submit}
                        </span>
                        <Send className="size-4 rtl:rotate-180" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </div>

          {/* Footer Branding */}
          <div className="mt-6 text-center text-xs text-muted-foreground">
            <span>{t.poweredBy} </span>
            <span className="font-semibold text-foreground">SpeciaLevel</span>
          </div>
        </div>
      </main>
    </div>
  );
}

