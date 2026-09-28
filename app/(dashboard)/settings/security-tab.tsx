"use client";

import { useEffect, useActionState } from "react";
import { Controller, useForm } from "react-hook-form";
import { CheckCircle2, Globe, Loader2, Lock, Save, ShieldCheck, Timer } from "lucide-react";
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
  SESSION_TIMEOUT_OPTIONS,
  type SettingsActionState,
} from "@/lib/validations/organizations";
import type { Organization } from "@/types/database";

interface SecurityTabProps {
  organization: Organization;
  canManage: boolean;
  platform: Dictionary["platform"];
}

interface SecurityFormValues {
  allowed_domains_text: string;
  session_timeout_minutes: number;
  prevent_member_deletion: boolean;
}

export function SecurityTab({
  organization,
  canManage,
  platform,
}: SecurityTabProps) {
  const t = platform.settings;
  const router = useRouter();

  const currentSecurity = organization.security_settings ?? {
    allowed_domains: [],
    session_timeout_minutes: 0,
    prevent_member_deletion: false,
  };

  const [state, formAction, isPending] = useActionState(
    async (_prevState: SettingsActionState, formData: FormData) => {
      const rawDomains = String(formData.get("allowed_domains_text") ?? "");
      const domains = rawDomains
        .split(",")
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean);

      const timeout = Number(formData.get("session_timeout_minutes") ?? 0);
      const preventDeletion = formData.get("prevent_member_deletion") === "on";

      return updateOrganizationSettings({
        name: organization.name,
        timezone: organization.timezone,
        security_settings: {
          allowed_domains: domains,
          session_timeout_minutes: timeout,
          prevent_member_deletion: preventDeletion,
        },
      });
    },
    initialSettingsActionState
  );

  const { register, handleSubmit, control } = useForm<SecurityFormValues>({
    defaultValues: {
      allowed_domains_text: (currentSecurity.allowed_domains || []).join(", "),
      session_timeout_minutes: currentSecurity.session_timeout_minutes ?? 0,
      prevent_member_deletion: currentSecurity.prevent_member_deletion ?? false,
    },
  });

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [state.status, router]);

  async function onSubmit(values: SecurityFormValues) {
    const formData = new FormData();
    formData.set("allowed_domains_text", values.allowed_domains_text);
    formData.set(
      "session_timeout_minutes",
      String(values.session_timeout_minutes)
    );
    if (values.prevent_member_deletion) {
      formData.set("prevent_member_deletion", "on");
    }
    formAction(formData);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      {/* ── Card 1: Allowed Email Domains ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="size-5 text-primary" />
            <CardTitle>{t.allowedDomainsTitle || "Allowed Login Domains"}</CardTitle>
          </div>
          <CardDescription>
            {t.allowedDomainsDescription ||
              "Restrict workspace invites and logins strictly to corporate email domains (e.g. mycompany.com). Leave empty to allow any domain."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="allowed-domains">{t.domainsLabel || "Approved Domains (comma-separated)"}</Label>
            <Input
              id="allowed-domains"
              placeholder="e.g. acme.com, agency.io"
              disabled={!canManage}
              {...register("allowed_domains_text")}
            />
            <p className="text-xs text-muted-foreground">
              {t.domainsHint || "Separate multiple domain names with commas. Users with matching emails can join your organization."}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Card 2: Session Inactivity & Timeout ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Timer className="size-5 text-primary" />
            <CardTitle>{t.sessionTimeoutTitle || "Session Inactivity & Expiration"}</CardTitle>
          </div>
          <CardDescription>
            {t.sessionTimeoutDescription ||
              "Automatically expire idle browser sessions to protect sensitive client and workspace data."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="session-timeout">{t.inactivityLimitLabel || "Inactivity Timeout Limit"}</Label>
            <Controller
              name="session_timeout_minutes"
              control={control}
              render={({ field }) => (
                <Select
                  value={String(field.value)}
                  onValueChange={(val) => field.onChange(Number(val))}
                  disabled={!canManage}
                >
                  <SelectTrigger id="session-timeout" className="w-full sm:w-80">
                    <SelectValue placeholder="Select timeout" />
                  </SelectTrigger>
                  <SelectContent>
                    {SESSION_TIMEOUT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={String(opt.value)}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Card 3: Member Leave & Account Protections ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            <CardTitle>{t.memberProtectionTitle || "Workspace & Member Protections"}</CardTitle>
          </div>
          <CardDescription>
            {t.memberProtectionDescription ||
              "Guard against accidental deletions or unauthorized team membership modifications."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border p-4 bg-muted/20">
            <input
              id="prevent-deletion"
              type="checkbox"
              className="mt-1 size-4 rounded border-border text-primary focus:ring-primary"
              disabled={!canManage}
              {...register("prevent_member_deletion")}
            />
            <div className="space-y-1">
              <Label htmlFor="prevent-deletion" className="font-medium cursor-pointer">
                {t.preventMemberDeletionLabel || "Enforce Admin Approval for Member Deletion"}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t.preventMemberDeletionHint || "When enabled, team members cannot delete their account without explicit Organization Owner approval."}
              </p>
            </div>
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
              {t.securitySaved || "Security settings saved."}
            </span>
          )}
        </div>
      )}
    </form>
  );
}

