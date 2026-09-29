"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  CheckCircle2,
  Plug,
  ExternalLink,
  CreditCard,
  MessageSquare,
  Sliders,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProviderIcon } from "@/components/integrations/provider-icon";
import { ProviderConfigDialog } from "@/components/integrations/provider-config-dialog";
import type { ProviderIntegrationItem } from "@/lib/actions/integrations";
import type { Dictionary, Locale } from "@/lib/i18n/get-dictionary";
import { cn } from "@/lib/utils";

interface IntegrationsViewProps {
  initialItems: ProviderIntegrationItem[];
  canManage: boolean;
  platform: Dictionary["platform"];
  locale: Locale;
}

export function IntegrationsView({
  initialItems,
  canManage,
  platform,
  locale,
}: IntegrationsViewProps) {
  const router = useRouter();
  const [items, setItems] = React.useState<ProviderIntegrationItem[]>(initialItems);
  const [selectedCategory, setSelectedCategory] = React.useState<string>("all");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [activeConfigItem, setActiveConfigItem] =
    React.useState<ProviderIntegrationItem | null>(null);

  React.useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const t = platform.integrations;

  const filteredItems = items.filter((item) => {
    const matchesCategory =
      selectedCategory === "all" || item.definition.category === selectedCategory;

    const q = searchQuery.toLowerCase().trim();
    if (!q) return matchesCategory;

    return (
      matchesCategory &&
      (item.definition.name.toLowerCase().includes(q) ||
        item.definition.description.toLowerCase().includes(q) ||
        item.definition.badge.toLowerCase().includes(q))
    );
  });

  const totalCount = items.length;
  const connectedCount = items.filter(
    (item) => item.integration.status === "connected"
  ).length;
  const paymentConnected = items.filter(
    (item) =>
      item.definition.category === "payment" &&
      item.integration.status === "connected"
  ).length;
  const socialConnected = items.filter(
    (item) =>
      item.definition.category === "social" &&
      item.integration.status === "connected"
  ).length;

  const handleSuccess = () => {
    router.refresh();
  };

  return (
    <div className="flex-1 space-y-6 p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-2.5 border-b border-border/80 pb-6">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
          <Plug className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            {t?.title || "Integrations Hub"}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t?.subtitle || "Connect payment gateways and social messaging channels."}
          </p>
        </div>
      </div>
      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card/70 border-border/80 shadow-xs">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sliders className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">
                {t?.summary?.total || "Available Integrations"}
              </p>
              <p className="text-xl font-bold">{totalCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/70 border-border/80 shadow-xs">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">
                {t?.summary?.connected || "Active Connections"}
              </p>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {connectedCount}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/70 border-border/80 shadow-xs">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <CreditCard className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">
                {t?.summary?.paymentGateways || "Payment Gateways"}
              </p>
              <p className="text-xl font-bold">{paymentConnected} Active</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/70 border-border/80 shadow-xs">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <MessageSquare className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">
                {t?.summary?.socialChannels || "Social Channels"}
              </p>
              <p className="text-xl font-bold">{socialConnected} Active</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <Tabs
          value={selectedCategory}
          onValueChange={setSelectedCategory}
          className="w-full sm:w-auto"
        >
          <TabsList className="grid w-full grid-cols-3 sm:w-auto">
            <TabsTrigger value="all" className="text-xs font-medium">
              {t?.tabs?.all || "All"}
            </TabsTrigger>
            <TabsTrigger value="payment" className="text-xs font-medium">
              {t?.tabs?.payment || "Payments"}
            </TabsTrigger>
            <TabsTrigger value="social" className="text-xs font-medium">
              {t?.tabs?.social || "Social & Messaging"}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground rtl:left-auto rtl:right-3" />
          <Input
            placeholder={t?.searchPlaceholder || "Search integrations..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs rtl:pl-3 rtl:pr-9 h-9 bg-card"
          />
        </div>
      </div>

      {/* Grid of Integration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredItems.map((item) => {
          const isConnected = item.integration.status === "connected";
          const isError = item.integration.status === "error";
          const env = item.integration.config?.environment;
          const isDefault = item.integration.config?.is_default_payment;

          return (
            <Card
              key={item.definition.id}
              className={cn(
                "group relative flex flex-col justify-between overflow-hidden border transition-all hover:shadow-md",
                isConnected
                  ? "border-emerald-500/30 bg-card/90"
                  : "border-border/80 bg-card/50"
              )}
            >
              <CardHeader className="pb-3.5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <ProviderIcon provider={item.definition.id} size="md" />
                  <div className="flex flex-col items-end gap-1.5">
                    {isConnected ? (
                      <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[11px] font-semibold">
                        <span className="size-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                        Connected
                      </Badge>
                    ) : isError ? (
                      <Badge variant="destructive" className="text-[11px]">
                        Error
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[11px] text-muted-foreground font-normal">
                        Not Connected
                      </Badge>
                    )}

                    {isConnected && env && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-mono",
                          env === "live"
                            ? "border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/5"
                            : "border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/5"
                        )}
                      >
                        {env.toUpperCase()}
                      </Badge>
                    )}

                    {isDefault && (
                      <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                        Default Gateway
                      </Badge>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold tracking-tight">
                      {item.definition.name}
                    </h3>
                    <Badge variant="outline" className="text-[10px] uppercase font-semibold text-muted-foreground">
                      {item.definition.badge}
                    </Badge>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {item.definition.description}
                  </p>
                </div>
              </CardHeader>

              <CardContent className="pt-0 pb-4">
                <div className="flex items-center justify-between border-t border-border/60 pt-3 text-xs">
                  {item.integration.last_sync_at ? (
                    <span className="text-[11px] text-muted-foreground">
                      Synced {new Date(item.integration.last_sync_at).toLocaleDateString()}
                    </span>
                  ) : (
                    <a
                      href={item.definition.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      <span>Docs</span>
                      <ExternalLink className="size-3" />
                    </a>
                  )}

                  <Button
                    size="sm"
                    variant={isConnected ? "outline" : "default"}
                    onClick={() => setActiveConfigItem(item)}
                    className="h-8 text-xs font-semibold"
                  >
                    {isConnected ? "Configure" : "Connect"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Configuration Dialog */}
      {activeConfigItem && (
        <ProviderConfigDialog
          item={activeConfigItem}
          open={Boolean(activeConfigItem)}
          onOpenChange={(open) => !open && setActiveConfigItem(null)}
          canManage={canManage}
          platform={platform}
          locale={locale}
          onSuccess={handleSuccess}
        />
      )}

    </div>
  );
}
