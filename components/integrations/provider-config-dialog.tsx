"use client";

import * as React from "react";
import {
  ExternalLink,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  ShieldCheck,
  Zap,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProviderIcon } from "./provider-icon";
import {
  saveIntegration,
  disconnectIntegration,
  testIntegrationConnection,
  type ProviderIntegrationItem,
} from "@/lib/actions/integrations";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

interface ProviderConfigDialogProps {
  item: ProviderIntegrationItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManage: boolean;
  platform: Dictionary["platform"];
  locale: Locale;
  onSuccess?: () => void;
}

export function ProviderConfigDialog({
  item,
  open,
  onOpenChange,
  canManage,
  platform,
  locale,
  onSuccess,
}: ProviderConfigDialogProps) {
  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ProviderConfigForm
        key={item.definition.id}
        item={item}
        onClose={() => onOpenChange(false)}
        canManage={canManage}
        platform={platform}
        locale={locale}
        onSuccess={onSuccess}
      />
    </Dialog>
  );
}

interface ProviderConfigFormProps {
  item: ProviderIntegrationItem;
  onClose: () => void;
  canManage: boolean;
  platform: Dictionary["platform"];
  locale: Locale;
  onSuccess?: () => void;
}

function ProviderConfigForm({
  item,
  onClose,
  canManage,
  platform,
  locale,
  onSuccess,
}: ProviderConfigFormProps) {
  const { definition, integration } = item;

  const [credentials, setCredentials] = React.useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const field of definition.fields) {
      initial[field.name] = integration.credentials[field.name] ?? "";
    }
    return initial;
  });

  const [environment, setEnvironment] = React.useState<string>(
    integration.config?.environment ?? "live"
  );
  const [isDefaultPayment, setIsDefaultPayment] = React.useState<boolean>(
    Boolean(integration.config?.is_default_payment)
  );

  const [showSecrets, setShowSecrets] = React.useState<Record<string, boolean>>({});
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{
    ok: boolean;
    message: string;
    latencyMs?: number;
  } | null>(null);

  const [saving, setSaving] = React.useState(false);
  const [disconnecting, setDisconnecting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = React.useState(false);

  const isConnected = integration.status === "connected";

  const handleFieldChange = (name: string, value: string) => {
    setCredentials((prev) => ({ ...prev, [name]: value }));
    setTestResult(null);
    setErrorMessage(null);
  };

  const toggleShowSecret = (fieldName: string) => {
    setShowSecrets((prev) => ({ ...prev, [fieldName]: !prev[fieldName] }));
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    setErrorMessage(null);
    try {
      const res = await testIntegrationConnection(definition.id, credentials, {
        environment,
      });
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        ok: false,
        message: err.message || "Failed to reach provider endpoint.",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;

    setSaving(true);
    setErrorMessage(null);

    const config: Record<string, any> = {};
    if (definition.hasEnvironmentToggle) {
      config.environment = environment;
    }
    if (definition.hasDefaultToggle) {
      config.is_default_payment = isDefaultPayment;
    }

    try {
      const res = await saveIntegration({
        provider: definition.id,
        category: definition.category,
        credentials,
        config,
      });

      if (res.status === "error") {
        setErrorMessage(res.error);
      } else {
        onSuccess?.();
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err.message || "An error occurred while saving.");
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!canManage) return;

    setDisconnecting(true);
    setErrorMessage(null);

    try {
      const res = await disconnectIntegration({
        provider: definition.id,
      });

      if (res.status === "error") {
        setErrorMessage(res.error);
      } else {
        onSuccess?.();
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to disconnect integration.");
    } finally {
      setDisconnecting(false);
      setConfirmDisconnect(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
      <form onSubmit={handleSave}>
        <DialogHeader className="pb-3 border-b border-border/70">
          <div className="flex items-center gap-3.5">
            <ProviderIcon provider={definition.id} size="md" />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-xl font-bold">
                  {definition.name}
                </DialogTitle>
                <Badge variant="outline" className="text-xs font-semibold uppercase tracking-wider">
                  {definition.badge}
                </Badge>
                {isConnected && (
                  <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs">
                    <span className="size-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                    Connected
                  </Badge>
                )}
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                {definition.description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Docs Portal Link */}
          <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs">
            <div className="flex items-center gap-2 text-foreground font-medium">
              <ShieldCheck className="size-4 text-primary shrink-0" />
              <span>Get live API credentials from provider console:</span>
            </div>
            <a
              href={definition.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 font-semibold text-primary hover:underline"
            >
              <span>Developer Portal</span>
              <ExternalLink className="size-3.5" />
            </a>
          </div>

          {/* Environment Switcher */}
          {definition.hasEnvironmentToggle && (
            <div className="space-y-1.5 rounded-lg border border-border bg-muted/20 p-3">
              <Label className="text-xs font-semibold text-muted-foreground">
                Target Environment
              </Label>
              <Tabs
                value={environment}
                onValueChange={setEnvironment}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="live" className="text-xs font-medium">
                    Live / Production
                  </TabsTrigger>
                  <TabsTrigger value="test" className="text-xs font-medium">
                    Sandbox / Test
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          )}

          {/* Dynamic Configuration Fields */}
          <div className="space-y-3.5">
            {definition.fields.map((field) => {
              const isPassword = field.type === "password";
              const isVisible = showSecrets[field.name];

              return (
                <div key={field.name} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor={`field-${field.name}`}
                      className="text-xs font-medium"
                    >
                      {field.label}{" "}
                      {field.required && (
                        <span className="text-destructive">*</span>
                      )}
                    </Label>
                    {isPassword && (
                      <button
                        type="button"
                        onClick={() => toggleShowSecret(field.name)}
                        className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                      >
                        {isVisible ? (
                          <>
                            <EyeOff className="size-3" /> Hide
                          </>
                        ) : (
                          <>
                            <Eye className="size-3" /> Reveal
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  <Input
                    id={`field-${field.name}`}
                    type={isPassword && !isVisible ? "password" : "text"}
                    value={credentials[field.name] ?? ""}
                    onChange={(e) =>
                      handleFieldChange(field.name, e.target.value)
                    }
                    placeholder={field.placeholder}
                    required={field.required && !isConnected}
                    disabled={!canManage || saving || disconnecting}
                    className="h-9 text-xs font-mono"
                  />
                  {field.helperText && (
                    <p className="text-[11px] text-muted-foreground">
                      {field.helperText}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          {/* Default Gateway Toggle */}
          {definition.hasDefaultToggle && (
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="default-payment" className="text-xs font-medium">
                  Default Payment Gateway
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Use this gateway as primary payment method on client invoices.
                </p>
              </div>
              <Switch
                id="default-payment"
                checked={isDefaultPayment}
                onCheckedChange={setIsDefaultPayment}
                disabled={!canManage || saving}
              />
            </div>
          )}

          {/* Test Connection Feedback */}
          {testResult && (
            <div
              className={`flex items-start gap-2.5 rounded-lg border p-3 text-xs ${
                testResult.ok
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "border-destructive/30 bg-destructive/10 text-destructive"
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertCircle className="size-4 shrink-0 mt-0.5 text-destructive" />
              )}
              <div className="space-y-0.5">
                <p className="font-semibold">{testResult.message}</p>
                {testResult.latencyMs !== undefined && (
                  <p className="text-[10px] opacity-80">
                    Handshake response latency: {testResult.latencyMs}ms
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Global Error Banner */}
          {errorMessage && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Disconnect Danger Zone */}
          {isConnected && (
            <div className="mt-4 pt-3 border-t border-border/80">
              {confirmDisconnect ? (
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-2">
                  <p className="text-xs font-semibold text-destructive">
                    Are you sure you want to disconnect {definition.name}?
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Stored API credentials will be cleared.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={handleDisconnect}
                      disabled={disconnecting}
                      className="h-8 text-xs"
                    >
                      {disconnecting && (
                        <Loader2 className="mr-1.5 size-3 animate-spin" />
                      )}
                      Confirm Disconnect
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmDisconnect(false)}
                      disabled={disconnecting}
                      className="h-8 text-xs"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Manage active connection
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDisconnect(true)}
                    disabled={!canManage || saving || disconnecting}
                    className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="mr-1.5 size-3.5" />
                    Disconnect
                  </Button>
                </div>
              )}
            </div>
          )}

        </div>
        <DialogFooter className="border-t border-border/70 pt-3 flex flex-row items-center justify-between sm:justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTestConnection}
            disabled={testing || saving || disconnecting}
            className="h-9 text-xs"
          >
            {testing ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                Testing Handshake...
              </>
            ) : (
              <>
                <Zap className="mr-1.5 size-3.5 text-amber-500" />
                Test Connection
              </>
            )}
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={saving || disconnecting}
              className="h-9 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!canManage || saving || disconnecting}
              className="h-9 text-xs"
            >
              {saving && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </DialogFooter>

      </form>
    </DialogContent>
  );
}
