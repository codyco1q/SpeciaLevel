"use client";

import { useState, useTransition, useMemo } from "react";
import {
  ShieldAlert,
  Building2,
  Users,
  TrendingUp,
  Receipt,
  Zap,
  Search,
  Filter,
  RefreshCw,
  Crown,
  Lock,
  Layers,
  Sparkles,
  DollarSign,
  Activity,
  History,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Sliders,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TenantModal } from "./tenant-modal";
import {
  getSuperAdminDashboardData,
  startTenantImpersonation,
} from "@/lib/actions/super-admin";
import type {
  PlatformMetrics,
  TenantWithMetrics,
  SuperAdminAuditLog,
} from "@/types/database";

interface SuperAdminViewProps {
  initialMetrics: PlatformMetrics;
  initialTenants: TenantWithMetrics[];
  initialLogs: SuperAdminAuditLog[];
}

export function SuperAdminView({
  initialMetrics,
  initialTenants,
  initialLogs,
}: SuperAdminViewProps) {
  const [metrics, setMetrics] = useState<PlatformMetrics>(initialMetrics);
  const [tenants, setTenants] = useState<TenantWithMetrics[]>(initialTenants);
  const [logs, setLogs] = useState<SuperAdminAuditLog[]>(initialLogs);

  const [activeTab, setActiveTab] = useState<"directory" | "billing" | "access" | "audit">("directory");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");

  const [selectedTenant, setSelectedTenant] = useState<TenantWithMetrics | null>(null);
  const [isRefreshing, startRefresh] = useTransition();

  const handleRefresh = () => {
    startRefresh(async () => {
      const data = await getSuperAdminDashboardData({
        search: searchQuery,
        status: statusFilter,
        plan: planFilter,
      });
      setMetrics(data.metrics);
      setTenants(data.tenants);
      setLogs(data.recentLogs);
    });
  };

  const filteredTenants = useMemo(() => {
    return tenants.filter((t) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const match =
          t.name.toLowerCase().includes(q) ||
          t.slug.toLowerCase().includes(q) ||
          (t.contact_email && t.contact_email.toLowerCase().includes(q));
        if (!match) return false;
      }
      if (statusFilter !== "all" && t.status !== statusFilter) {
        return false;
      }
      if (planFilter !== "all" && t.plan_tier !== planFilter) {
        return false;
      }
      return true;
    });
  }, [tenants, searchQuery, statusFilter, planFilter]);

  const handleQuickImpersonate = (tenantId: string) => {
    startRefresh(async () => {
      const res = await startTenantImpersonation({ organizationId: tenantId });
      if (res.status === "success") {
        window.location.href = "/dashboard";
      }
    });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Platform Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center font-bold">
              <ShieldAlert className="size-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <span>Super Admin Control Panel</span>
                <Badge variant="outline" className="text-[10px] font-mono border-amber-500/40 text-amber-600">
                  PLATFORM CORE
                </Badge>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Multi-tenant organization directory, subscription revenue tracking, and global access governance.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-8 gap-1.5 text-xs shadow-2xs"
          >
            <RefreshCw className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* KPI Financial & Growth Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Monthly MRR</span>
            <DollarSign className="size-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-foreground mt-1.5">
            ${metrics.totalMrr.toLocaleString()}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            ARR: <strong className="text-foreground">${metrics.totalArr.toLocaleString()}</strong>
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Organizations</span>
            <Building2 className="size-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-foreground mt-1.5">{metrics.totalOrganizations}</p>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
            <span className="text-emerald-600">{metrics.activeOrganizations} active</span>
            <span>•</span>
            <span className="text-amber-600">{metrics.trialOrganizations} trial</span>
            <span>•</span>
            <span className="text-destructive">{metrics.suspendedOrganizations} locked</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Total Users</span>
            <Users className="size-4 text-purple-500" />
          </div>
          <p className="text-2xl font-bold text-foreground mt-1.5">{metrics.totalUsers}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Active profiles across all tenants</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">ARPU (Avg Revenue)</span>
            <Activity className="size-4 text-orange-500" />
          </div>
          <p className="text-2xl font-bold text-foreground mt-1.5">
            ${metrics.averageRevenuePerTenant}
            <span className="text-xs font-normal text-muted-foreground">/mo</span>
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Average revenue per tenant</p>
        </div>
      </div>

      {/* Navigation Subtabs */}
      <div className="flex items-center gap-1.5 border-b border-border pb-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab("directory")}
          className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors shrink-0 ${
            activeTab === "directory"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <Building2 className="size-3.5" />
          <span>Organization Directory ({tenants.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("billing")}
          className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors shrink-0 ${
            activeTab === "billing"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <DollarSign className="size-3.5" />
          <span>Subscriptions & Revenue</span>
        </button>

        <button
          onClick={() => setActiveTab("access")}
          className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors shrink-0 ${
            activeTab === "access"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <Sliders className="size-3.5" />
          <span>Feature Flags & Access</span>
        </button>

        <button
          onClick={() => setActiveTab("audit")}
          className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors shrink-0 ${
            activeTab === "audit"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <History className="size-3.5" />
          <span>Audit Logs ({logs.length})</span>
        </button>
      </div>

      {/* 1. ORGANIZATION DIRECTORY TAB */}
      {activeTab === "directory" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by organization name, slug, or contact email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ps-9 h-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-lg border border-border text-xs">
                {["all", "active", "trial", "restricted", "suspended"].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-2.5 py-1 rounded capitalize text-[11px] font-medium transition-colors ${
                      statusFilter === st
                        ? "bg-background text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger className="h-9 text-xs w-36">
                  <SelectValue placeholder="All Plans" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Plan Tiers</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tenants Table */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-muted-foreground uppercase tracking-wider text-[10px] font-semibold border-b border-border">
                  <tr>
                    <th className="px-4 py-3">Organization</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Plan Tier</th>
                    <th className="px-4 py-3">MRR</th>
                    <th className="px-4 py-3">Usage</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredTenants.map((t) => (
                    <tr
                      key={t.id}
                      className="hover:bg-muted/20 transition-colors group cursor-pointer"
                      onClick={() => setSelectedTenant(t)}
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="size-9 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0 font-bold text-xs">
                            {t.logo_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={t.logo_url} alt={t.name} className="size-full rounded-xl object-cover" />
                            ) : (
                              t.name.substring(0, 2).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground truncate">{t.name}</p>
                            <p className="text-[11px] text-muted-foreground font-mono truncate">
                              /{t.slug} • {t.contact_email || "no email"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <Badge
                          variant={
                            t.status === "active"
                              ? "default"
                              : t.status === "trial"
                              ? "secondary"
                              : "destructive"
                          }
                          className="capitalize text-[10px]"
                        >
                          {t.status}
                        </Badge>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <Badge variant="outline" className="uppercase text-[10px] font-mono">
                          {t.plan_tier || "pro"}
                        </Badge>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap font-medium text-foreground">
                        ${t.mrr || 0}/mo
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap text-muted-foreground text-[11px]">
                        <div className="flex items-center gap-2">
                          <span title="Team members">{t.memberCount} users</span>
                          <span>•</span>
                          <span title="CRM contacts">{t.contactsCount} contacts</span>
                          <span>•</span>
                          <span title="Active workflows">{t.workflowsCount} flows</span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedTenant(t)}
                            className="h-7 px-2.5 text-xs"
                          >
                            Manage
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleQuickImpersonate(t.id)}
                            className="h-7 px-2 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 gap-1"
                            title="Launch support impersonation mode"
                          >
                            <ShieldAlert className="size-3 text-amber-500" />
                            <span className="hidden sm:inline">Support</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}

                </tbody>
              </table>

              {filteredTenants.length === 0 && (
                <div className="p-12 text-center text-muted-foreground text-xs">
                  <Building2 className="size-8 mx-auto mb-2 opacity-40" />
                  <p className="font-medium text-foreground">No organizations found</p>
                  <p className="mt-1">Try adjusting your search query or status filter.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. SUBSCRIPTIONS & BILLING TAB */}
      {activeTab === "billing" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Free Plan</span>
                <Badge variant="secondary" className="text-[10px]">TIER</Badge>
              </div>
              <p className="text-2xl font-bold mt-1.5">{metrics.planDistribution.free || 0}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">$0/mo • Evaluation & Dev</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Starter Plan</span>
                <Badge variant="outline" className="text-[10px]">TIER</Badge>
              </div>
              <p className="text-2xl font-bold mt-1.5">{metrics.planDistribution.starter || 0}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                ${((metrics.planDistribution.starter || 0) * 49).toLocaleString()}/mo • $49/mo rate
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Pro Plan</span>
                <Badge variant="default" className="text-[10px]">POPULAR</Badge>
              </div>
              <p className="text-2xl font-bold mt-1.5">{metrics.planDistribution.pro || 0}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                ${((metrics.planDistribution.pro || 0) * 199).toLocaleString()}/mo • $199/mo rate
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium">Enterprise Plan</span>
                <Badge className="bg-amber-500 hover:bg-amber-600 text-[10px]">VIP</Badge>
              </div>
              <p className="text-2xl font-bold mt-1.5">{metrics.planDistribution.enterprise || 0}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                ${((metrics.planDistribution.enterprise || 0) * 599).toLocaleString()}/mo • $599/mo rate
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Tenant Billing Health & Subscription Statuses</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-muted/30 border border-border">
                <span className="text-muted-foreground">Active Subscriptions</span>
                <p className="text-lg font-bold text-emerald-600 mt-1">{metrics.subscriptionsByStatus.active || 0}</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/30 border border-border">
                <span className="text-muted-foreground">Trialing Accounts</span>
                <p className="text-lg font-bold text-blue-600 mt-1">{metrics.subscriptionsByStatus.trialing || 0}</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/30 border border-border">
                <span className="text-muted-foreground">Past Due Invoices</span>
                <p className="text-lg font-bold text-amber-600 mt-1">{metrics.subscriptionsByStatus.past_due || 0}</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/30 border border-border">
                <span className="text-muted-foreground">Canceled / Inactive</span>
                <p className="text-lg font-bold text-muted-foreground mt-1">{metrics.subscriptionsByStatus.canceled || 0}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. ACCESS & FEATURE FLAGS TAB */}
      {activeTab === "access" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Global Feature Flag Catalog</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Feature flags govern capabilities per tenant. Select any organization from the directory to toggle capabilities in real time.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
              <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="size-6 rounded bg-primary/10 text-primary flex items-center justify-center font-mono text-xs font-bold">API</div>
                  <h4 className="text-xs font-semibold text-foreground">Developer REST API</h4>
                </div>
                <p className="text-[11px] text-muted-foreground">Enables API keys and developer access endpoints.</p>
              </div>

              <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="size-6 rounded bg-primary/10 text-primary flex items-center justify-center font-mono text-xs font-bold">SSL</div>
                  <h4 className="text-xs font-semibold text-foreground">Custom Domains</h4>
                </div>
                <p className="text-[11px] text-muted-foreground">White-label CNAME routing for customer client portals.</p>
              </div>

              <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  <h4 className="text-xs font-semibold text-foreground">Advanced AI Models</h4>
                </div>
                <p className="text-[11px] text-muted-foreground">Unlocks multi-turn autonomous agents and MCP tool providers.</p>
              </div>

              <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-1.5">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="size-4 text-amber-500" />
                  <h4 className="text-xs font-semibold text-foreground">White Labeling</h4>
                </div>
                <p className="text-[11px] text-muted-foreground">Eliminates SpeciaLevel badges from invoices and public lead forms.</p>
              </div>

              <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Activity className="size-4 text-emerald-500" />
                  <h4 className="text-xs font-semibold text-foreground">SIP Telephony Voice</h4>
                </div>
                <p className="text-[11px] text-muted-foreground">Enables direct VoIP calling and browser dialer WebRTC audio.</p>
              </div>

              <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Zap className="size-4 text-purple-500" />
                  <h4 className="text-xs font-semibold text-foreground">Outbound Webhooks</h4>
                </div>
                <p className="text-[11px] text-muted-foreground">Dispatches real-time event payloads to external endpoints.</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Quick Access Control by Tenant</h3>
            <p className="text-xs text-muted-foreground">
              Click any tenant below to inspect flags, toggle access, or review audit history:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
              {tenants.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTenant(t)}
                  className="flex items-center justify-between p-3 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-muted/30 transition-all text-left group"
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-semibold text-foreground truncate">{t.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">/{t.slug}</p>
                  </div>
                  <Badge
                    variant={t.status === "active" ? "outline" : "destructive"}
                    className="capitalize text-[10px] shrink-0"
                  >
                    {t.status}
                  </Badge>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. AUDIT LOGS TAB */}
      {activeTab === "audit" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
            <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Platform Intervention Audit Trail</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tracks super admin interventions, tenant impersonations, plan modifications, and status updates.
                </p>
              </div>
            </div>

            <div className="divide-y divide-border">
              {logs.map((log) => (
                <div key={log.id} className="p-4 flex items-start justify-between gap-4 text-xs">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="size-8 rounded-lg bg-muted flex items-center justify-center shrink-0 text-foreground font-mono font-bold text-[10px]">
                      {log.action.substring(0, 3).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground capitalize">
                          {log.action.replace(/_/g, " ")}
                        </span>
                        {log.target_organization_name && (
                          <Badge variant="outline" className="text-[10px]">
                            {log.target_organization_name}
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground text-[11px] mt-0.5">
                        Admin: <span className="font-medium text-foreground">{log.admin_email || "System"}</span> • Target:{" "}
                        <span className="font-mono">{log.target_organization_id?.substring(0, 8)}...</span>
                      </p>
                      {log.details && Object.keys(log.details).length > 0 && (
                        <pre className="mt-1.5 p-2 rounded bg-muted/40 text-[10px] font-mono text-muted-foreground overflow-x-auto max-w-xl">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>

                  <span className="text-[11px] text-muted-foreground shrink-0 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>
              ))}

              {logs.length === 0 && (
                <div className="p-12 text-center text-muted-foreground text-xs">
                  <History className="size-8 mx-auto mb-2 opacity-40" />
                  <p className="font-medium text-foreground">No intervention logs recorded yet</p>
                  <p className="mt-1">Actions performed by super admins will automatically appear here.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tenant Management Drawer / Modal */}
      <TenantModal
        tenant={selectedTenant}
        open={!!selectedTenant}
        onOpenChange={(open) => {
          if (!open) setSelectedTenant(null);
        }}
        onRefresh={handleRefresh}
      />
    </div>
  );
}


