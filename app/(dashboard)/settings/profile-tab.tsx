"use client";

import { useEffect, useActionState, useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2, Save, Upload, Trash2, Camera, User } from "lucide-react";

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
import { DashboardLocaleSwitcher } from "@/components/dashboard/locale-switcher";
import { updateProfile, uploadProfileAvatar, removeProfileAvatar } from "@/lib/actions/settings";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";
import {
  initialSettingsActionState,
  profileSchema,
  TIMEZONE_OPTIONS,
  type ProfileSettingsValues,
  type SettingsActionState,
} from "@/lib/validations/settings";

interface ProfileTabProps {
  profile: {
    fullName: string | null;
    jobTitle: string | null;
    avatarUrl?: string | null;
    timezone?: string | null;
  };
  userEmail: string;
  /** Localized copy + formatters for the current render. */
  platform: Dictionary["platform"];
  locale: Locale;
}

export function ProfileTab({ profile, userEmail, platform, locale }: ProfileTabProps) {
  const router = useRouter();
  const t = platform.settings;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(
    profile.avatarUrl ?? null
  );
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarMessage, setAvatarMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isAvatarUploading, startAvatarUploadTransition] = useTransition();

  const [state, formAction, isPending] = useActionState(
    async (_prevState: SettingsActionState, formData: FormData) =>
      updateProfile({
        full_name: String(formData.get("full_name") ?? ""),
        job_title: String(formData.get("job_title") ?? "") || undefined,
        timezone: String(formData.get("timezone") ?? "") || undefined,
      }),
    initialSettingsActionState
  );

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileSettingsValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: profile.fullName ?? "",
      job_title: profile.jobTitle ?? "",
      timezone: profile.timezone ?? "",
    },
  });

  useEffect(() => {
    if (state.status === "success") {
      reset({
        full_name: profile.fullName ?? "",
        job_title: profile.jobTitle ?? "",
        timezone: profile.timezone ?? "",
      });
    }
  }, [state.status, profile.fullName, profile.jobTitle, profile.timezone, reset]);

  const fullNameError =
    errors.full_name?.message ?? state.fieldErrors?.full_name?.[0];
  const jobTitleError =
    errors.job_title?.message ?? state.fieldErrors?.job_title?.[0];

  const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setAvatarMessage({
        type: "error",
        text: "File size exceeds 5MB.",
      });
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setAvatarPreview(objectUrl);
    setAvatarMessage(null);

    const formData = new FormData();
    formData.set("file", file);

    startAvatarUploadTransition(async () => {
      const res = await uploadProfileAvatar(formData);
      if (res.status === "success" && res.avatarUrl) {
        setCurrentAvatarUrl(res.avatarUrl);
        setAvatarMessage({
          type: "success",
          text: "Profile picture updated successfully.",
        });
        router.refresh();
      } else {
        setAvatarPreview(null);
        setAvatarMessage({
          type: "error",
          text: res.error || "Failed to upload profile picture.",
        });
      }
    });
  };

  const handleRemoveAvatar = () => {
    setAvatarMessage(null);
    startAvatarUploadTransition(async () => {
      const res = await removeProfileAvatar();
      if (res.status === "success") {
        setCurrentAvatarUrl(null);
        setAvatarPreview(null);
        setAvatarMessage({
          type: "success",
          text: "Profile picture removed.",
        });
        router.refresh();
      } else {
        setAvatarMessage({
          type: "error",
          text: res.error || "Failed to remove profile picture.",
        });
      }
    });
  };

  async function onSubmit(values: ProfileSettingsValues) {
    const formData = new FormData();
    formData.set("full_name", values.full_name);
    formData.set("job_title", values.job_title ?? "");
    formData.set("timezone", values.timezone ?? "");
    formAction(formData);
  }

  const displayAvatar = avatarPreview || currentAvatarUrl;

  return (
    <>
      <Card>
      <CardHeader>
        <CardTitle>{t.profileTitle}</CardTitle>
        <CardDescription>{t.profileDescription}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Profile Picture Upload Section */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 border-b border-border/80 pb-6">
          <div className="relative flex size-20 shrink-0 aspect-square items-center justify-center overflow-hidden rounded-full border-2 border-border/80 bg-muted shadow-sm">
            {displayAvatar ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={displayAvatar}
                alt={profile.fullName || "User Avatar"}
                className="size-full aspect-square object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-muted-foreground">
                <User className="size-8 stroke-[1.5]" />
              </div>
            )}
          </div>

          <div className="flex flex-1 flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
              className="hidden"
              disabled={isAvatarUploading}
              onChange={handleAvatarFileSelect}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isAvatarUploading}
                onClick={() => fileInputRef.current?.click()}
                className="gap-2"
              >
                {isAvatarUploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Camera className="size-4" />
                )}
                Upload Picture
              </Button>

              {displayAvatar && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isAvatarUploading}
                  onClick={handleRemoveAvatar}
                  className="gap-1.5 text-destructive hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                  Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Recommended: Square JPG, PNG, or WebP (max 5MB).
            </p>
            {avatarMessage && (
              <p
                className={`text-xs font-medium ${
                  avatarMessage.type === "success"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-destructive"
                }`}
              >
                {avatarMessage.text}
              </p>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="profile-email">{t.emailLabel}</Label>
            <Input
              id="profile-email"
              type="email"
              value={userEmail}
              readOnly
              disabled
              className="bg-muted/50 text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground">{t.emailHint}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-full-name">{t.fullName}</Label>
            <Input
              id="profile-full-name"
              placeholder={t.fullNamePlaceholder}
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
            <Label htmlFor="profile-job-title">{t.jobTitle}</Label>
            <Input
              id="profile-job-title"
              placeholder={t.jobTitlePlaceholder}
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

          <div className="space-y-2">
            <Label htmlFor="profile-timezone">{t.timezoneLabel ?? t.timezone ?? "Timezone"}</Label>
            <Controller
              name="timezone"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value || undefined}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger id="profile-timezone" className="w-full">
                    <SelectValue placeholder={t.selectTimezone ?? "Select timezone"} />
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
            <p className="text-xs text-muted-foreground">
              {locale === "ar"
                ? "تحديد منطقتك الزمنية لعرض الأوقات والتواريخ بدقة عبر المنصة."
                : "Used for scheduling appointments, calendar events, and displaying localized timestamps."}
            </p>
          </div>

          {state.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="animate-spin" /> : <Save />}
              {platform.common.saveChanges}
            </Button>

            {state.status === "success" && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-4" />
                {t.profileSaved}
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>

    <Card className="mt-6">
      <CardHeader>
        <CardTitle>{t.languageLabel}</CardTitle>
        <CardDescription>{t.languageHint}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="w-full max-w-sm">
          <DashboardLocaleSwitcher
            locale={locale}
            label={t.languageLabel}
            english={t.languageEnglish}
            arabic={t.languageArabic}
          />
        </div>
      </CardContent>
    </Card>
    </>
  );
}