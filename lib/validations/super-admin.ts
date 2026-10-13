import { z } from "zod";

export const TENANT_STATUSES = ["active", "suspended", "restricted", "trial"] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

export const PLAN_TIERS = ["free", "starter", "pro", "enterprise"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

export const SUBSCRIPTION_STATUSES = [
  "active",
  "trialing",
  "past_due",
  "canceled",
  "unpaid",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const FEATURE_FLAGS_CATALOG = [
  { key: "api_access", label: "Public & Developer API Access", description: "Enables REST APIs and webhooks access." },
  { key: "custom_domain", label: "Custom White-label Domains", description: "Allows custom SSL domain routing for client portals." },
  { key: "advanced_ai", label: "Advanced AI Agents & Models", description: "Access to Claude, GPT-4o, and reasoning models." },
  { key: "white_label", label: "Complete Brand White-labeling", description: "Hides SpeciaLevel brand markers on client invoices & portals." },
  { key: "telecom_sip", label: "Telecom SIP Trunking & Voice", description: "Enables WebRTC dialer and telephony outbound lines." },
  { key: "webhooks", label: "Outbound Webhooks Integration", description: "Enables real-time webhook event dispatches." },
  { key: "social_planner_addon", label: "Social Media Multi-Planner", description: "Enables scheduling to Facebook, LinkedIn, Twitter, Instagram." },
] as const;

export const updateTenantStatusSchema = z.object({
  organizationId: z.string().uuid("Invalid organization ID."),
  status: z.enum(TENANT_STATUSES),
  reason: z.string().max(500).optional().nullable(),
});

export const updateTenantPlanSchema = z.object({
  organizationId: z.string().uuid("Invalid organization ID."),
  planTier: z.enum(PLAN_TIERS),
  mrr: z.number().min(0).optional(),
  subscriptionStatus: z.enum(SUBSCRIPTION_STATUSES).optional(),
});

export const toggleTenantFeatureFlagSchema = z.object({
  organizationId: z.string().uuid("Invalid organization ID."),
  flagKey: z.string().min(1),
  isEnabled: z.boolean(),
});

export const toggleTenantModuleSchema = z.object({
  organizationId: z.string().uuid("Invalid organization ID."),
  moduleKey: z.string().min(1),
  isEnabled: z.boolean(),
});

export const saveTenantSupportNotesSchema = z.object({
  organizationId: z.string().uuid("Invalid organization ID."),
  notes: z.string().max(4000).optional().nullable(),
});

export const impersonateTenantSchema = z.object({
  organizationId: z.string().uuid("Invalid organization ID."),
});
