"use client";

import * as React from "react";
import {
  Activity,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Key,
  Loader2,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
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
import { AiProviderIcon } from "./ai-provider-icon";
import {
  saveAiProvider,
  testAiProviderConnection,
  deleteAiProvider,
} from "@/lib/actions/ai-providers";
import type { ProviderCatalogItem } from "@/lib/validations/ai-providers";
import type { AiModelProvider } from "@/types/database";

interface ProviderConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalogItem: ProviderCatalogItem | null;
  existingProvider?: AiModelProvider | null;
  canManage: boolean;
  onSaved: () => void;
  labels?: {
    title?: string;
    apiKeyLabel?: string;
    apiKeyPlaceholder?: string;
    baseUrlLabel?: string;
    baseUrlPlaceholder?: string;
    defaultModelLabel?: string;
    defaultModelPlaceholder?: string;
    activeLabel?: string;
    testConnection?: string;
    testing?: string;
    save?: string;
    saving?: string;
    delete?: string;
    getApiKey?: string;
  };
}

export function ProviderConfigDialog({
  open,
  onOpenChange,
  catalogItem,
  existingProvider,
  canManage,
  onSaved,
  labels,
}: ProviderConfigDialogProps) {
  const [apiKey, setApiKey] = React.useState("");
  const [baseUrl, setBaseUrl] = React.useState("");
  const [modelMode, setModelMode] = React.useState<"preset" | "custom">("preset");
  const [selectedPresetModel, setSelectedPresetModel] = React.useState("");
  const [customModelId, setCustomModelId] = React.useState("");
  const [isActive, setIsActive] = React.useState(true);
  const [showKey, setShowKey] = React.useState(false);

  const [isSaving, setIsSaving] = React.useState(false);
  const [isTesting, setIsTesting] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const [testResult, setTestResult] = React.useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open && catalogItem) {
      if (existingProvider) {
        setApiKey(existingProvider.api_key_encrypted || "");
        setBaseUrl(existingProvider.base_url || "");
        const currentModel = existingProvider.default_model || "";
        const isPreset = catalogItem.defaultModels.includes(currentModel);
        if (isPreset) {
          setModelMode("preset");
          setSelectedPresetModel(currentModel);
          setCustomModelId("");
        } else {
          setModelMode("custom");
          setSelectedPresetModel("__custom__");
          setCustomModelId(currentModel);
        }
        setIsActive(existingProvider.is_active);
      } else {
        setApiKey("");
        setBaseUrl("");
        setModelMode("preset");
        setSelectedPresetModel(catalogItem.defaultModels[0] || "");
        setCustomModelId("");
        setIsActive(true);
      }
      setShowKey(false);
      setTestResult(null);
      setErrorMessage(null);
    }
  }, [open, catalogItem, existingProvider]);

  if (!catalogItem) return null;

  const effectiveDefaultModel =
    modelMode === "custom" ? customModelId.trim() : selectedPresetModel.trim();

  const handleTestConnection = async () => {
    if (!apiKey) {
      setErrorMessage("Please enter an API Key to test connection.");
      return;
    }
    if (catalogItem.requiresBaseUrl && !baseUrl) {
      setErrorMessage("Base URL is required for this provider.");
      return;
    }
    if (modelMode === "custom" && !customModelId.trim()) {
      setErrorMessage("Please enter a custom model identifier.");
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    setErrorMessage(null);

    const res = await testAiProviderConnection({
      provider: catalogItem.id,
      apiKey,
      baseUrl: baseUrl || undefined,
      defaultModel: effectiveDefaultModel || undefined,
    });

    setIsTesting(false);
    if (res.status === "success") {
      setTestResult({
        success: true,
        message: res.data.message,
        latencyMs: res.data.latencyMs,
      });
    } else {
      setTestResult({
        success: false,
        message: res.error,
      });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;

    if (!apiKey) {
      setErrorMessage("API Key is required.");
      return;
    }
    if (catalogItem.requiresBaseUrl && !baseUrl) {
      setErrorMessage("Base URL is required for this provider.");
      return;
    }
    if (!effectiveDefaultModel) {
      setErrorMessage(
        modelMode === "custom"
          ? "Please enter a custom model identifier."
          : "Default model is required."
      );
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    const res = await saveAiProvider({
      id: existingProvider?.id,
      provider: catalogItem.id,
      apiKey,
      defaultModel: effectiveDefaultModel,
      baseUrl: baseUrl || null,
      isActive,
    });

    setIsSaving(false);
    if (res.status === "success") {
      onSaved();
      onOpenChange(false);
    } else {
      setErrorMessage(res.error);
    }
  };

  const handleDelete = async () => {
    if (!existingProvider?.id || !canManage) return;
    if (!confirm("Are you sure you want to disconnect this model provider?")) {
      return;
    }

    setIsDeleting(true);
    const res = await deleteAiProvider(existingProvider.id);
    setIsDeleting(false);

    if (res.status === "success") {
      onSaved();
      onOpenChange(false);
    } else {
      setErrorMessage(res.error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={handleSave} className="space-y-5">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <AiProviderIcon provider={catalogItem.id} size="md" />
              <div>
                <DialogTitle className="text-xl font-semibold">
                  {catalogItem.name}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {catalogItem.description}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {errorMessage && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2 border border-destructive/20">
              <XCircle className="size-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {testResult && (
            <div
              className={`p-3 rounded-lg text-sm flex items-start gap-2.5 border ${
                testResult.success
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                  : "bg-destructive/10 text-destructive border-destructive/20"
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="size-4 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="font-medium">
                  {testResult.success ? "Connection Verified" : "Connection Failed"}
                </p>
                <p className="text-xs opacity-90 mt-0.5">{testResult.message}</p>
              </div>
            </div>
          )}

          {/* Form fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="apiKey" className="text-sm font-medium">
                  {labels?.apiKeyLabel ?? "API Key"}
                </Label>
                {catalogItem.docUrl && (
                  <a
                    href={catalogItem.docUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                  >
                    <span>{labels?.getApiKey ?? "Get API Key"}</span>
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
              <div className="relative">
                <Input
                  id="apiKey"
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={
                    catalogItem.id === "openai"
                      ? "sk-..."
                      : catalogItem.id === "anthropic"
                      ? "sk-ant-..."
                      : "Enter API key"
                  }
                  className="pr-10 font-mono text-sm"
                  disabled={!canManage}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
            </div>
            {/* Base URL */}
            {(catalogItem.requiresBaseUrl || catalogItem.id === "openai") && (
              <div className="space-y-2">
                <Label htmlFor="baseUrl" className="text-sm font-medium">
                  {labels?.baseUrlLabel ?? "Base URL"}
                  {!catalogItem.requiresBaseUrl && (
                    <span className="text-xs text-muted-foreground ml-1.5 font-normal">
                      (Optional custom proxy endpoint)
                    </span>
                  )}
                </Label>
                <Input
                  id="baseUrl"
                  type="url"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder={
                    catalogItem.id === "custom_openai"
                      ? "http://localhost:11434/v1 or https://api.proxy.com/v1"
                      : "https://api.openai.com/v1"
                  }
                  className="font-mono text-sm"
                  disabled={!canManage}
                />
              </div>
            )}

            {/* Default Model */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="defaultModelSelect" className="text-sm font-medium">
                  {labels?.defaultModelLabel ?? "Default Model"}
                </Label>
                {modelMode === "custom" ? (
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    Custom Model Active
                  </Badge>
                ) : (
                  <span className="text-[11px] text-muted-foreground">
                    {catalogItem.defaultModels.length} preset models available
                  </span>
                )}
              </div>

              {/* Preset Selector */}
              <Select
                value={modelMode === "custom" ? "__custom__" : selectedPresetModel}
                onValueChange={(val) => {
                  if (val === "__custom__") {
                    setModelMode("custom");
                    if (!customModelId && selectedPresetModel) {
                      setCustomModelId(selectedPresetModel);
                    }
                  } else {
                    setModelMode("preset");
                    setSelectedPresetModel(val);
                  }
                }}
                disabled={!canManage}
              >
                <SelectTrigger id="defaultModelSelect" className="w-full font-mono text-sm">
                  <SelectValue placeholder="Select a default model" />
                </SelectTrigger>
                <SelectContent>
                  {catalogItem.defaultModels.map((m) => (
                    <SelectItem key={m} value={m} className="font-mono text-xs">
                      {m}
                    </SelectItem>
                  ))}
                  <SelectItem
                    value="__custom__"
                    className="font-sans text-xs font-semibold text-primary border-t mt-1 pt-1.5"
                  >
                    ✨ Custom Model ID (specify your own)...
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Custom Model Input - Rendered on its own line when Custom is selected */}
              {modelMode === "custom" && (
                <div className="space-y-1.5 rounded-lg border border-primary/30 bg-primary/5 p-3.5 animate-in fade-in-50 duration-200">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="customModelInput" className="text-xs font-semibold text-foreground">
                      {labels?.defaultModelPlaceholder ?? "Custom Model Identifier"}
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setModelMode("preset");
                        setSelectedPresetModel(catalogItem.defaultModels[0] || "");
                      }}
                    >
                      Switch back to presets
                    </Button>
                  </div>
                  <Input
                    id="customModelInput"
                    value={customModelId}
                    onChange={(e) => setCustomModelId(e.target.value)}
                    placeholder={
                      catalogItem.id === "openai"
                        ? "e.g. gpt-4o-2024-11-20, o3-mini, ft:gpt-4o:org:id"
                        : catalogItem.id === "anthropic"
                        ? "e.g. claude-3-5-sonnet-20241022, claude-3-haiku-20240307"
                        : catalogItem.id === "gemini"
                        ? "e.g. gemini-2.0-flash, gemini-1.5-pro-latest"
                        : catalogItem.id === "openrouter"
                        ? "e.g. meta-llama/llama-3.3-70b-instruct, deepseek/deepseek-r1"
                        : "e.g. llama3.3:70b, mistral-large-latest, local-model"
                    }
                    className="font-mono text-sm bg-background w-full"
                    disabled={!canManage}
                    autoFocus
                  />
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Enter any model identifier or fine-tuned model ID supported by your {catalogItem.name} endpoint.
                  </p>
                </div>
              )}
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <div className="space-y-0.5">
                <Label htmlFor="isActive" className="text-sm font-medium cursor-pointer">
                  {labels?.activeLabel ?? "Enable Provider"}
                </Label>
                <p className="text-xs text-muted-foreground">
                  Allow agents and workflows to invoke this provider.
                </p>
              </div>
              <Switch
                id="isActive"
                checked={isActive}
                onCheckedChange={setIsActive}
                disabled={!canManage}
              />
            </div>
          </div>

          <DialogFooter className="flex flex-row items-center justify-between sm:justify-between gap-2 pt-2 border-t">
            <div>
              {existingProvider && canManage && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={isDeleting || isSaving}
                >
                  {isDeleting ? (
                    <Loader2 className="size-4 animate-spin mr-1.5" />
                  ) : (
                    <Trash2 className="size-4 mr-1.5" />
                  )}
                  {labels?.delete ?? "Disconnect"}
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                disabled={isTesting || !apiKey}
              >
                {isTesting ? (
                  <Loader2 className="size-4 animate-spin mr-1.5" />
                ) : (
                  <Activity className="size-4 mr-1.5" />
                )}
                {isTesting
                  ? labels?.testing ?? "Testing..."
                  : labels?.testConnection ?? "Test Connection"}
              </Button>

              {canManage && (
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSaving || isTesting}
                  className="bg-primary text-primary-foreground"
                >
                  {isSaving && <Loader2 className="size-4 animate-spin mr-1.5" />}
                  {isSaving
                    ? labels?.saving ?? "Saving..."
                    : labels?.save ?? "Save Provider"}
                </Button>
              )}
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
