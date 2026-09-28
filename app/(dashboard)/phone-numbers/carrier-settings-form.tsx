"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Server,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  carrierSettingsSchema,
  type CarrierSettingsFormValues,
} from "@/lib/validations/phone-numbers";
import {
  saveCarrierSettings,
  testCarrierConnection,
} from "@/lib/actions/phone-numbers";
import type { PhoneCarrierSettings } from "@/types/database";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

interface CarrierSettingsFormProps {
  carrierSettings: PhoneCarrierSettings | null;
  canManage: boolean;
  platform: Dictionary["platform"];
}

export function CarrierSettingsForm({
  carrierSettings,
  canManage,
  platform,
}: CarrierSettingsFormProps) {
  const t = platform.phoneNumbers.carrier;
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();

  const form = useForm<CarrierSettingsFormValues>({
    resolver: zodResolver(carrierSettingsSchema),
    defaultValues: {
      provider: carrierSettings?.provider ?? "twilio",
      accountSid: carrierSettings?.account_sid ?? "",
      authToken: carrierSettings?.auth_token_encrypted ?? "",
      apiKeySid: carrierSettings?.api_key_sid ?? "",
      apiKeySecret: carrierSettings?.api_key_secret_encrypted ?? "",
      twimlAppSid: carrierSettings?.twiml_app_sid ?? "",
      isActive: carrierSettings?.is_active ?? false,
    },
  });

  const onSave = (values: CarrierSettingsFormValues) => {
    setSaveStatus("idle");
    setSaveMessage(null);

    startTransition(async () => {
      const res = await saveCarrierSettings(values);
      if (res.status === "error") {
        setSaveStatus("error");
        setSaveMessage(res.error ?? "Failed to save carrier settings");
      } else {
        setSaveStatus("success");
        setSaveMessage(t.savedSuccess);
      }
    });
  };

  const onTest = () => {
    setTestStatus("testing");
    setTestMessage(null);

    startTransition(async () => {
      const res = await testCarrierConnection();
      if (res.status === "error") {
        setTestStatus("error");
        setTestMessage(res.error ?? t.testFailed);
      } else {
        setTestStatus("success");
        setTestMessage(res.message ?? t.testSuccess);
      }
    });
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3 border-b pb-4 mb-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Server className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold">{t.title}</h2>
            <p className="text-xs text-muted-foreground">{t.description}</p>
          </div>
        </div>

        <form onSubmit={form.handleSubmit(onSave)} className="space-y-5">
          {saveStatus === "success" && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{saveMessage}</span>
            </div>
          )}

          {saveStatus === "error" && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{saveMessage}</span>
            </div>
          )}

          {testStatus === "success" && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{testMessage}</span>
            </div>
          )}

          {testStatus === "error" && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{testMessage}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">{t.provider}</Label>
            <Select
              disabled={!canManage}
              value={form.watch("provider")}
              onValueChange={(val: "twilio" | "telnyx" | "custom") =>
                form.setValue("provider", val)
              }
            >
              <SelectTrigger className="text-xs w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="twilio">Twilio (Recommended)</SelectItem>
                <SelectItem value="telnyx">Telnyx</SelectItem>
                <SelectItem value="custom">Custom SIP / WebRTC</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="accountSid" className="text-xs">
                {t.accountSid}
              </Label>
              <Input
                id="accountSid"
                disabled={!canManage}
                placeholder={t.accountSidPlaceholder}
                {...form.register("accountSid")}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="authToken" className="text-xs">
                {t.authToken}
              </Label>
              <Input
                id="authToken"
                type="password"
                disabled={!canManage}
                placeholder={t.authTokenPlaceholder}
                {...form.register("authToken")}
                className="font-mono text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="apiKeySid" className="text-xs">
                {t.apiKeySid}
              </Label>
              <Input
                id="apiKeySid"
                disabled={!canManage}
                placeholder={t.apiKeySidPlaceholder}
                {...form.register("apiKeySid")}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="apiKeySecret" className="text-xs">
                {t.apiKeySecret}
              </Label>
              <Input
                id="apiKeySecret"
                type="password"
                disabled={!canManage}
                placeholder={t.apiKeySecretPlaceholder}
                {...form.register("apiKeySecret")}
                className="font-mono text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="twimlAppSid" className="text-xs">
              {t.twimlAppSid}
            </Label>
            <Input
              id="twimlAppSid"
              disabled={!canManage}
              placeholder={t.twimlAppSidPlaceholder}
              {...form.register("twimlAppSid")}
              className="font-mono text-xs"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3.5 bg-muted/20">
            <div className="space-y-0.5">
              <Label htmlFor="isActiveSwitch" className="text-xs font-semibold cursor-pointer">
                {t.isActive}
              </Label>
              <p className="text-[11px] text-muted-foreground">
                {t.isActiveDesc}
              </p>
            </div>
            <Switch
              id="isActiveSwitch"
              disabled={!canManage}
              checked={form.watch("isActive")}
              onCheckedChange={(c) => form.setValue("isActive", c)}
            />
          </div>

          {canManage && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onTest}
                disabled={isPending || testStatus === "testing"}
                className="gap-2 text-xs"
              >
                {testStatus === "testing" ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>{t.testing}</span>
                  </>
                ) : (
                  <>
                    <Zap className="h-3.5 w-3.5 text-amber-500" />
                    <span>{t.testConnection}</span>
                  </>
                )}
              </Button>

              <Button type="submit" size="sm" disabled={isPending} className="gap-2 text-xs">
                {isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>{t.saving}</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>{t.save}</span>
                  </>
                )}
              </Button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
