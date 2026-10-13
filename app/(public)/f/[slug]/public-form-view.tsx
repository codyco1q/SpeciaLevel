"use client";

import { useState, useTransition, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Monogram } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSwitcher } from "@/components/locale-switcher";
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
import { Check, CheckCircle2, LoaderCircle, Send, Package, AlertCircle } from "lucide-react";
import { submitPublicForm } from "@/lib/actions/forms";
import type { PublicFormData } from "@/lib/validations/forms";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";
import { cn } from "@/lib/utils";

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
  const searchParams = useSearchParams();
  const paymentStatus = searchParams.get("payment_status");

  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [serverSuccessMessage, setServerSuccessMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const t = dictionary.public;

  const selectedProductsTotal = useMemo(() => {
    return form.fields.reduce((acc, field) => {
      if (field.type !== "product_select" || !field.products) return acc;
      const rawVal = formData[field.id];
      const ids = Array.isArray(rawVal) ? rawVal : rawVal ? [rawVal] : [];
      const fieldSum = field.products
        .filter((p) => ids.includes(p.id))
        .reduce((sum, p) => sum + (Number(p.unitPrice) || 0), 0);
      return acc + fieldSum;
    }, 0);
  }, [form.fields, formData]);

  const handleFieldChange = (fieldId: string, value: any) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
    if (errors[fieldId]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
    }
  };

  const handleMultiSelectToggle = (fieldId: string, option: string) => {
    setFormData((prev) => {
      const currentList: string[] = Array.isArray(prev[fieldId])
        ? [...prev[fieldId]]
        : [];
      const idx = currentList.indexOf(option);
      if (idx > -1) {
        currentList.splice(idx, 1);
      } else {
        currentList.push(option);
      }
      return { ...prev, [fieldId]: currentList };
    });

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
      if (field.type === "custom_html") continue;

      const rawVal = formData[field.id];

      if (field.type === "multiselect") {
        const selectedOptions = Array.isArray(rawVal) ? rawVal : [];
        if (field.required && selectedOptions.length === 0) {
          newErrors[field.id] = t.requiredFieldError;
        }
        continue;
      }

      if (field.type === "product_select") {
        const selected = Array.isArray(rawVal)
          ? rawVal.length > 0
          : Boolean(rawVal);
        if (field.required && !selected) {
          newErrors[field.id] = t.requiredFieldError;
        }
        continue;
      }

      const val = typeof rawVal === "string" ? rawVal.trim() : "";

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
      const payload: Record<string, unknown> = { ...formData };
      if (typeof window !== "undefined") {
        const sp = new URLSearchParams(window.location.search);
        const utmSource = sp.get("utm_source");
        const utmMedium = sp.get("utm_medium");
        const utmCampaign = sp.get("utm_campaign");
        const utmTerm = sp.get("utm_term");
        const utmContent = sp.get("utm_content");

        const tracking: Record<string, string> = {};
        if (utmSource) tracking.utm_source = utmSource;
        if (utmMedium) tracking.utm_medium = utmMedium;
        if (utmCampaign) tracking.utm_campaign = utmCampaign;
        if (utmTerm) tracking.utm_term = utmTerm;
        if (utmContent) tracking.utm_content = utmContent;
        if (document.referrer) tracking.referrer = document.referrer;
        tracking.page_url = window.location.href;

        if (Object.keys(tracking).length > 0) {
          payload._tracking = tracking;
          if (utmSource && !payload.utm_source) payload.utm_source = utmSource;
          if (utmMedium && !payload.utm_medium) payload.utm_medium = utmMedium;
          if (utmCampaign && !payload.utm_campaign) payload.utm_campaign = utmCampaign;
          if (utmTerm && !payload.utm_term) payload.utm_term = utmTerm;
          if (utmContent && !payload.utm_content) payload.utm_content = utmContent;
        }
      }

      const res = await submitPublicForm(form.slug, payload);
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
                {paymentStatus === "success" && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-start gap-3 text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="size-5 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold">Payment Completed Successfully</p>
                      <p className="text-xs mt-0.5 opacity-90">Thank you! Your payment and submission have been recorded.</p>
                    </div>
                  </div>
                )}
                {paymentStatus === "canceled" && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3 text-amber-700 dark:text-amber-300">
                    <AlertCircle className="size-5 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold">Payment Canceled</p>
                      <p className="text-xs mt-0.5 opacity-90">Your payment was not completed. You can re-submit the form below to proceed.</p>
                    </div>
                  </div>
                )}

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
                  {form.fields.map((field) => {
                    if (field.type === "custom_html") {
                      return (
                        <div
                          key={field.id}
                          className="rounded-xl overflow-hidden border border-border/70 bg-muted/20 p-4 text-sm [&_a]:text-primary [&_a]:underline"
                          dangerouslySetInnerHTML={{
                            __html: field.customHtml || field.placeholder || "",
                          }}
                        />
                      );
                    }

                    return (
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
                      ) : field.type === "multiselect" ? (
                        <div className="space-y-2 pt-0.5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {(field.options || []).map((opt) => {
                              const selected = Array.isArray(formData[field.id])
                                ? (formData[field.id] as string[]).includes(opt)
                                : false;
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() =>
                                    handleMultiSelectToggle(field.id, opt)
                                  }
                                  className={cn(
                                    "flex items-center gap-2.5 p-2.5 px-3 rounded-lg border text-xs text-start transition-all cursor-pointer select-none",
                                    selected
                                      ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                                      : "border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:bg-muted/40"
                                  )}
                                >
                                  <div
                                    className={cn(
                                      "size-4 rounded border flex items-center justify-center transition-colors shrink-0",
                                      selected
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : "border-muted-foreground/40 bg-background"
                                    )}
                                  >
                                    {selected && (
                                      <Check className="size-3 stroke-[3]" />
                                    )}
                                  </div>
                                  <span className="truncate">{opt}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : field.type === "product_select" ? (
                        <div className="space-y-2.5 pt-1">
                          <div className="grid grid-cols-1 gap-2.5">
                            {(field.products || []).map((prod) => {
                              const isSelected = field.allowMultiple
                                ? Array.isArray(formData[field.id]) &&
                                  (formData[field.id] as string[]).includes(prod.id)
                                : formData[field.id] === prod.id;

                              const handleProductToggle = () => {
                                if (field.allowMultiple) {
                                  const current: string[] = Array.isArray(formData[field.id])
                                    ? [...(formData[field.id] as string[])]
                                    : [];
                                  const idx = current.indexOf(prod.id);
                                  if (idx > -1) current.splice(idx, 1);
                                  else current.push(prod.id);
                                  handleFieldChange(field.id, current);
                                } else {
                                  handleFieldChange(
                                    field.id,
                                    formData[field.id] === prod.id ? undefined : prod.id
                                  );
                                }
                              };

                              return (
                                <button
                                  key={prod.id}
                                  type="button"
                                  onClick={handleProductToggle}
                                  className={cn(
                                    "flex items-center gap-3.5 p-3 rounded-xl border text-start transition-all cursor-pointer select-none",
                                    isSelected
                                      ? "border-primary bg-primary/5 ring-1 ring-primary shadow-xs"
                                      : "border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:bg-muted/30",
                                    errors[field.id] ? "border-destructive" : ""
                                  )}
                                >
                                  <div
                                    className={cn(
                                      "size-5 flex items-center justify-center transition-colors shrink-0",
                                      field.allowMultiple ? "rounded-md" : "rounded-full",
                                      isSelected
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : "border border-muted-foreground/40 bg-background"
                                    )}
                                  >
                                    {isSelected &&
                                      (field.allowMultiple ? (
                                        <Check className="size-3.5 stroke-[3]" />
                                      ) : (
                                        <div className="size-2 rounded-full bg-primary-foreground" />
                                      ))}
                                  </div>

                                  {prod.imageUrl ? (
                                    <img
                                      src={prod.imageUrl}
                                      alt={prod.title}
                                      className="size-12 rounded-lg object-cover border border-border shrink-0 bg-muted/20"
                                    />
                                  ) : (
                                    <div className="size-12 rounded-lg border border-dashed border-border bg-muted/20 flex items-center justify-center shrink-0 text-muted-foreground/60">
                                      <Package className="size-5" />
                                    </div>
                                  )}

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="font-semibold text-foreground text-sm">
                                        {prod.title}
                                      </span>
                                      <span className="font-mono font-bold text-foreground text-sm shrink-0">
                                        ${Number(prod.unitPrice).toFixed(2)}
                                      </span>
                                    </div>
                                    {prod.description && (
                                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-normal">
                                        {prod.description}
                                      </p>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
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
                  );
                })}
                </div>

                {/* Selected Order Total */}
                {selectedProductsTotal > 0 && (
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-center justify-between shadow-xs">
                    <div>
                      <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                        Order Total
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Includes selected products & packages
                      </p>
                    </div>
                    <div className="text-xl font-bold font-mono text-foreground">
                      ${selectedProductsTotal.toFixed(2)}
                    </div>
                  </div>
                )}

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
                          {form.settings.submitButtonText ||
                            (selectedProductsTotal > 0
                              ? `Pay & Submit ($${selectedProductsTotal.toFixed(2)})`
                              : t.submit)}
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

