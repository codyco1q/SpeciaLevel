"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getAdminSession } from "@/lib/auth/admin";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  updateTenantStatusSchema,
  updateTenantPlanSchema,
  toggleTenantFeatureFlagSchema,
  toggleTenantModuleSchema,
  saveTenantSupportNotesSchema,
  impersonateTenantSchema,
  type TenantStatus,
  type PlanTier,
} from "@/lib/validations/super-admin";
import type {
  PlatformMetrics,
  TenantWithMetrics,
  SuperAdminAuditLog,
  Organization,
} from "@/types/database";

export async function checkIsSuperAdmin(): Promise<{
  isSuperAdmin: boolean;
  userId?: string;
  email?: string;
  error?: string;
}> {
  // Super Admin is strictly restricted to platform admins authenticated via admin credentials.
  // Normal organization roles (owners/admins) and tenant permissions do NOT grant platform admin rights.
  const adminSession = await getAdminSession();
  if (adminSession.isAuthenticated) {
    return {
      isSuperAdmin: true,
      userId: "platform_admin",
      email: adminSession.username || "admin",
    };
  }

  return {
    isSuperAdmin: false,
    error: "Unauthorized: Platform Admin credentials required.",
  };
}

async function requireSuperAdmin() {
  const auth = await checkIsSuperAdmin();
  if (!auth.isSuperAdmin) {
    throw new Error("Unauthorized: Platform Admin access required.");
  }
  return auth;
}

export async function logSuperAdminAction(params: {
  targetOrgId: string;
  targetOrgName?: string;
  action: string;
  details?: Record<string, any>;
}) {
  try {
    const auth = await checkIsSuperAdmin();
    const supabase = createServiceRoleClient();
    await supabase.from("super_admin_audit_logs").insert({
      admin_user_id: null,
      admin_email: auth.email || "admin",
      target_organization_id: params.targetOrgId,
      target_organization_name: params.targetOrgName || null,
      action: params.action,
      details: params.details || {},
    });
  } catch (err) {
    console.error("[super-admin] Failed to record audit log:", err);
  }
}

export async function getSuperAdminDashboardData(filters?: {
  search?: string;
  status?: string;
  plan?: string;
}): Promise<{
  metrics: PlatformMetrics;
  tenants: TenantWithMetrics[];
  recentLogs: SuperAdminAuditLog[];
}> {
  await requireSuperAdmin();
  const supabase = createServiceRoleClient();

  // 1. Fetch all organizations
  const { data: orgsData, error: orgsErr } = await supabase
    .from("organizations")
    .select("*")
    .order("created_at", { ascending: false });

  if (orgsErr) {
    console.error("[super-admin] Failed to fetch organizations:", orgsErr);
    throw new Error("Failed to load organizations.");
  }

  const allOrgs: Organization[] = orgsData || [];

  // 2. Fetch usage metrics across platform in parallel
  const [
    profilesRes,
    contactsRes,
    dealsRes,
    tasksRes,
    workflowsRes,
    invoicesRes,
    modulesRes,
    auditLogsRes,
  ] = await Promise.all([
    supabase.from("profiles").select("id, organization_id"),
    supabase.from("crm_contacts").select("id, organization_id"),
    supabase.from("crm_deals").select("id, organization_id"),
    supabase.from("tasks").select("id, organization_id"),
    supabase.from("automation_workflows").select("id, organization_id"),
    supabase.from("invoices").select("id, organization_id, total_amount, status"),
    supabase.from("organization_modules").select("organization_id, module_key, module_name, is_enabled"),
    supabase.from("super_admin_audit_logs").select("*").order("created_at", { ascending: false }).limit(25),
  ]);

  // Index metrics by organization
  const countsByOrg: Record<
    string,
    {
      members: number;
      contacts: number;
      deals: number;
      tasks: number;
      workflows: number;
      invoices: number;
      invoicesVol: number;
    }
  > = {};

  const initOrgCounts = (id: string) => {
    if (!countsByOrg[id]) {
      countsByOrg[id] = {
        members: 0,
        contacts: 0,
        deals: 0,
        tasks: 0,
        workflows: 0,
        invoices: 0,
        invoicesVol: 0,
      };
    }
  };

  (profilesRes.data || []).forEach((p) => {
    if (p.organization_id) {
      initOrgCounts(p.organization_id);
      countsByOrg[p.organization_id].members++;
    }
  });

  (contactsRes.data || []).forEach((c) => {
    if (c.organization_id) {
      initOrgCounts(c.organization_id);
      countsByOrg[c.organization_id].contacts++;
    }
  });

  (dealsRes.data || []).forEach((d) => {
    if (d.organization_id) {
      initOrgCounts(d.organization_id);
      countsByOrg[d.organization_id].deals++;
    }
  });

  (tasksRes.data || []).forEach((t) => {
    if (t.organization_id) {
      initOrgCounts(t.organization_id);
      countsByOrg[t.organization_id].tasks++;
    }
  });

  (workflowsRes.data || []).forEach((w) => {
    if (w.organization_id) {
      initOrgCounts(w.organization_id);
      countsByOrg[w.organization_id].workflows++;
    }
  });

  (invoicesRes.data || []).forEach((i) => {
    if (i.organization_id) {
      initOrgCounts(i.organization_id);
      countsByOrg[i.organization_id].invoices++;
      countsByOrg[i.organization_id].invoicesVol += Number(i.total_amount) || 0;
    }
  });

  // Group modules by organization
  const modulesByOrg: Record<string, any[]> = {};
  (modulesRes.data || []).forEach((m) => {
    if (!modulesByOrg[m.organization_id]) {
      modulesByOrg[m.organization_id] = [];
    }
    modulesByOrg[m.organization_id].push({
      module_key: m.module_key,
      module_name: m.module_name,
      is_enabled: m.is_enabled,
    });
  });
  // 3. Compute Platform Summary Metrics
  let totalMrr = 0;
  let activeCount = 0;
  let trialCount = 0;
  let suspendedCount = 0;
  let restrictedCount = 0;

  const planDistribution: Record<string, number> = {
    free: 0,
    starter: 0,
    pro: 0,
    enterprise: 0,
  };

  const subscriptionsByStatus: Record<string, number> = {
    active: 0,
    trialing: 0,
    past_due: 0,
    canceled: 0,
    unpaid: 0,
  };

  const defaultPricing: Record<PlanTier, number> = {
    free: 0,
    starter: 49,
    pro: 199,
    enterprise: 599,
  };

  const tenants: TenantWithMetrics[] = allOrgs.map((org) => {
    const status: TenantStatus = (org.status as TenantStatus) || "active";
    const planTier: PlanTier = (org.plan_tier as PlanTier) || "pro";
    const subStatus = org.subscription_status || "active";
    const mrr = Number(org.mrr ?? defaultPricing[planTier]) || 0;

    totalMrr += mrr;
    if (status === "active") activeCount++;
    if (status === "trial") trialCount++;
    if (status === "suspended") suspendedCount++;
    if (status === "restricted") restrictedCount++;

    planDistribution[planTier] = (planDistribution[planTier] || 0) + 1;
    subscriptionsByStatus[subStatus] = (subscriptionsByStatus[subStatus] || 0) + 1;

    const orgCounts = countsByOrg[org.id] || {
      members: 0,
      contacts: 0,
      deals: 0,
      tasks: 0,
      workflows: 0,
      invoices: 0,
      invoicesVol: 0,
    };

    return {
      ...org,
      status,
      plan_tier: planTier,
      subscription_status: subStatus,
      mrr,
      memberCount: orgCounts.members,
      contactsCount: orgCounts.contacts,
      dealsCount: orgCounts.deals,
      tasksCount: orgCounts.tasks,
      workflowsCount: orgCounts.workflows,
      invoicesCount: orgCounts.invoices,
      invoicesVolume: orgCounts.invoicesVol,
      modules: modulesByOrg[org.id] || [],
    };
  });

  const totalUsers = (profilesRes.data || []).length;
  const totalOrgsCount = allOrgs.length;
  const averageRevenuePerTenant = totalOrgsCount > 0 ? totalMrr / totalOrgsCount : 0;

  const metrics: PlatformMetrics = {
    totalOrganizations: totalOrgsCount,
    activeOrganizations: activeCount,
    trialOrganizations: trialCount,
    suspendedOrganizations: suspendedCount,
    restrictedOrganizations: restrictedCount,
    totalMrr,
    totalArr: totalMrr * 12,
    averageRevenuePerTenant: Math.round(averageRevenuePerTenant),
    totalUsers,
    planDistribution,
    subscriptionsByStatus,
  };

  let filteredTenants = tenants;
  if (filters?.search) {
    const q = filters.search.toLowerCase().trim();
    filteredTenants = filteredTenants.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q) ||
        (t.contact_email && t.contact_email.toLowerCase().includes(q))
    );
  }

  if (filters?.status && filters.status !== "all") {
    filteredTenants = filteredTenants.filter((t) => t.status === filters.status);
  }

  if (filters?.plan && filters.plan !== "all") {
    filteredTenants = filteredTenants.filter((t) => t.plan_tier === filters.plan);
  }

  return {
    metrics,
    tenants: filteredTenants,
    recentLogs: (auditLogsRes.data || []) as SuperAdminAuditLog[],
  };
}

export async function updateTenantStatus(input: {
  organizationId: string;
  status: TenantStatus;
  reason?: string | null;
}): Promise<{ status: "success" | "error"; error?: string }> {
  await requireSuperAdmin();
  const parsed = updateTenantStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", error: "Invalid parameters." };
  }

  const { organizationId, status, reason } = parsed.data;
  const supabase = createServiceRoleClient();

  const updatePayload: Record<string, any> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === "suspended") {
    updatePayload.suspended_at = new Date().toISOString();
    updatePayload.suspended_reason = reason || "Suspended by Super Admin";
  } else {
    updatePayload.suspended_at = null;
    updatePayload.suspended_reason = null;
  }

  const { data: org, error } = await supabase
    .from("organizations")
    .update(updatePayload)
    .eq("id", organizationId)
    .select("name")
    .single();

  if (error) {
    console.error("[super-admin] Status update failed:", error);
    return { status: "error", error: error.message };
  }

  await logSuperAdminAction({
    targetOrgId: organizationId,
    targetOrgName: org?.name,
    action: "status_change",
    details: { status, reason },
  });

  revalidatePath("/admin");
  revalidatePath("/super-admin");
  revalidatePath("/dashboard");
  return { status: "success" };
}

export async function updateTenantPlan(input: {
  organizationId: string;
  planTier: PlanTier;
  mrr?: number;
  subscriptionStatus?: string;
}): Promise<{ status: "success" | "error"; error?: string }> {
  await requireSuperAdmin();
  const parsed = updateTenantPlanSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", error: "Invalid parameters." };
  }

  const { organizationId, planTier, mrr, subscriptionStatus } = parsed.data;
  const supabase = createServiceRoleClient();

  const defaultPricing: Record<PlanTier, number> = {
    free: 0,
    starter: 49,
    pro: 199,
    enterprise: 599,
  };

  const calculatedMrr = mrr !== undefined ? mrr : defaultPricing[planTier];

  const { data: org, error } = await supabase
    .from("organizations")
    .update({
      plan_tier: planTier,
      mrr: calculatedMrr,
      subscription_status: subscriptionStatus || "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId)
    .select("name")
    .single();

  if (error) {
    console.error("[super-admin] Plan update failed:", error);
    return { status: "error", error: error.message };
  }

  await logSuperAdminAction({
    targetOrgId: organizationId,
    targetOrgName: org?.name,
    action: "plan_tier_change",
    details: { planTier, mrr: calculatedMrr, subscriptionStatus },
  });

  revalidatePath("/admin");
  revalidatePath("/super-admin");
  return { status: "success" };
}

export async function toggleTenantFeatureFlag(input: {
  organizationId: string;
  flagKey: string;
  isEnabled: boolean;
}): Promise<{ status: "success" | "error"; error?: string }> {
  await requireSuperAdmin();
  const parsed = toggleTenantFeatureFlagSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", error: "Invalid parameters." };
  }

  const { organizationId, flagKey, isEnabled } = parsed.data;
  const supabase = createServiceRoleClient();

  const { data: orgRow } = await supabase
    .from("organizations")
    .select("name, feature_flags")
    .eq("id", organizationId)
    .single();

  const currentFlags = (orgRow?.feature_flags as Record<string, boolean>) || {};
  const updatedFlags = { ...currentFlags, [flagKey]: isEnabled };

  const { error } = await supabase
    .from("organizations")
    .update({
      feature_flags: updatedFlags,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  if (error) {
    console.error("[super-admin] Feature flag update failed:", error);
    return { status: "error", error: error.message };
  }

  await logSuperAdminAction({
    targetOrgId: organizationId,
    targetOrgName: orgRow?.name,
    action: "feature_flag_toggle",
    details: { flagKey, isEnabled },
  });

  revalidatePath("/admin");
  revalidatePath("/super-admin");
  return { status: "success" };
}

export async function toggleTenantModule(input: {
  organizationId: string;
  moduleKey: string;
  isEnabled: boolean;
}): Promise<{ status: "success" | "error"; error?: string }> {
  await requireSuperAdmin();
  const parsed = toggleTenantModuleSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", error: "Invalid parameters." };
  }

  const { organizationId, moduleKey, isEnabled } = parsed.data;
  const supabase = createServiceRoleClient();

  // Check if row already exists in organization_modules
  const { data: existing } = await supabase
    .from("organization_modules")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("module_key", moduleKey)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("organization_modules")
      .update({ is_enabled: isEnabled, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await supabase.from("organization_modules").insert({
      organization_id: organizationId,
      module_key: moduleKey,
      module_name: moduleKey.charAt(0).toUpperCase() + moduleKey.slice(1),
      is_enabled: isEnabled,
    });
  }

  await logSuperAdminAction({
    targetOrgId: organizationId,
    action: "module_toggle",
    details: { moduleKey, isEnabled },
  });

  revalidatePath("/admin");
  revalidatePath("/super-admin");
  revalidatePath("/modules");
  return { status: "success" };
}

export async function saveTenantSupportNotes(input: {
  organizationId: string;
  notes?: string | null;
}): Promise<{ status: "success" | "error"; error?: string }> {
  await requireSuperAdmin();
  const parsed = saveTenantSupportNotesSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", error: "Invalid parameters." };
  }

  const { organizationId, notes } = parsed.data;
  const supabase = createServiceRoleClient();

  const { data: org, error } = await supabase
    .from("organizations")
    .update({
      support_notes: notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId)
    .select("name")
    .single();

  if (error) {
    return { status: "error", error: error.message };
  }

  await logSuperAdminAction({
    targetOrgId: organizationId,
    targetOrgName: org?.name,
    action: "support_notes_update",
    details: { hasNotes: !!notes },
  });

  revalidatePath("/admin");
  revalidatePath("/super-admin");
  return { status: "success" };
}

export async function startTenantImpersonation(input: {
  organizationId: string;
}): Promise<{ status: "success" | "error"; error?: string; organization?: Organization }> {
  const auth = await requireSuperAdmin();
  const parsed = impersonateTenantSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", error: "Invalid organization ID." };
  }

  const { organizationId } = parsed.data;
  const supabase = createServiceRoleClient();

  const { data: org, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", organizationId)
    .single();

  if (error || !org) {
    return { status: "error", error: "Target organization not found." };
  }

  const cookieStore = await cookies();
  cookieStore.set("impersonate_org_id", organizationId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7200, // 2 hours support session
  });

  await logSuperAdminAction({
    targetOrgId: organizationId,
    targetOrgName: org.name,
    action: "impersonate_start",
    details: { adminEmail: auth.email },
  });

  revalidatePath("/", "layout");
  return { status: "success", organization: org as Organization };
}

export async function stopTenantImpersonation(): Promise<{ status: "success" }> {
  const cookieStore = await cookies();
  const targetOrgId = cookieStore.get("impersonate_org_id")?.value;

  if (targetOrgId) {
    await logSuperAdminAction({
      targetOrgId,
      action: "impersonate_stop",
      details: {},
    });
  }

  cookieStore.delete("impersonate_org_id");
  revalidatePath("/", "layout");
  return { status: "success" };
}

export async function getImpersonatedOrganization(): Promise<Organization | null> {
  try {
    const auth = await checkIsSuperAdmin();
    if (!auth.isSuperAdmin) return null;

    const cookieStore = await cookies();
    const orgId = cookieStore.get("impersonate_org_id")?.value;
    if (!orgId) return null;

    const supabase = createServiceRoleClient();
    const { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", orgId)
      .maybeSingle();

    return (org as Organization) || null;
  } catch {
    return null;
  }
}



