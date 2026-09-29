"use client";

import * as React from "react";
import {
  Boxes,
  ChevronRight,
  Cpu,
  Plus,
  RefreshCw,
  Server,
  Settings2,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { AiProviderIcon } from "./ai-provider-icon";
import { ProviderConfigDialog } from "./provider-config-dialog";
import { McpServerDialog } from "./mcp-server-dialog";
import {
  PROVIDER_CATALOG,
  getAiProviders,
  getMcpServers,
  toggleMcpServer,
  type ProviderCatalogItem,
} from "@/lib/actions/ai-providers";
import type { AiModelProvider, AiMcpServer } from "@/types/database";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";

interface ProvidersMcpTabProps {
  initialProviders?: AiModelProvider[];
  initialMcpServers?: AiMcpServer[];
  canManage: boolean;
  platform: Dictionary["platform"];
  locale: Locale;
}

export function ProvidersMcpTab({
  initialProviders = [],
  initialMcpServers = [],
  canManage,
  platform,
  locale,
}: ProvidersMcpTabProps) {
  const [providers, setProviders] = React.useState<AiModelProvider[]>(initialProviders);
  const [mcpServers, setMcpServers] = React.useState<AiMcpServer[]>(initialMcpServers);
  const [isLoading, setIsLoading] = React.useState(false);

  const [selectedCatalogItem, setSelectedCatalogItem] = React.useState<ProviderCatalogItem | null>(null);
  const [providerDialogOpen, setProviderDialogOpen] = React.useState(false);
  const [selectedMcpServer, setSelectedMcpServer] = React.useState<AiMcpServer | null>(null);
  const [mcpDialogOpen, setMcpDialogOpen] = React.useState(false);

  const refreshData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [p, m] = await Promise.all([getAiProviders(), getMcpServers()]);
      setProviders(p);
      setMcpServers(m);
    } catch (e) {
      console.error("Failed to refresh AI providers:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (initialProviders.length === 0 && initialMcpServers.length === 0) {
      void refreshData();
    }
  }, [initialProviders.length, initialMcpServers.length, refreshData]);

  const configuredProviderMap = React.useMemo(() => {
    const map = new Map<string, AiModelProvider>();
    for (const p of providers) {
      map.set(p.provider, p);
    }
    return map;
  }, [providers]);
  const handleOpenMcpCreate = () => {
    setSelectedMcpServer(null);
    setMcpDialogOpen(true);
  };

  const handleOpenMcpEdit = (server: AiMcpServer) => {
    setSelectedMcpServer(server);
    setMcpDialogOpen(true);
  };

  const handleToggleMcp = async (server: AiMcpServer, checked: boolean) => {
    if (!canManage) return;
    setMcpServers((prev) =>
      prev.map((s) => (s.id === server.id ? { ...s, is_active: checked } : s))
    );
    const res = await toggleMcpServer(server.id, checked);
    if (res.status === "error") {
      void refreshData();
    }
  };


  return (
    <div className="space-y-10">
      {/* 1. LLM Model Providers Section */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
              <Cpu className="size-5 text-primary" />
              LLM Model Providers (BYOK)
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Bring Your Own Keys for direct provider inference with high reliability and zero markup.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={refreshData} disabled={isLoading} className="text-xs">
            <RefreshCw className={`size-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PROVIDER_CATALOG.map((item) => {
            const configured = configuredProviderMap.get(item.id);
            const isConnected = !!configured;
            const isActive = configured ? configured.is_active : false;

            return (
              <Card key={item.id} className="relative border transition hover:border-primary/40 flex flex-col justify-between">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <AiProviderIcon provider={item.id} size="md" />
                    <div>
                      <CardTitle className="text-base font-semibold">{item.name}</CardTitle>
                      <div className="mt-1">
                        {isConnected ? (
                          isActive ? (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[11px]">
                              <span className="size-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                              Connected
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[11px] text-muted-foreground">Inactive</Badge>
                          )
                        ) : (
                          <Badge variant="outline" className="text-[11px] text-muted-foreground border-dashed">Not Configured</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <CardDescription className="text-xs line-clamp-2 mt-2">{item.description}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {isConnected && (
                    <div className="rounded-lg bg-muted/40 p-2.5 text-xs space-y-1 font-mono border">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>Model:</span>
                        <span className="font-semibold text-foreground truncate max-w-[150px]">{configured.default_model}</span>
                      </div>
                      {configured.base_url && (
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>Base URL:</span>
                          <span className="truncate max-w-[140px]" title={configured.base_url}>{configured.base_url}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <Button
                    variant={isConnected ? "outline" : "default"}
                    size="sm"
                    className="w-full justify-between text-xs"
                    onClick={() => {
                      setSelectedCatalogItem(item);
                      setProviderDialogOpen(true);
                    }}
                  >
                    <span className="flex items-center gap-1.5">
                      <Settings2 className="size-3.5" />
                      {isConnected ? "Configure Provider" : "Connect Provider"}
                    </span>
                    <ChevronRight className="size-3.5 opacity-60" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
      {/* 2. MCP (Model Context Protocol) Section */}
      <section className="space-y-4 pt-4 border-t">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
              <Server className="size-5 text-primary" />
              MCP Server Registry
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Attach external tool servers and enterprise data sources via standardized MCP endpoints.
            </p>
          </div>
          {canManage && (
            <Button size="sm" onClick={handleOpenMcpCreate} className="text-xs">
              <Plus className="size-3.5 mr-1.5" />
              Connect MCP Server
            </Button>
          )}
        </div>

        {mcpServers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center bg-card/50">
            <div className="size-12 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center mx-auto mb-3">
              <Boxes className="size-6" />
            </div>
            <h3 className="text-base font-medium">No MCP Servers Connected</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1 leading-relaxed">
              Connect external MCP tool providers (such as databases, code interpreters, or custom SSE servers) to make their tools available across workflows and agents.
            </p>
            {canManage && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenMcpCreate}
                className="mt-4 text-xs"
              >
                <Plus className="size-3.5 mr-1.5" />
                Add Your First MCP Server
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mcpServers.map((server) => {
              const toolCount = server.discovered_tools?.length || 0;

              return (
                <Card
                  key={server.id}
                  className="border transition hover:border-primary/40 flex flex-col justify-between"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <CardTitle className="text-base font-semibold">
                          {server.name}
                        </CardTitle>
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <Badge
                            variant="secondary"
                            className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0"
                          >
                            {server.transport_type}
                          </Badge>
                          {server.is_active ? (
                            <Badge
                              variant="outline"
                              className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] py-0 font-medium"
                            >
                              Active
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[10px] text-muted-foreground py-0"
                            >
                              Disabled
                            </Badge>
                          )}
                        </div>
                      </div>

                      {canManage && (
                        <Switch
                          checked={server.is_active}
                          onCheckedChange={(checked) => handleToggleMcp(server, checked)}
                          aria-label={`Toggle ${server.name}`}
                        />
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0 space-y-3">
                    <div className="rounded-lg bg-muted/40 p-2.5 text-xs font-mono border space-y-1.5">
                      <div className="text-muted-foreground truncate" title={server.endpoint_url}>
                        <span className="text-[10px] font-semibold text-foreground uppercase block mb-0.5">
                          Endpoint:
                        </span>
                        {server.endpoint_url}
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t text-[11px]">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Wrench className="size-3 text-primary" />
                          Tools Discovered:
                        </span>
                        <span className="font-semibold text-foreground">
                          {toolCount} tool{toolCount === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>

                    {toolCount > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {server.discovered_tools.slice(0, 3).map((tool, idx) => (
                          <Badge
                            key={idx}
                            variant="outline"
                            className="text-[10px] font-mono py-0 px-1.5 max-w-[120px] truncate"
                            title={tool.name}
                          >
                            {tool.name}
                          </Badge>
                        ))}
                        {toolCount > 3 && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] font-mono py-0 px-1 text-muted-foreground"
                          >
                            +{toolCount - 3} more
                          </Badge>
                        )}
                      </div>
                    )}

                    <div className="pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-between text-xs"
                        onClick={() => handleOpenMcpEdit(server)}
                      >
                        <span className="flex items-center gap-1.5">
                          <Settings2 className="size-3.5" />
                          Manage & Tools
                        </span>
                        <ChevronRight className="size-3.5 opacity-60" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Provider Config Dialog */}
      <ProviderConfigDialog
        open={providerDialogOpen}
        onOpenChange={setProviderDialogOpen}
        catalogItem={selectedCatalogItem}
        existingProvider={
          selectedCatalogItem
            ? configuredProviderMap.get(selectedCatalogItem.id)
            : null
        }
        canManage={canManage}
        onSaved={refreshData}
      />

      {/* MCP Server Dialog */}
      <McpServerDialog
        open={mcpDialogOpen}
        onOpenChange={setMcpDialogOpen}
        existingServer={selectedMcpServer}
        canManage={canManage}
        onSaved={refreshData}
      />

    </div>
  );
}
