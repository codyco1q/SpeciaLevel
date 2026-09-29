"use client";

import * as React from "react";
import {
  Activity,
  CheckCircle2,
  Cpu,
  Eye,
  EyeOff,
  Layers,
  Loader2,
  Plus,
  Server,
  Trash2,
  Wrench,
  X,
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
import { Badge } from "@/components/ui/badge";
import {
  saveMcpServer,
  testMcpServerConnection,
  deleteMcpServer,
} from "@/lib/actions/ai-providers";
import type { AiMcpServer, McpToolDefinition, McpTransportType } from "@/types/database";

interface HeaderPair {
  key: string;
  value: string;
}

interface McpServerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingServer?: AiMcpServer | null;
  canManage: boolean;
  onSaved: () => void;
  labels?: {
    title?: string;
    editTitle?: string;
    description?: string;
    nameLabel?: string;
    namePlaceholder?: string;
    transportLabel?: string;
    endpointLabel?: string;
    endpointPlaceholder?: string;
    headersLabel?: string;
    activeLabel?: string;
    testConnection?: string;
    testing?: string;
    save?: string;
    saving?: string;
    delete?: string;
  };
}

export function McpServerDialog({
  open,
  onOpenChange,
  existingServer,
  canManage,
  onSaved,
  labels,
}: McpServerDialogProps) {
  const [name, setName] = React.useState("");
  const [transportType, setTransportType] = React.useState<McpTransportType>("sse");
  const [endpointUrl, setEndpointUrl] = React.useState("");
  const [headerPairs, setHeaderPairs] = React.useState<HeaderPair[]>([]);
  const [isActive, setIsActive] = React.useState(true);

  const [isSaving, setIsSaving] = React.useState(false);
  const [isTesting, setIsTesting] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const [discoveredTools, setDiscoveredTools] = React.useState<McpToolDefinition[]>([]);
  const [testLatency, setTestLatency] = React.useState<number | null>(null);
  const [testError, setTestError] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      if (existingServer) {
        setName(existingServer.name);
        setTransportType(existingServer.transport_type);
        setEndpointUrl(existingServer.endpoint_url);
        setIsActive(existingServer.is_active);
        setDiscoveredTools(existingServer.discovered_tools || []);

        const pairs: HeaderPair[] = [];
        if (existingServer.headers_encrypted) {
          for (const [k, v] of Object.entries(existingServer.headers_encrypted)) {
            pairs.push({ key: k, value: String(v) });
          }
        }
        setHeaderPairs(pairs);
      } else {
        setName("");
        setTransportType("sse");
        setEndpointUrl("");
        setIsActive(true);
        setDiscoveredTools([]);
        setHeaderPairs([]);
      }
      setTestLatency(null);
      setTestError(null);
      setErrorMessage(null);
    }
  }, [open, existingServer]);

  const addHeaderPair = () => {
    setHeaderPairs([...headerPairs, { key: "", value: "" }]);
  };

  const removeHeaderPair = (index: number) => {
    setHeaderPairs(headerPairs.filter((_, i) => i !== index));
  };

  const updateHeaderPair = (index: number, field: "key" | "value", val: string) => {
    const updated = [...headerPairs];
    if (updated[index]) {
      updated[index][field] = val;
      setHeaderPairs(updated);
    }
  };

  const getHeadersRecord = () => {
    const record: Record<string, string> = {};
    for (const pair of headerPairs) {
      if (pair.key.trim()) {
        record[pair.key.trim()] = pair.value.trim();
      }
    }
    return record;
  };

  const handleTestConnection = async () => {
    if (!endpointUrl) {
      setErrorMessage("Endpoint URL is required to test connection.");
      return;
    }

    setIsTesting(true);
    setTestError(null);
    setErrorMessage(null);

    const res = await testMcpServerConnection({
      endpointUrl,
      transportType,
      headers: getHeadersRecord(),
    });

    setIsTesting(false);
    if (res.status === "success") {
      setDiscoveredTools(res.data.tools);
      setTestLatency(res.data.latencyMs);
    } else {
      setTestError(res.error);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;

    if (!name.trim()) {
      setErrorMessage("Server name is required.");
      return;
    }
    if (!endpointUrl.trim()) {
      setErrorMessage("Endpoint URL is required.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    const res = await saveMcpServer({
      id: existingServer?.id,
      name: name.trim(),
      transportType,
      endpointUrl: endpointUrl.trim(),
      headers: getHeadersRecord(),
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
    if (!existingServer?.id || !canManage) return;
    if (!confirm("Are you sure you want to remove this MCP server?")) {
      return;
    }

    setIsDeleting(true);
    const res = await deleteMcpServer(existingServer.id);
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
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSave} className="space-y-5">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center">
                <Server className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold">
                  {existingServer
                    ? labels?.editTitle ?? "Edit MCP Server"
                    : labels?.title ?? "Connect MCP Server"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {labels?.description ??
                    "Register an external Model Context Protocol server to expose tools and data sources to your agents."}
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

          {testError && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-start gap-2 border border-destructive/20">
              <XCircle className="size-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium">Connection Failed</p>
                <p className="text-xs opacity-90 mt-0.5">{testError}</p>
              </div>
            </div>
          )}

          {testLatency !== null && (
            <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-sm flex items-start gap-2.5 border border-emerald-500/20">
              <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium">Connection Verified ({testLatency}ms)</p>
                <p className="text-xs opacity-90 mt-0.5">
                  Discovered {discoveredTools.length} tool(s) ready for invocation.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {/* Server Name */}
            <div className="space-y-2">
              <Label htmlFor="mcpName" className="text-sm font-medium">
                {labels?.nameLabel ?? "Server Name"}
              </Label>
              <Input
                id="mcpName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={labels?.namePlaceholder ?? "e.g. Postgres DB Tools, GitHub Assistant"}
                disabled={!canManage}
              />
            </div>

            {/* Transport & Endpoint */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  {labels?.transportLabel ?? "Transport"}
                </Label>
                <Select
                  value={transportType}
                  onValueChange={(val) => setTransportType(val as McpTransportType)}
                  disabled={!canManage}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sse">SSE (HTTP Stream)</SelectItem>
                    <SelectItem value="http_stream">HTTP Post/Stream</SelectItem>
                    <SelectItem value="stdio">Stdio (Local IPC)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="endpointUrl" className="text-sm font-medium">
                  {labels?.endpointLabel ?? "Endpoint URL"}
                </Label>
                <Input
                  id="endpointUrl"
                  value={endpointUrl}
                  onChange={(e) => setEndpointUrl(e.target.value)}
                  placeholder={labels?.endpointPlaceholder ?? "https://mcp.domain.com/sse"}
                  className="font-mono text-xs"
                  disabled={!canManage}
                />
              </div>
            </div>
            {/* Custom Request Headers */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  {labels?.headersLabel ?? "Custom Headers / Authorization"}
                </Label>
                {canManage && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-primary"
                    onClick={addHeaderPair}
                  >
                    <Plus className="size-3.5 mr-1" />
                    Add Header
                  </Button>
                )}
              </div>

              {headerPairs.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  No extra headers configured (optional for public / unauthenticated SSE servers).
                </p>
              ) : (
                <div className="space-y-2 max-h-32 overflow-y-auto p-1">
                  {headerPairs.map((pair, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        placeholder="Header Key (e.g. Authorization)"
                        value={pair.key}
                        onChange={(e) => updateHeaderPair(idx, "key", e.target.value)}
                        className="font-mono text-xs w-1/3"
                        disabled={!canManage}
                      />
                      <Input
                        placeholder="Value (e.g. Bearer sk-...)"
                        value={pair.value}
                        onChange={(e) => updateHeaderPair(idx, "value", e.target.value)}
                        className="font-mono text-xs flex-1"
                        type="password"
                        disabled={!canManage}
                      />
                      {canManage && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeHeaderPair(idx)}
                        >
                          <X className="size-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Discovered Tools List Preview */}
            {discoveredTools.length > 0 && (
              <div className="space-y-2 p-3 rounded-lg border bg-muted/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Wrench className="size-3.5" />
                    Discovered Tools ({discoveredTools.length})
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                  {discoveredTools.map((t, idx) => (
                    <Badge
                      key={idx}
                      variant="secondary"
                      className="text-[11px] font-mono py-0.5 px-2 bg-background border"
                      title={t.description || t.name}
                    >
                      {t.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Active Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <div className="space-y-0.5">
                <Label htmlFor="mcpActive" className="text-sm font-medium cursor-pointer">
                  {labels?.activeLabel ?? "Enable Server"}
                </Label>
                <p className="text-xs text-muted-foreground">
                  Allow agents to discover and invoke tools from this server.
                </p>
              </div>
              <Switch
                id="mcpActive"
                checked={isActive}
                onCheckedChange={setIsActive}
                disabled={!canManage}
              />
            </div>
          </div>

          <DialogFooter className="flex flex-row items-center justify-between sm:justify-between gap-2 pt-2 border-t">
            <div>
              {existingServer && canManage && (
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
                  {labels?.delete ?? "Remove"}
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                disabled={isTesting || !endpointUrl}
              >
                {isTesting ? (
                  <Loader2 className="size-4 animate-spin mr-1.5" />
                ) : (
                  <Activity className="size-4 mr-1.5" />
                )}
                {isTesting
                  ? labels?.testing ?? "Discovering..."
                  : labels?.testConnection ?? "Test & Discover"}
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
                    : labels?.save ?? "Save Server"}
                </Button>
              )}
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
