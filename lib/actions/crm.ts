"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import {
  createCrmDealInputSchema,
  crmStageSchema,
  type CrmActionState,
  type CrmDealInput,
} from "@/lib/validations/crm";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type {
  CrmStage,
  MarketingLeadStatus,
} from "@/types/database";

/**
 * CRM server actions.
 *
 * Security model:
 *  - organization_id / created_by come exclusively from the session.
 *  - Viewing requires `crm.view`; create + convert require `crm.manage`;
 *    stage moves accept `crm.view` or `crm.manage`.
 *  - Updates verify the row belongs to the caller's organization in the
 *    same statement (RLS backstops this, but frontend checks never stand
 *    alone). Input is re-validated with Zod server-side. The
 *    marketing_leads table additionally enforces reads/writes via RLS
 *    (crm.manage only).
 */

export interface CrmPerson {
  id: string;
  fullName: string | null;
  email: string | null;
}

export interface DealContact {
  id: string;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
}

export interface DealRow {
  id: string;
  title: string;
  value: number;
  currency: string;
  stage: CrmStage;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  contact: DealContact | null;
  assignee: CrmPerson | null;
}

export interface MarketingLeadRow {
  id: string;
  name: string;
  email: string;
  company: string | null;
  bottleneck: string | null;
  packageOfInterest: string | null;
  status: MarketingLeadStatus;
  createdAt: string;
}

type CrmAuthResult =
  | { ok: true; organizationId: string; userId: string }
  | { ok: false; error: CrmActionState };

/** Verifies the session, org, and that the caller holds the given permission. */
async function requireCrmPermission(
  permission: "crm.view" | "crm.manage"
): Promise<CrmAuthResult> {
  const userContext = await getCurrentUserContext();
  const dict = await getDictionary();
  const err = dict.platform.crm.errors;

  if (!userContext) {
    return { ok: false, error: { status: "error", error: err.signedIn } };
  }
  if (!hasPermission(permission, userContext.permissions)) {
    return { ok: false, error: { status: "error", error: err.noPermission } };
  }

  const organizationId = userContext.organization?.id;
  if (!organizationId) {
    return { ok: false, error: { status: "error", error: err.noOrg } };
  }

  return { ok: true, organizationId, userId: userContext.user.id };
}

function parseFieldErrors(
  issues: z.ZodIssue[]
): CrmActionState["fieldErrors"] {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string") {
      (fieldErrors[key] ??= []).push(issue.message);
    }
  }
  return fieldErrors;
}

/** PostgREST may return a single object or an array for a to-one join. */
function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value as T;
}

interface DealJoinRow {
  id: string;
  title: string;
  value: string | number;
  currency: string;
  stage: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  contact: {
    id: string;
    name: string;
    email: string;
    company: string | null;
    phone: string | null;
  } | null;
  assignee: {
    id: string;
    full_name: string | null;
    email: string | null;
  } | null;
}

function toDealRow(row: DealJoinRow): DealRow {
  const contact = firstOf(row.contact);
  const assignee = firstOf(row.assignee);
  return {
    id: row.id,
    title: row.title,
    value: Number(row.value) || 0,
    currency: row.currency,
    stage: row.stage as CrmStage,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    contact: contact
      ? {
          id: contact.id,
          name: contact.name,
          email: contact.email,
          company: contact.company ?? null,
          phone: contact.phone ?? null,
        }
      : null,
    assignee: assignee
      ? {
          id: assignee.id,
          fullName: assignee.full_name ?? null,
          email: assignee.email ?? null,
        }
      : null,
  };
}

/**
 * Retrieves the current organization's deals with their linked contact
 * and assignee profiles. Requires `crm.view`.
 */
export async function getDeals(): Promise<DealRow[] | null> {
  const userContext = await getCurrentUserContext();
  if (!userContext || !hasPermission("crm.view", userContext.permissions)) {
    return null;
  }

  const organizationId = userContext.organization?.id;
  if (!organizationId) return null;

  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("crm_deals")
    .select(
      `
        id,
        title,
        value,
        currency,
        stage,
        notes,
        created_at,
        updated_at,
        contact:crm_contacts(id, name, email, company, phone),
        assignee:profiles!fk_crm_deals_assigned_to(id, full_name, email)
      `
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    console.error("[crm] deals fetch failed:", error?.message ?? "no rows");
    return null;
  }

  return (data as unknown as DealJoinRow[]).map(toDealRow);
}

/**
 * Returns public marketing-site leads. Requires `crm.view` at the app
 * layer; RLS additionally restricts reads to holders of `crm.manage`.
 */
export async function getMarketingLeads(): Promise<MarketingLeadRow[] | null> {
  const userContext = await getCurrentUserContext();
  if (!userContext || !hasPermission("crm.view", userContext.permissions)) {
    return null;
  }

  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("marketing_leads")
    .select(
      "id, name, email, company, bottleneck, package_of_interest, status, created_at"
    )
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("[crm] lead fetch failed:", error?.message ?? "no rows");
    return null;
  }

  return (data as {
    id: string;
    name: string;
    email: string;
    company: string | null;
    bottleneck: string | null;
    package_of_interest: string | null;
    status: string;
    created_at: string;
  }[]).map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    company: row.company,
    bottleneck: row.bottleneck,
    packageOfInterest: row.package_of_interest,
    status: row.status as MarketingLeadStatus,
    createdAt: row.created_at,
  }));
}

/**
 * Finds an existing contact with the same email in the organization, or
 * creates one. Returns `null` when no contact should be linked; returns
 * `{ error }` when creation failed.
 */
async function resolveContactId(
  organizationId: string,
  contact: CrmDealInput["contact"]
): Promise<{ id: string | null; error?: string }> {
  if (!contact?.name || !contact.email) return { id: null };

  const supabase = await createServerClient();

  const { data: existing } = await supabase
    .from("crm_contacts")
    .select("id")
    .ilike("email", contact.email)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (existing) return { id: existing.id };

  const { data: created, error } = await supabase
    .from("crm_contacts")
    .insert({
      organization_id: organizationId,
      name: contact.name,
      email: contact.email,
      company: contact.company || null,
      phone: contact.phone || null,
    })
    .select("id")
    .single();

  if (error || !created) {
    console.error("[crm] contact create failed:", error?.message);
    return { id: null, error: error?.message };
  }
  return { id: created.id };
}

/**
 * Creates a deal (and optionally a linked contact) in the current
 * organization. Requires `crm.manage`.
 */
export async function createDeal(
  data: CrmDealInput
): Promise<CrmActionState> {
  const auth = await requireCrmPermission("crm.manage");
  if (!auth.ok) return auth.error;

  const dict = await getDictionary();
  const err = dict.platform.crm.errors;

  const parsed = createCrmDealInputSchema(err).safeParse(data);
  if (!parsed.success) {
    return {
      status: "error",
      error: err.highlightFields,
      fieldErrors: parseFieldErrors(parsed.error.issues),
    };
  }

  const contact = await resolveContactId(
    auth.organizationId,
    parsed.data.contact
  );
  if (contact.error) {
    return { status: "error", error: err.createFailed };
  }

  const supabase = await createServerClient();

  const { error } = await supabase.from("crm_deals").insert({
    organization_id: auth.organizationId,
    contact_id: contact.id,
    title: parsed.data.title,
    value: parsed.data.value,
    currency: parsed.data.currency,
    stage: parsed.data.stage,
    notes: parsed.data.notes || null,
    assigned_to: parsed.data.assignedTo || null,
    created_by: auth.userId,
  });

  if (error) {
    console.error("[crm] deal create failed:", error.message);
    return { status: "error", error: err.createFailed };
  }

  revalidatePath("/crm");
  return { status: "success" };
}

/**
 * Moves a single deal to another pipeline stage. Requires `crm.view` or
 * `crm.manage`; the deal must belong to the caller's organization.
 */
export async function updateDealStage(
  dealId: string,
  stage: string
): Promise<CrmActionState> {
  const userContext = await getCurrentUserContext();
  const dict = await getDictionary();
  const err = dict.platform.crm.errors;

  if (!userContext) {
    return { status: "error", error: err.signedIn };
  }
  const organizationId = userContext.organization?.id;
  if (!organizationId) {
    return { status: "error", error: err.noOrg };
  }
  if (
    !hasPermission("crm.view", userContext.permissions) &&
    !hasPermission("crm.manage", userContext.permissions)
  ) {
    return { status: "error", error: err.noPermission };
  }
  if (!dealId) {
    return { status: "error", error: err.missingId };
  }

  const parsed = crmStageSchema.safeParse(stage);
  if (!parsed.success) {
    return { status: "error", error: err.stageInvalid };
  }

  const supabase = await createServerClient();

  const { data: updated, error } = await supabase
    .from("crm_deals")
    .update({ stage: parsed.data, updated_at: new Date().toISOString() })
    .eq("id", dealId)
    .eq("organization_id", organizationId)
    .select("id");

  if (error) {
    console.error("[crm] stage update failed:", error.message);
    return { status: "error", error: err.updateFailed };
  }
  if (!updated || updated.length === 0) {
    return { status: "error", error: err.notFound };
  }

  revalidatePath("/crm");
  return { status: "success" };
}

/**
 * Converts an inbound marketing lead into a contact + deal. Requires
 * `crm.manage`. Contact details come from the deal payload when complete,
 * otherwise they are derived from the lead itself; the lead is then
 * marked `converted`.
 */
export async function convertLeadToDeal(
  leadId: string,
  data: CrmDealInput
): Promise<CrmActionState> {
  const auth = await requireCrmPermission("crm.manage");
  if (!auth.ok) return auth.error;

  const dict = await getDictionary();
  const err = dict.platform.crm.errors;

  if (!leadId) {
    return { status: "error", error: err.missingId };
  }

  const parsed = createCrmDealInputSchema(err).safeParse(data);
  if (!parsed.success) {
    return {
      status: "error",
      error: err.highlightFields,
      fieldErrors: parseFieldErrors(parsed.error.issues),
    };
  }

  const supabase = await createServerClient();

  const { data: lead, error: leadError } = await supabase
    .from("marketing_leads")
    .select("id, name, email, company")
    .eq("id", leadId)
    .maybeSingle();

  if (leadError || !lead) {
    console.error("[crm] lead fetch failed:", leadError?.message);
    return { status: "error", error: err.leadNotFound };
  }

  // Prefer explicit contact details from the form; fall back to the lead's
  // own identity so a conversion always links a contact.
  const hasOwnContact =
    Boolean(parsed.data.contact?.name) && Boolean(parsed.data.contact?.email);
  const contactInfo: CrmDealInput["contact"] = hasOwnContact
    ? parsed.data.contact
    : {
        name: lead.name,
        email: lead.email,
        company: lead.company ?? "",
        phone: "",
      };

  const contact = await resolveContactId(auth.organizationId, contactInfo);
  if (contact.error) {
    return { status: "error", error: err.convertFailed };
  }

  const { error: dealError } = await supabase.from("crm_deals").insert({
    organization_id: auth.organizationId,
    contact_id: contact.id,
    title: parsed.data.title,
    value: parsed.data.value,
    currency: parsed.data.currency,
    stage: parsed.data.stage,
    notes: parsed.data.notes || null,
    assigned_to: parsed.data.assignedTo || null,
    created_by: auth.userId,
  });

  if (dealError) {
    console.error("[crm] deal create failed during conversion:", dealError.message);
    return { status: "error", error: err.convertFailed };
  }

  const { error: statusError } = await supabase
    .from("marketing_leads")
    .update({ status: "converted" })
    .eq("id", leadId);

  if (statusError) {
    // The deal exists — surface the failure but don't roll back.
    console.error("[crm] lead status update failed:", statusError.message);
  }

  revalidatePath("/crm");
  return { status: "success" };
}