"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import {
  createContactInputSchema,
  createContactNoteSchema,
  importContactsInputSchema,
  type ContactActionState,
  type DuplicateStrategy,
  type ImportContactsActionState,
  type ImportContactsInput,
  type ContactImportResult,
  type ContactImportRecord,
  type ContactImportError,
} from "@/lib/validations/contacts";

export type {
  ContactImportResult,
  ContactImportRecord,
  ContactImportError,
};
import type {
  TelecomCallStatus,
  TelecomDirection,
  TelecomSmsStatus,
} from "@/lib/validations/telecom";
import type { CrmStage, InvoiceStatus } from "@/types/database";

export interface ContactFilters {
  query?: string;
  tag?: string;
  limit?: number;
  offset?: number;
}

/** Directory row with derived CRM aggregates for the current viewer. */
export interface ContactSummaryRow {
  id: string;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  title: string | null;
  address: string | null;
  notes: string | null;
  tags: string[];
  customFields?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  /** Deals in a non-final stage (lead / contacted / proposal). */
  activeDeals: number;
  /** Sum of invoice totals (excluding cancelled). Null without `invoicing.view`. */
  totalInvoiced: number | null;
}

export interface ContactDealRow {
  id: string;
  title: string;
  value: number;
  currency: string;
  stage: CrmStage;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  assignee: {
    id: string;
    fullName: string | null;
    email: string | null;
  } | null;
}

export interface ContactInvoiceRow {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  currency: string;
  total: number;
  dueDate: string | null;
  createdAt: string;
}

export interface ContactNoteRow {
  id: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    fullName: string | null;
    email: string | null;
  } | null;
}

export interface ContactCallRow {
  id: string;
  direction: TelecomDirection;
  status: TelecomCallStatus;
  fromNumber: string;
  toNumber: string;
  durationSeconds: number;
  recordingUrl: string | null;
  summary: string | null;
  createdAt: string;
}

export interface ContactSmsRow {
  id: string;
  direction: TelecomDirection;
  status: TelecomSmsStatus;
  fromNumber: string;
  toNumber: string;
  body: string;
  createdAt: string;
}

/** Full profile payload for /contacts/[id]. */
export interface ContactProfile {
  id: string;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  title: string | null;
  address: string | null;
  tags: string[];
  customFields?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  deals: ContactDealRow[];
  invoices: ContactInvoiceRow[];
  notes: ContactNoteRow[];
  communications: {
    calls: ContactCallRow[];
    sms: ContactSmsRow[];
  };
}

export interface ContactTagCount {
  tag: string;
  count: number;
}

type ContactAuthResult =
  | { ok: true; organizationId: string; userId: string }
  | { ok: false; error: string };

/** Verifies the session, org, and that the caller holds the given permission. */
async function requireContactPermission(
  permission: "crm.view" | "crm.manage"
): Promise<ContactAuthResult> {
  const userContext = await getCurrentUserContext();
  const dict = await getDictionary();
  const err = dict.platform.crm?.errors ?? {
    signedIn: "You must be signed in.",
    noPermission: "Permission denied.",
    noOrg: "No organization found.",
  };

  if (!userContext) {
    return { ok: false, error: err.signedIn };
  }
  if (!hasPermission(permission, userContext.permissions)) {
    return { ok: false, error: err.noPermission };
  }

  const organizationId = userContext.organization?.id;
  if (!organizationId) {
    return { ok: false, error: err.noOrg };
  }

  return { ok: true, organizationId, userId: userContext.user.id };
}

function parseFieldErrors(
  issues: z.ZodIssue[]
): ContactActionState["fieldErrors"] {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string") {
      (fieldErrors[key] ??= []).push(issue.message);
    }
  }
  return fieldErrors;
}

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value as T;
}

/**
 * Lists the current organization's contacts with derived CRM aggregates.
 * Supports query and tag filtering. Requires `crm.view`.
 */
export async function getContacts(
  filters: ContactFilters = {}
): Promise<ContactSummaryRow[] | null> {
  const auth = await requireContactPermission("crm.view");
  if (!auth.ok) return null;

  const supabase = await createServerClient();

  let query = supabase
    .from("crm_contacts")
    .select(
      "id, name, email, company, phone, title, address, notes, tags, custom_fields, created_at, updated_at"
    )
    .eq("organization_id", auth.organizationId)
    .order("created_at", { ascending: false });

  const search = filters.query?.trim();
  if (search) {
    query = query.or(
      [
        `name.ilike.%${search}%`,
        `email.ilike.%${search}%`,
        `company.ilike.%${search}%`,
        `title.ilike.%${search}%`,
      ].join(",")
    );
  }

  const tag = filters.tag?.trim();
  if (tag) {
    query = query.contains("tags", [tag]);
  }

  if (typeof filters.limit === "number" && filters.limit > 0) {
    const offset = Math.max(filters.offset ?? 0, 0);
    query = query.range(offset, offset + filters.limit - 1);
  }

  const { data: contactRows, error } = await query;
  if (error || !contactRows) {
    console.error("[contacts] directory fetch failed:", error?.message);
    return null;
  }

  const userContext = await getCurrentUserContext();
  const canViewInvoicing = hasPermission(
    "invoicing.view",
    userContext?.permissions ?? []
  );

  const [dealsResult, invoicesResult] = await Promise.all([
    supabase
      .from("crm_deals")
      .select("contact_id, stage")
      .eq("organization_id", auth.organizationId)
      .not("contact_id", "is", null),
    canViewInvoicing
      ? supabase
          .from("invoices")
          .select("contact_id, total, status")
          .eq("organization_id", auth.organizationId)
          .not("contact_id", "is", null)
      : Promise.resolve({ data: null, error: null }),
  ]);

  const activeDealCounts = new Map<string, number>();
  for (const deal of dealsResult.data ?? []) {
    if (!deal.contact_id) continue;
    if (deal.stage !== "won" && deal.stage !== "lost") {
      activeDealCounts.set(
        deal.contact_id,
        (activeDealCounts.get(deal.contact_id) ?? 0) + 1
      );
    }
  }

  const invoiceTotals = canViewInvoicing
    ? new Map<string, number>()
    : null;
  if (invoiceTotals && invoicesResult.data) {
    for (const inv of invoicesResult.data) {
      if (!inv.contact_id) continue;
      if (inv.status === "cancelled") continue;
      invoiceTotals.set(
        inv.contact_id,
        (invoiceTotals.get(inv.contact_id) ?? 0) + (Number(inv.total) || 0)
      );
    }
  }

  return contactRows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    company: row.company,
    phone: row.phone,
    title: row.title,
    address: row.address,
    notes: row.notes,
    tags: Array.isArray(row.tags) ? row.tags : [],
    customFields:
      row.custom_fields && typeof row.custom_fields === "object"
        ? (row.custom_fields as Record<string, unknown>)
        : {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    activeDeals: activeDealCounts.get(row.id) ?? 0,
    totalInvoiced: invoiceTotals ? invoiceTotals.get(row.id) ?? 0 : null,
  }));
}

/**
 * Returns distinct tags and their usage count in the current organization.
 */
export async function getContactTags(): Promise<ContactTagCount[]> {
  const auth = await requireContactPermission("crm.view");
  if (!auth.ok) return [];

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("crm_contacts")
    .select("tags")
    .eq("organization_id", auth.organizationId);

  if (error || !data) return [];

  const tagMap = new Map<string, number>();
  for (const row of data) {
    if (Array.isArray(row.tags)) {
      for (const tag of row.tags) {
        if (tag && typeof tag === "string") {
          const clean = tag.trim();
          if (clean) {
            tagMap.set(clean, (tagMap.get(clean) ?? 0) + 1);
          }
        }
      }
    }
  }

  return Array.from(tagMap.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/**
 * Fetches the full 360° profile for one contact. Requires `crm.view`.
 */
export async function getContactById(
  contactId: string
): Promise<ContactProfile | null> {
  const auth = await requireContactPermission("crm.view");
  if (!auth.ok) return null;

  const supabase = await createServerClient();

  const { data: contact, error: contactError } = await supabase
    .from("crm_contacts")
    .select("id, name, email, company, phone, title, address, tags, custom_fields, created_at, updated_at")
    .eq("id", contactId)
    .eq("organization_id", auth.organizationId)
    .maybeSingle();

  if (contactError || !contact) return null;

  const userContext = await getCurrentUserContext();
  const permissions = userContext?.permissions ?? [];
  const canInvoicing = hasPermission("invoicing.view", permissions);
  const canTelecom = hasPermission("telecom.view", permissions);

  const [dealsRes, invRes, notesRes, callsRes, smsRes] = await Promise.all([
    supabase
      .from("crm_deals")
      .select("id, title, value, currency, stage, notes, created_at, updated_at, assignee:user_profiles!crm_deals_assignee_id_fkey(id, full_name, email)")
      .eq("organization_id", auth.organizationId)
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false }),
    canInvoicing
      ? supabase.from("invoices").select("id, invoice_number, status, currency, total, due_date, created_at").eq("organization_id", auth.organizationId).eq("contact_id", contactId).order("created_at", { ascending: false })
      : Promise.resolve({ data: null }),
    supabase
      .from("crm_contact_notes")
      .select("id, content, created_at, author:user_profiles!crm_contact_notes_author_id_fkey(id, full_name, email)")
      .eq("organization_id", auth.organizationId)
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false }),
    canTelecom
      ? supabase.from("telecom_calls").select("id, direction, status, from_number, to_number, duration_seconds, recording_url, summary, created_at").eq("organization_id", auth.organizationId).eq("contact_id", contactId).order("created_at", { ascending: false })
      : Promise.resolve({ data: null }),
    canTelecom
      ? supabase.from("telecom_sms_messages").select("id, direction, status, from_number, to_number, body, created_at").eq("organization_id", auth.organizationId).eq("contact_id", contactId).order("created_at", { ascending: false })
      : Promise.resolve({ data: null }),
  ]);

  return {
    id: contact.id,
    name: contact.name,
    email: contact.email,
    company: contact.company ?? null,
    phone: contact.phone ?? null,
    title: contact.title ?? null,
    address: contact.address ?? null,
    tags: Array.isArray(contact.tags) ? contact.tags : [],
    customFields: contact.custom_fields && typeof contact.custom_fields === "object" ? (contact.custom_fields as Record<string, unknown>) : {},
    createdAt: contact.created_at,
    updatedAt: contact.updated_at,
    deals: (dealsRes.data ?? []).map((row: any) => {
      const assignee = firstOf(row.assignee);
      return {
        id: row.id,
        title: row.title,
        value: Number(row.value) || 0,
        currency: row.currency,
        stage: row.stage as CrmStage,
        notes: row.notes ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        assignee: assignee ? { id: assignee.id, fullName: assignee.full_name ?? null, email: assignee.email ?? null } : null,
      };
    }),
    invoices: (invRes.data ?? []).map((row: any) => ({
      id: row.id,
      invoiceNumber: row.invoice_number,
      status: row.status as InvoiceStatus,
      currency: row.currency,
      total: Number(row.total) || 0,
      dueDate: row.due_date ?? null,
      createdAt: row.created_at,
    })),
    notes: (notesRes.data ?? []).map((row: any) => {
      const author = firstOf(row.author);
      return {
        id: row.id,
        content: row.content,
        createdAt: row.created_at,
        author: author ? { id: author.id, fullName: author.full_name ?? null, email: author.email ?? null } : null,
      };
    }),
    communications: {
      calls: (callsRes.data ?? []).map((row: any) => ({
        id: row.id,
        direction: row.direction as TelecomDirection,
        status: row.status as TelecomCallStatus,
        fromNumber: row.from_number,
        toNumber: row.to_number,
        durationSeconds: Number(row.duration_seconds ?? 0),
        recordingUrl: row.recording_url ?? null,
        summary: row.summary ?? null,
        createdAt: row.created_at,
      })),
      sms: (smsRes.data ?? []).map((row: any) => ({
        id: row.id,
        direction: row.direction as TelecomDirection,
        status: row.status as TelecomSmsStatus,
        fromNumber: row.from_number,
        toNumber: row.to_number,
        body: row.body,
        createdAt: row.created_at,
      })),
    },
  };
}

/**
 * Creates a contact in the current organization. Requires `crm.manage`.
 */
export async function createContact(
  data: unknown
): Promise<ContactActionState> {
  const auth = await requireContactPermission("crm.manage");
  if (!auth.ok) return { status: "error", error: auth.error };

  const dict = await getDictionary();
  const err = dict.platform.crm.errors;

  const parsed = createContactInputSchema(err).safeParse(data);
  if (!parsed.success) {
    return {
      status: "error",
      error: err.highlightFields,
      fieldErrors: parseFieldErrors(parsed.error.issues),
    };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.from("crm_contacts").insert({
    organization_id: auth.organizationId,
    name: parsed.data.name,
    email: parsed.data.email,
    company: parsed.data.company || null,
    phone: parsed.data.phone || null,
    title: parsed.data.title || null,
    address: parsed.data.address || null,
    notes: parsed.data.notes || null,
    tags: parsed.data.tags,
    created_by: auth.userId,
  });

  if (error) {
    console.error("[contacts] create failed:", error.message);
    return { status: "error", error: err.contactCreateFailed };
  }

  revalidatePath("/contacts");
  revalidatePath("/crm");
  return { status: "success" };
}

/**
 * Updates an existing contact. Requires `crm.manage`.
 */
export async function updateContact(
  id: string,
  data: unknown
): Promise<ContactActionState> {
  const auth = await requireContactPermission("crm.manage");
  if (!auth.ok) return { status: "error", error: auth.error };

  const dict = await getDictionary();
  const err = dict.platform.crm.errors;

  if (!id) {
    return { status: "error", error: err.missingId };
  }

  const parsed = createContactInputSchema(err).safeParse(data);
  if (!parsed.success) {
    return {
      status: "error",
      error: err.highlightFields,
      fieldErrors: parseFieldErrors(parsed.error.issues),
    };
  }

  const supabase = await createServerClient();
  const { data: updated, error } = await supabase
    .from("crm_contacts")
    .update({
      name: parsed.data.name,
      email: parsed.data.email,
      company: parsed.data.company || null,
      phone: parsed.data.phone || null,
      title: parsed.data.title || null,
      address: parsed.data.address || null,
      notes: parsed.data.notes || null,
      tags: parsed.data.tags,
    })
    .eq("id", id)
    .eq("organization_id", auth.organizationId)
    .select("id");

  if (error) {
    console.error("[contacts] update failed:", error.message);
    return { status: "error", error: err.contactUpdateFailed };
  }
  if (!updated || updated.length === 0) {
    return { status: "error", error: err.contactNotFound };
  }

  revalidatePath("/contacts");
  revalidatePath(`/contacts/${id}`);
  revalidatePath("/crm");
  revalidatePath(`/crm/contacts/${id}`);
  return { status: "success" };
}

/**
 * Deletes a contact. Requires `crm.manage`.
 */
export async function deleteContact(id: string): Promise<ContactActionState> {
  const auth = await requireContactPermission("crm.manage");
  if (!auth.ok) return { status: "error", error: auth.error };

  const dict = await getDictionary();
  const err = dict.platform.crm.errors;

  if (!id) {
    return { status: "error", error: err.missingId };
  }

  const supabase = await createServerClient();
  const { data: deleted, error } = await supabase
    .from("crm_contacts")
    .delete()
    .eq("id", id)
    .eq("organization_id", auth.organizationId)
    .select("id");

  if (error) {
    console.error("[contacts] delete failed:", error.message);
    return { status: "error", error: err.contactDeleteFailed };
  }
  if (!deleted || deleted.length === 0) {
    return { status: "error", error: err.contactNotFound };
  }

  revalidatePath("/contacts");
  revalidatePath("/crm");
  return { status: "success" };
}
/**
 * Appends an internal note to a contact's timeline. Requires `crm.manage`.
 */
export async function addContactNote(
  contactId: string,
  content: string
): Promise<ContactActionState> {
  const auth = await requireContactPermission("crm.manage");
  if (!auth.ok) return { status: "error", error: auth.error };

  const dict = await getDictionary();
  const err = dict.platform.crm.errors;

  if (!contactId) {
    return { status: "error", error: err.missingId };
  }

  const parsed = createContactNoteSchema(err).safeParse({ content });
  if (!parsed.success) {
    return {
      status: "error",
      error: err.highlightFields,
      fieldErrors: parseFieldErrors(parsed.error.issues),
    };
  }

  const supabase = await createServerClient();

  const { data: contact } = await supabase
    .from("crm_contacts")
    .select("id")
    .eq("id", contactId)
    .eq("organization_id", auth.organizationId)
    .maybeSingle();

  if (!contact) {
    return { status: "error", error: err.contactNotFound };
  }

  const { error } = await supabase.from("crm_contact_notes").insert({
    organization_id: auth.organizationId,
    contact_id: contactId,
    author_id: auth.userId,
    content: parsed.data.content,
  });

  if (error) {
    console.error("[contacts] note insert failed:", error.message);
    return { status: "error", error: err.contactCreateFailed ?? err.createFailed };
  }

  revalidatePath("/contacts");
  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/crm");
  revalidatePath(`/crm/contacts/${contactId}`);
  return { status: "success" };
}

/**
 * Bulk imports contacts from parsed CSV records via the atomic bulk_import_contacts RPC.
 * Requires `crm.manage`.
 */
export async function importContactsAction(
  data: ImportContactsInput
): Promise<ImportContactsActionState> {
  const auth = await requireContactPermission("crm.manage");
  if (!auth.ok) {
    return {
      status: "error",
      error: auth.error,
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      errorCount: 0,
    };
  }

  const dict = await getDictionary();
  const crmErrors = dict.platform.crm?.errors ?? {
    highlightFields: "Please check invalid fields.",
  };

  const parsed = importContactsInputSchema.safeParse(data);
  if (!parsed.success) {
    return {
      status: "error",
      error: crmErrors.highlightFields || "Invalid import configuration or records.",
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      errorCount: data?.contacts?.length ?? 0,
    };
  }

  const supabase = await createServerClient();

  const { data: result, error } = await supabase.rpc("bulk_import_contacts", {
    p_contacts: parsed.data.contacts,
    p_duplicate_strategy: parsed.data.duplicateStrategy,
    p_batch_tags: parsed.data.batchTags ?? [],
  });

  if (error) {
    console.error("[contacts] bulk import rpc failed:", error.message);
    return {
      status: "error",
      error: error.message || "Failed to process bulk contact import.",
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      errorCount: parsed.data.contacts.length,
    };
  }

  revalidatePath("/contacts");
  revalidatePath("/crm");

  const rpcResult = (result as {
    success?: boolean;
    created_count?: number;
    updated_count?: number;
    skipped_count?: number;
    error_count?: number;
    errors?: Array<{ index: number; email?: string; name?: string; error: string }>;
  }) ?? {};

  return {
    status: "success",
    createdCount: rpcResult.created_count ?? 0,
    updatedCount: rpcResult.updated_count ?? 0,
    skippedCount: rpcResult.skipped_count ?? 0,
    errorCount: rpcResult.error_count ?? 0,
    errors: rpcResult.errors ?? [],
  };
}


