"use client";

import { useEffect, useActionState } from "react";
import { Controller, useForm } from "react-hook-form";
import { CheckCircle2, CreditCard, Landmark, Loader2, Lock, Receipt, Save } from "lucide-react";
import { useRouter } from "next/navigation";

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
import { updateOrganizationSettings } from "@/lib/actions/organizations";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import {
  initialSettingsActionState,
  PAYMENT_TERMS_OPTIONS,
  type SettingsActionState,
} from "@/lib/validations/organizations";
import type { Organization } from "@/types/database";

interface BillingDefaultsTabProps {
  organization: Organization;
  canManage: boolean;
  platform: Dictionary["platform"];
}

interface BillingDefaultsFormValues {
  payment_terms: string;
  default_tax_rate: number;
  bank_name: string;
  iban: string;
  swift: string;
  instructions: string;
}

export function BillingDefaultsTab({
  organization,
  canManage,
  platform,
}: BillingDefaultsTabProps) {
  const t = platform.settings;
  const router = useRouter();

  const currentBilling = organization.billing_defaults ?? {
    payment_terms: "net_30",
    default_tax_rate: 0,
    bank_name: "",
    iban: "",
    swift: "",
    instructions: "",
  };

  const [state, formAction, isPending] = useActionState(
    async (_prevState: SettingsActionState, formData: FormData) => {
      const paymentTerms = String(formData.get("payment_terms") ?? "net_30");
      const taxRate = Number(formData.get("default_tax_rate") ?? 0);
      const bankName = String(formData.get("bank_name") ?? "").trim();
      const iban = String(formData.get("iban") ?? "").trim();
      const swift = String(formData.get("swift") ?? "").trim();
      const instructions = String(formData.get("instructions") ?? "").trim();

      return updateOrganizationSettings({
        name: organization.name,
        timezone: organization.timezone,
        billing_defaults: {
          payment_terms: paymentTerms,
          default_tax_rate: isNaN(taxRate) ? 0 : taxRate,
          bank_name: bankName,
          iban: iban,
          swift: swift,
          instructions: instructions,
        },
      });
    },
    initialSettingsActionState
  );

  const { register, handleSubmit, control } = useForm<BillingDefaultsFormValues>({
    defaultValues: {
      payment_terms: currentBilling.payment_terms || "net_30",
      default_tax_rate: currentBilling.default_tax_rate ?? 0,
      bank_name: currentBilling.bank_name ?? "",
      iban: currentBilling.iban ?? "",
      swift: currentBilling.swift ?? "",
      instructions: currentBilling.instructions ?? "",
    },
  });

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [state.status, router]);

  async function onSubmit(values: BillingDefaultsFormValues) {
    const formData = new FormData();
    formData.set("payment_terms", values.payment_terms);
    formData.set("default_tax_rate", String(values.default_tax_rate));
    formData.set("bank_name", values.bank_name);
    formData.set("iban", values.iban);
    formData.set("swift", values.swift);
    formData.set("instructions", values.instructions);
    formAction(formData);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      {/* ── Card 1: Default Invoicing Terms ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Receipt className="size-5 text-primary" />
            <CardTitle>{t.invoicingDefaultsTitle || "Invoicing & Tax Defaults"}</CardTitle>
          </div>
          <CardDescription>
            {t.invoicingDefaultsDescription ||
              "Set standard payment terms and default tax rates used to pre-fill all newly generated client invoices."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="payment-terms">{t.paymentTermsLabel || "Default Payment Terms"}</Label>
            <Controller
              name="payment_terms"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={!canManage}
                >
                  <SelectTrigger id="payment-terms" className="w-full">
                    <SelectValue placeholder="Select terms" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TERMS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tax-rate">{t.defaultTaxRateLabel || "Default Tax / VAT Rate (%)"}</Label>
            <Input
              id="tax-rate"
              type="number"
              step="0.01"
              min="0"
              max="100"
              placeholder="e.g. 14 for Egypt VAT / 0"
              disabled={!canManage}
              {...register("default_tax_rate")}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Card 2: Bank Transfer Instructions ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Landmark className="size-5 text-primary" />
            <CardTitle>{t.bankDetailsTitle || "Bank Transfer & Wire Instructions"}</CardTitle>
          </div>
          <CardDescription>
            {t.bankDetailsDescription ||
              "Official bank details displayed on client invoice PDFs and public payment checkout pages."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bank-name">{t.bankNameLabel || "Bank Name"}</Label>
            <Input
              id="bank-name"
              placeholder="e.g. Commercial International Bank (CIB) / JPMorgan Chase"
              disabled={!canManage}
              {...register("bank_name")}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="iban">{t.ibanLabel || "IBAN / Account Number"}</Label>
              <Input
                id="iban"
                placeholder="EG123456789012345678901234"
                disabled={!canManage}
                {...register("iban")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="swift">{t.swiftLabel || "SWIFT / BIC Code"}</Label>
              <Input
                id="swift"
                placeholder="e.g. CIBEEGCA"
                disabled={!canManage}
                {...register("swift")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="instructions">{t.paymentMemoLabel || "Payment Instructions / Notes"}</Label>
            <Input
              id="instructions"
              placeholder="e.g. Please include invoice number in wire transfer description."
              disabled={!canManage}
              {...register("instructions")}
            />
          </div>
        </CardContent>
      </Card>

      {!canManage && (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/50 px-4 py-3">
          <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t.noManageNote}</p>
        </div>
      )}

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      {canManage && (
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isPending} className="gap-2">
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {platform.common.saveChanges}
          </Button>

          {state.status === "success" && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-4" />
              {t.billingSaved || "Billing defaults saved."}
            </span>
          )}
        </div>
      )}
    </form>
  );
}
