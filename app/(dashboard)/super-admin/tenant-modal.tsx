"use client";

import { useState, useTransition } from "react";
import {
  ShieldAlert,
  Building2,
  Users,
  TrendingUp,
  Zap,
  Layers,
  Sparkles,
  Loader2,
  Save,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FEATURE_FLAGS_CATALOG,
  type TenantStatus,
  type PlanTier,
} from "@/lib/validations/super-admin";
import {
  updateTenantStatus,
  updateTenantPlan,
  toggleTenantFeatureFlag,
  toggleTenantModule,
  saveTenantSupportNotes,
  startTenantImpersonation,
} from "@/lib/actions/super-admin";
import type { TenantWithMetrics } from "@/types/database";

interface TenantModalProps {
  tenant: TenantWithMetrics | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => void;
}

export function TenantModal({
  tenant,
  open,
  onOpenChange,
  onRefresh,
}: TenantModalProps) {
  if (!tenant) return null;

  return (
    <TenantModalContent
      tenant={tenant}
      open={open}
      onOpenChange={onOpenChange}
      onRefresh={onRefresh}
    />
  );
}

function TenantModalContent({
  tenant,
  open,
  onOpenChange,
  onRefresh,
}: {
  tenant: TenantWithMetrics;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => void;
}) {
  const [status, setStatus] = useState<TenantStatus>((tenant.status as TenantStatus) || "active");
  const [planTier, setPlanTier] = useState<PlanTier>((tenant.plan_tier as PlanTier) || "pro");
  const [mrr, setMrr] = useState<number>(tenant.mrr || 0);
  const [notes, setNotes] = useState<string>(tenant.support_notes || "");
  const [suspendReason, setSuspendReason] = useState<string>(tenant.suspended_reason || "");
  const [flags, setFlags] = useState<Record<string, boolean>>(
    (tenant.feature_flags as Record<string, boolean>) || {
      api_access: true,
      custom_domain: false,
      advanced_ai: true,
      white_label: false,
      telecom_sip: true,
      webhooks: true,
    }
  );

  const [activeTab, setActiveTab] = useState<"overview" | "access" | "modules" | "support">("overview");
  const [isPending, startTransition] = useTransition();
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleStatusChange = (newStatus: TenantStatus) => {
    setStatus(newStatus);
    startTransition(async () => {
      const res = await updateTenantStatus({
        organizationId: tenant.id,
        status: newStatus,
        reason: newStatus === "suspended" ? suspendReason : undefined,
      });
      if (res.status === "success") {
        setToastMessage({ type: "success", text: `Status changed to ${newStatus}` });
        onRefresh();
      } else {
        setToastMessage({ type: "error", text: res.error || "Failed to update status." });
      }
    });
  };

  const handlePlanChange = (newPlan: PlanTier) => {
    setPlanTier(newPlan);
    const defaultMrr: Record<PlanTier, number> = {
      free: 0,
      starter: 49,
      pro: 199,
      enterprise: 599,
    };
    const newMrr = defaultMrr[newPlan];
    setMrr(newMrr);

    startTransition(async () => {
      const res = await updateTenantPlan({
        organizationId: tenant.id,
        planTier: newPlan,
        mrr: newMrr,
      });
      if (res.status === "success") {
        setToastMessage({ type: "success", text: `Plan tier updated to ${newPlan.toUpperCase()}` });
        onRefresh();
      } else {
        setToastMessage({ type: "error", text: res.error || "Failed to update plan." });
      }
    });
  };

  const handleToggleFlag = (flagKey: string, currentVal: boolean) => {
    const newVal = !currentVal;
    setFlags((prev) => ({ ...prev, [flagKey]: newVal }));

    startTransition(async () => {
      const res = await toggleTenantFeatureFlag({
        organizationId: tenant.id,
        flagKey,
        isEnabled: newVal,
      });
      if (res.status === "success") {
        setToastMessage({ type: "success", text: `Feature flag updated` });
        onRefresh();
      }
    });
  };

  const handleToggleModule = (moduleKey: string, currentVal: boolean) => {
    const newVal = !currentVal;
    startTransition(async () => {
      const res = await toggleTenantModule({
        organizationId: tenant.id,
        moduleKey,
        isEnabled: newVal,
      });
      if (res.status === "success") {
        setToastMessage({ type: "success", text: `Module updated` });
        onRefresh();
      }
    });
  };

  const handleSaveNotes = () => {
    startTransition(async () => {
      const res = await saveTenantSupportNotes({
        organizationId: tenant.id,
        notes,
      });
      if (res.status === "success") {
        setToastMessage({ type: "success", text: "Support notes saved successfully." });
        onRefresh();
      } else {
        setToastMessage({ type: "error", text: res.error || "Failed to save notes." });
      }
    });
  };

  const handleImpersonate = () => {
    startTransition(async () => {
      const res = await startTenantImpersonation({ organizationId: tenant.id });
      if (res.status === "success") {
        window.location.href = "/dashboard";
      } else {
        setToastMessage({ type: "error", text: res.error || "Failed to launch support mode." });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="p-6 border-b border-border bg-muted/30 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="size-12 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0 font-bold text-lg">
                {tenant.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={tenant.logo_url} alt={tenant.name} className="size-full rounded-xl object-cover" />
                ) : (
                  tenant.name.substring(0, 2).toUpperCase()
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-lg font-bold">{tenant.name}</DialogTitle>
                  <Badge
                    variant={
                      status === "active"
                        ? "default"
                        : status === "trial"
                        ? "secondary"
                        : "destructive"
                    }
                    className="capitalize text-[10px]"
                  >
                    {status}
                  </Badge>
                  <Badge variant="outline" className="uppercase text-[10px] font-mono">
                    {planTier}
                  </Badge>
                </div>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Slug: <span className="font-mono text-foreground">{tenant.slug}</span> • ID:{" "}
                  <span className="font-mono">{tenant.id.substring(0, 8)}...</span> • Created:{" "}
                  {new Date(tenant.created_at).toLocaleDateString()}
                </DialogDescription>
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={handleImpersonate}
              className="gap-1.5 text-xs border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-600 text-amber-600 shrink-0"
            >
              <ShieldAlert className="size-3.5 text-amber-500" />
              <span>Launch Support Mode</span>
            </Button>
          </div>

          {toastMessage && (
            <div
              className={`mt-4 px-3 py-1.5 rounded-lg text-xs flex items-center justify-between ${
                toastMessage.type === "success"
                  ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                  : "bg-destructive/10 text-destructive border border-destructive/20"
              }`}
            >
              <span>{toastMessage.text}</span>
              <button onClick={() => setToastMessage(null)} className="hover:underline text-[10px]">
                Close
              </button>
            </div>
          )}

          {/* Navigation Subtabs */}
          <div className="flex items-center gap-2 pt-4 border-t border-border/50 mt-4">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                activeTab === "overview"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Usage & Metrics
            </button>
            <button
              onClick={() => setActiveTab("access")}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                activeTab === "access"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Access & Tier
            </button>
            <button
              onClick={() => setActiveTab("modules")}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                activeTab === "modules"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Modules & Feature Flags
            </button>
            <button
              onClick={() => setActiveTab("support")}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                activeTab === "support"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Support Notes
            </button>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-6">
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-border bg-card p-3">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-[11px] font-medium">Team Members</span>
                    <Users className="size-3.5" />
                  </div>
                  <p className="text-xl font-bold mt-1">{tenant.memberCount}</p>
                </div>

                <div className="rounded-xl border border-border bg-card p-3">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-[11px] font-medium">CRM Contacts</span>
                    <Building2 className="size-3.5" />
                  </div>
                  <p className="text-xl font-bold mt-1">{tenant.contactsCount}</p>
                </div>

                <div className="rounded-xl border border-border bg-card p-3">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-[11px] font-medium">CRM Deals</span>
                    <TrendingUp className="size-3.5" />
                  </div>
                  <p className="text-xl font-bold mt-1">{tenant.dealsCount}</p>
                </div>

                <div className="rounded-xl border border-border bg-card p-3">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-[11px] font-medium">Workflows</span>
                    <Zap className="size-3.5" />
                  </div>
                  <p className="text-xl font-bold mt-1">{tenant.workflowsCount}</p>
                </div>
              </div>

              <div className="rounded-xl border border-border p-4 bg-muted/20 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Billing & Financial Overview
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground">Monthly MRR:</span>
                    <p className="font-semibold text-sm text-foreground mt-0.5">${mrr}/mo</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Invoices Issued:</span>
                    <p className="font-semibold text-sm text-foreground mt-0.5">{tenant.invoicesCount}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Invoiced Volume:</span>
                    <p className="font-semibold text-sm text-foreground mt-0.5">
                      ${tenant.invoicesVolume.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <h4 className="font-semibold uppercase tracking-wider text-muted-foreground">
                  Tenant Contact & Settings
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground">
                  <div>
                    Contact Email:{" "}
                    <span className="text-foreground font-medium">
                      {tenant.contact_email || "Not specified"}
                    </span>
                  </div>
                  <div>
                    Contact Phone:{" "}
                    <span className="text-foreground font-medium">
                      {tenant.contact_phone || "Not specified"}
                    </span>
                  </div>
                  <div>
                    Website:{" "}
                    <span className="text-foreground font-medium">
                      {tenant.website || "Not specified"}
                    </span>
                  </div>
                  <div>
                    Timezone:{" "}
                    <span className="text-foreground font-medium">{tenant.timezone || "UTC"}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "access" && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Account Access Status</Label>
                  <Select value={status} onValueChange={(val: any) => handleStatusChange(val)}>
                    <SelectTrigger className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active (Normal Access)</SelectItem>
                      <SelectItem value="trial">Trialing (Evaluation Period)</SelectItem>
                      <SelectItem value="restricted">Restricted (Limited / Read-only)</SelectItem>
                      <SelectItem value="suspended">Suspended (Locked Workspace)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Suspended tenants cannot log in or trigger platform workflows.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Subscription Plan Tier</Label>
                  <Select value={planTier} onValueChange={(val: any) => handlePlanChange(val)}>
                    <SelectTrigger className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free ($0/mo)</SelectItem>
                      <SelectItem value="starter">Starter ($49/mo)</SelectItem>
                      <SelectItem value="pro">Pro ($199/mo)</SelectItem>
                      <SelectItem value="enterprise">Enterprise ($599/mo)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Modifying the tier recalculates platform revenue and feature defaults.
                  </p>
                </div>
              </div>

              {status === "suspended" && (
                <div className="space-y-1.5 p-3 rounded-xl border border-destructive/30 bg-destructive/5">
                  <Label className="text-xs font-medium text-destructive">
                    Reason for Suspension (Visible to Admins)
                  </Label>
                  <Textarea
                    value={suspendReason}
                    onChange={(e) => setSuspendReason(e.target.value)}
                    placeholder="e.g. Terms violation, overdue billing invoice #104..."
                    className="text-xs min-h-[60px]"
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleStatusChange("suspended")}
                    className="h-7 text-xs mt-1"
                  >
                    Save Suspension Reason
                  </Button>
                </div>
              )}
            </div>
          )}
          {activeTab === "modules" && (
            <div className="space-y-6">
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-primary" />
                  <span>Platform Feature Flags</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {FEATURE_FLAGS_CATALOG.map((f) => {
                    const isEnabled = !!flags[f.key];
                    return (
                      <div
                        key={f.key}
                        className="flex items-center justify-between p-3 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors"
                      >
                        <div className="min-w-0 pr-3">
                          <p className="text-xs font-medium text-foreground truncate">{f.label}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{f.description}</p>
                        </div>
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={() => handleToggleFlag(f.key, isEnabled)}
                          className="scale-80"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-border">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Layers className="size-3.5 text-primary" />
                  <span>Installed Workspace Modules</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(tenant.modules || []).map((m) => (
                    <div
                      key={m.module_key}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card"
                    >
                      <span className="text-xs font-medium capitalize truncate">
                        {m.module_name || m.module_key}
                      </span>
                      <Switch
                        checked={m.is_enabled}
                        onCheckedChange={() => handleToggleModule(m.module_key, m.is_enabled)}
                        className="scale-75"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "support" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Internal Super Admin Support Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Record customer support tickets, VIP SLA arrangements, or compliance notes..."
                  className="min-h-[140px] text-xs leading-relaxed"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleSaveNotes}
                  disabled={isPending}
                  className="gap-1.5 text-xs h-8"
                >
                  {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                  <span>Save Notes</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
