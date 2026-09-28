"use client";

import { useEffect, useState, useTransition, useActionState, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Building2,
  CheckCircle2,
  Globe,
  ImageIcon,
  Loader2,
  Lock,
  MapPin,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
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
import {
  updateOrganizationSettings,
  uploadOrganizationLogo,
  removeOrganizationLogo,
} from "@/lib/actions/organizations";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import {
  CURRENCY_OPTIONS,
  DATE_FORMAT_OPTIONS,
  generalBrandingSchema,
  initialSettingsActionState,
  TIMEZONE_OPTIONS,
  type GeneralBrandingValues,
  type OrganizationSettingsValues,
  type SettingsActionState,
} from "@/lib/validations/organizations";
import type { Organization } from "@/types/database";

interface GeneralBrandingTabProps {
  organization: Organization;
  canManage: boolean;
  platform: Dictionary["platform"];
}

export function GeneralBrandingTab({
  organization,
  canManage,
  platform,
}: GeneralBrandingTabProps) {
  const t = platform.settings;
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(
    organization.logo_url ?? null
  );
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isLogoUploading, startLogoUploadTransition] = useTransition();
  const [logoMessage, setLogoMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [state, formAction, isPending] = useActionState(
    async (_prevState: SettingsActionState, formData: FormData) => {
      const payload: Partial<OrganizationSettingsValues> = {
        name: String(formData.get("name") ?? "").trim(),
        legal_name: String(formData.get("legal_name") ?? "").trim(),
        tax_id: String(formData.get("tax_id") ?? "").trim(),
        website: String(formData.get("website") ?? "").trim(),
        contact_email: String(formData.get("contact_email") ?? "").trim(),
        contact_phone: String(formData.get("contact_phone") ?? "").trim(),
        timezone: String(formData.get("timezone") ?? "").trim(),
        default_currency: String(formData.get("default_currency") ?? "USD"),
        date_format: String(formData.get("date_format") ?? "YYYY-MM-DD"),
        address: {
          street: String(formData.get("address_street") ?? "").trim(),
          city: String(formData.get("address_city") ?? "").trim(),
          state: String(formData.get("address_state") ?? "").trim(),
          country: String(formData.get("address_country") ?? "").trim(),
          postal_code: String(formData.get("address_postal_code") ?? "").trim(),
        },
        logo_url: currentLogoUrl,
      };
      return updateOrganizationSettings(payload);
    },
    initialSettingsActionState
  );

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<GeneralBrandingValues>({
    resolver: zodResolver(generalBrandingSchema),
    defaultValues: {
      name: organization.name ?? "",
      legal_name: organization.legal_name ?? "",
      tax_id: organization.tax_id ?? "",
      website: organization.website ?? "",
      contact_email: organization.contact_email ?? "",
      contact_phone: organization.contact_phone ?? "",
      timezone: organization.timezone || "Africa/Cairo",
      default_currency: organization.default_currency || "USD",
      date_format: organization.date_format || "YYYY-MM-DD",
      address: {
        street: organization.address?.street ?? "",
        city: organization.address?.city ?? "",
        state: organization.address?.state ?? "",
        country: organization.address?.country ?? "",
        postal_code: organization.address?.postal_code ?? "",
      },
    },
  });

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [state.status, router]);

  const handleLogoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setLogoMessage({
        type: "error",
        text: "File size exceeds 5MB.",
      });
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setLogoPreview(objectUrl);
    setLogoMessage(null);

    const formData = new FormData();
    formData.set("file", file);

    startLogoUploadTransition(async () => {
      const res = await uploadOrganizationLogo(formData);
      if (res.status === "success" && res.logoUrl) {
        setCurrentLogoUrl(res.logoUrl);
        setLogoMessage({
          type: "success",
          text: t.logoUploaded || "Logo updated successfully.",
        });
        router.refresh();
      } else {
        setLogoPreview(null);
        setLogoMessage({
          type: "error",
          text: res.error || "Failed to upload logo.",
        });
      }
    });
  };

  const handleRemoveLogo = () => {
    setLogoMessage(null);
    startLogoUploadTransition(async () => {
      const res = await removeOrganizationLogo();
      if (res.status === "success") {
        setCurrentLogoUrl(null);
        setLogoPreview(null);
        setLogoMessage({
          type: "success",
          text: t.logoRemoved || "Logo removed.",
        });
        router.refresh();
      } else {
        setLogoMessage({
          type: "error",
          text: res.error || "Failed to remove logo.",
        });
      }
    });
  };

  async function onSubmit(values: GeneralBrandingValues) {
    const formData = new FormData();
    formData.set("name", values.name);
    if (values.legal_name) formData.set("legal_name", values.legal_name);
    if (values.tax_id) formData.set("tax_id", values.tax_id);
    if (values.website) formData.set("website", values.website);
    if (values.contact_email) formData.set("contact_email", values.contact_email);
    if (values.contact_phone) formData.set("contact_phone", values.contact_phone);
    formData.set("timezone", values.timezone);
    formData.set("default_currency", values.default_currency);
    formData.set("date_format", values.date_format);
    formData.set("address_street", values.address.street);
    formData.set("address_city", values.address.city);
    formData.set("address_state", values.address.state);
    formData.set("address_country", values.address.country);
    formData.set("address_postal_code", values.address.postal_code);
    formAction(formData);
  }

  const displayLogo = logoPreview || currentLogoUrl;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      {/* ── Card 1: Logo & Branding ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ImageIcon className="size-5 text-primary" />
            <CardTitle>{t.brandingTitle || "Branding & Identity"}</CardTitle>
          </div>
          <CardDescription>
            {t.brandingDescription ||
              "Upload your company logo to display on your workspace header, sidebar, and client invoices."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            {/* Logo Preview Container */}
            <div className="relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/30 p-2 shadow-xs transition-colors hover:border-primary/50">
              {displayLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={displayLogo}
                  alt={organization.name}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-muted-foreground">
                  <ImageIcon className="size-8 stroke-[1.5]" />
                  <span className="mt-1 text-[10px] font-medium">No Logo</span>
                </div>
              )}
            </div>

            {/* Logo Actions */}
            <div className="flex flex-1 flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml,image/gif"
                className="hidden"
                disabled={!canManage || isLogoUploading}
                onChange={handleLogoFileSelect}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!canManage || isLogoUploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2"
                >
                  {isLogoUploading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  {t.uploadLogo || "Upload Logo"}
                </Button>

                {displayLogo && canManage && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isLogoUploading}
                    onClick={handleRemoveLogo}
                    className="gap-1.5 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                    {t.removeLogo || "Remove"}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {t.logoHint || "Recommended: Square or horizontal PNG, SVG, or JPG (max 5MB)."}
              </p>
              {logoMessage && (
                <p
                  className={`text-xs font-medium ${
                    logoMessage.type === "success"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-destructive"
                  }`}
                >
                  {logoMessage.text}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      {/* ── Card 2: Company Profile ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="size-5 text-primary" />
            <CardTitle>{t.companyProfileTitle || "Company Profile"}</CardTitle>
          </div>
          <CardDescription>
            {t.companyProfileDescription ||
              "Your public workspace name, registered legal entity, and website."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="org-name">{t.orgName}</Label>
            <Input
              id="org-name"
              placeholder={t.orgNamePlaceholder || "e.g. Acme Studio"}
              disabled={!canManage}
              aria-invalid={Boolean(errors.name)}
              {...register("name")}
            />
            {errors.name && (
              <p role="alert" className="text-xs text-destructive">
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="org-legal-name">{t.legalName || "Legal Registered Name"}</Label>
            <Input
              id="org-legal-name"
              placeholder="e.g. Acme Technologies LLC"
              disabled={!canManage}
              {...register("legal_name")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="org-tax-id">{t.taxId || "Tax / VAT ID"}</Label>
            <Input
              id="org-tax-id"
              placeholder="e.g. 123-456-789 / EG123456"
              disabled={!canManage}
              {...register("tax_id")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="org-website">{t.website || "Website URL"}</Label>
            <Input
              id="org-website"
              placeholder="https://example.com"
              disabled={!canManage}
              {...register("website")}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
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
        </CardContent>
      </Card>

      {/* ── Card 3: Contact & Address ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MapPin className="size-5 text-primary" />
            <CardTitle>{t.contactDetailsTitle || "Contact & Physical Address"}</CardTitle>
          </div>
          <CardDescription>
            {t.contactDetailsDescription ||
              "Official billing email, phone number, and physical office address."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="org-contact-email">{t.contactEmail || "Contact Email"}</Label>
              <Input
                id="org-contact-email"
                type="email"
                placeholder="billing@example.com"
                disabled={!canManage}
                {...register("contact_email")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="org-contact-phone">{t.contactPhone || "Support Phone"}</Label>
              <Input
                id="org-contact-phone"
                placeholder="+20 100 000 0000"
                disabled={!canManage}
                {...register("contact_phone")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="org-street">{t.addressStreet || "Street Address"}</Label>
            <Input
              id="org-street"
              placeholder="e.g. 123 Innovation Blvd, Suite 400"
              disabled={!canManage}
              {...register("address.street")}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="org-city">{t.addressCity || "City"}</Label>
              <Input
                id="org-city"
                placeholder="e.g. Cairo"
                disabled={!canManage}
                {...register("address.city")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="org-state">{t.addressState || "State / Governorate"}</Label>
              <Input
                id="org-state"
                placeholder="e.g. Giza"
                disabled={!canManage}
                {...register("address.state")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="org-postal">{t.addressPostal || "Postal Code"}</Label>
              <Input
                id="org-postal"
                placeholder="e.g. 12511"
                disabled={!canManage}
                {...register("address.postal_code")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="org-country">{t.addressCountry || "Country"}</Label>
            <Input
              id="org-country"
              placeholder="e.g. Egypt / United States"
              disabled={!canManage}
              {...register("address.country")}
            />
          </div>
        </CardContent>
      </Card>
      {/* ── Card 4: Localization & Currency ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="size-5 text-primary" />
            <CardTitle>{t.localizationTitle || "Regional & Localization Defaults"}</CardTitle>
          </div>
          <CardDescription>
            {t.localizationDescription ||
              "Default timezone, base currency for billing, and standard date format display."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
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
                  <SelectTrigger id="org-timezone" className="w-full">
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="org-currency">{t.defaultCurrency || "Base Currency"}</Label>
            <Controller
              name="default_currency"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={!canManage}
                >
                  <SelectTrigger id="org-currency" className="w-full">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="org-date-format">{t.dateFormat || "Date Format"}</Label>
            <Controller
              name="date_format"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={!canManage}
                >
                  <SelectTrigger id="org-date-format" className="w-full">
                    <SelectValue placeholder="Select date format" />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_FORMAT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
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
              {t.orgSaved || "Organization settings saved."}
            </span>
          )}
        </div>
      )}
    </form>
  );
}

