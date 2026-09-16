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
  type ContactActionState,
} from "@/lib/validations/crm-contacts";
import type {
  TelecomCallStatus,
  TelecomDirection,
  TelecomSmsStatus,
} from "@/lib/validations/telecom";
import type { CrmStage, InvoiceStatus } from "@/types/database";

/**
 * CRM contacts directory & 360° profile server actions (00020).
 *
 * Security model:
 *  - `organization_id` / `created_by` / author_id are NEVER read from
 *    the payload — they come exclusively from `getCurrentUserContext()`,
 *    so a caller can only touch rows inside their own organization,
 *    as themselves.
 *  - Reading the directory/contact requires `crm.view`; writing
 *    contacts and notes requires `crm.manage`. The new 00020 RLS
 *    policies backstops the same split at the database layer.
 *  - Cross-module views inside the profile honor their own modules'
 *    permissions: invoices are fetched only for holders of
 *    `invoicing.view`, telecom calls/SMS only for `telecom.view`
 *    (deals belong to the CRM module itself, so they always load).
 *  - Input is re-validated with Zod server-side (schemas shared with
 *    the client forms).
 */

export interface ContactFilters {
  query?: string;
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

/** Full profile payload for /crm/contacts/[id]. */
export interface ContactProfile {
  id: string;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  title: string | null;
  address: string | null;
  tags: string[];
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

type ContactAuthResult =
  | { ok: true; organizationId: string; userId: string }
  | { ok: false; error: string };

/** Verifies the session, org, and that the caller holds the given permission. */
async function requireContactPermission(
  permission: "crm.view" | "crm.manage"
): Promise<ContactAuthResult> {
  const userContext = await getCurrentUserContext();
  const dict = await getDictionary();
  const err = dict.platform.crm.errors;

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

/** PostgREST may return a single object or an array for a to-one join. */
function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value as T;
}

/**
 * Lists the current organization's contacts, newest first, with the
 * per-contact aggregates the directory shows: active (non-final) deal
 * count and total invoiced. Requires `crm.view`.
 *
 * Aggregates are derived from two org-scoped list queries (deals +
 * invoices) so the numbers stay accurate and typable without relying
 * on PostgREST embedded-aggregate filters. `totalInvoiced` is null
 * when the caller lacks `invoicing.view` (their billing column renders
 * a dash, matching the invoicing module's app-layer gate).
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
      "id, name, email, company, phone, title, address, notes, tags, created_at, updated_at"
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

  if (typeof filters.limit === "number" && filters.limit > 0) {
    const offset = Math.max(filters.offset ?? 0, 0);
    query = query.range(offset, offset + filters.limit - 1);
  }

  const { data: contactRows, error } = await query;
  if (error || !contactRows) {
    console.error("[crm-contacts] directory fetch failed:", error?.message);
    return null;
  }

  const userContext = await getCurrentUserContext();
  const canViewInvoicing = hasPermission(
    "invoicing.view",
    userContext?.permissions ?? []
  );

  // Org-scoped aggregate inputs (RLS keeps them tenant-isolated).
  const [dealsResult, invoicesResult] = await Promise.all([
    supabase
      .from("crm_deals")
      .select("contact_id, stage")
      .eq("organization_id", auth.organizationId),
    canViewInvoicing
      ? supabase
          .from("invoices")
          .select("contact_id, total, status")
          .eq("organization_id", auth.organizationId)
      : Promise.resolve({ data: null, error: null }),
  ]);

  const dealCounts = new Map<string, number>();
  for (const deal of dealsResult.data ?? []) {
    if (!deal.contact_id) continue;
    if (deal.stage === "won" || deal.stage === "lost") continue;
    dealCounts.set(deal.contact_id, (dealCounts.get(deal.contact_id) ?? 0) + 1);
  }

  const invoiceTotals = new Map<string, number>();
  for (const invoice of invoicesResult.data ?? []) {
    if (!invoice.contact_id) continue;
    if (invoice.status === "cancelled") continue;
    invoiceTotals.set(
      invoice.contact_id,
      (invoiceTotals.get(invoice.contact_id) ?? 0) + Number(invoice.total ?? 0)
    );
  }

  return (contactRows as RawContactRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    company: row.company ?? null,
    phone: row.phone ?? null,
    title: row.title ?? null,
    address: row.address ?? null,
    notes: row.notes ?? null,
    tags: row.tags ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    activeDeals: dealCounts.get(row.id) ?? 0,
    totalInvoiced: canViewInvoicing
      ? Math.round((invoiceTotals.get(row.id) ?? 0) * 100) / 100
      : null,
  }));
}

/** Raw contact row for the directory query. */
interface RawContactRow {
  id: string;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  title: string | null;
  address: string | null;
  notes: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

/**
 * Fetches the full 360° profile for one contact: the contact record,
 * all linked deals, all linked invoices, the internal-note timeline
 * (with author profiles), and any telecom calls/SMS linked to the
 * contact. Requires `crm.view`.
 *
 * Cross-module sections respect their own app-layer permissions:
 * invoices only load for `invoicing.view` holders and calls/SMS only
 * for `telecom.view` holders (RLS on those tables is org-scoped, so
 * gating the query is what keeps the profile leak-free).
 */
export async function getContactById(
  contactId: string
): Promise<ContactProfile | null> {
  const auth = await requireContactPermission("crm.view");
  if (!auth.ok) return null;

  const supabase = await createServerClient();

  const { data: contact, error: contactError } = await supabase
    .from("crm_contacts")
    .select(
      "id, name, email, company, phone, title, address, tags, created_at, updated_at"
    )
    .eq("id", contactId)
    .eq("organization_id", auth.organizationId)
    .maybeSingle();

  if (contactError || !contact) {
    console.error("[crm-contacts] contact fetch failed:", contactError?.message);
    return null;
  }

  const userContext = await getCurrentUserContext();
  const permissions = userContext?.permissions ?? [];
  const canViewInvoicing = hasPermission("invoicing.view", permissions);
  const canViewTelecom = hasPermission("telecom.view", permissions);

  const [dealsResult, invoicesResult, notesResult, callsResult, smsResult] =
    await Promise.all([
      supabase
        .from("crm_deals")
        .select(
          "id, title, value, currency, stage, notes, created_at, updated_at, assignee:profiles!fk_crm_deals_assigned_to(id, full_name, email)"
        )
        .eq("organization_id", auth.organizationId)
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false }),
      canViewInvoicing
        ? supabase
            .from("invoices")
            .select(
              "id, invoice_number, status, currency, total, due_date, created_at"
            )
            .eq("organization_id", auth.organizationId)
            .eq("contact_id", contactId)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from("crm_contact_notes")
        .select("id, content, created_at, author:profiles(id, full_name, email)")
        .eq("organization_id", auth.organizationId)
        .eq("contact_id", contactId)
        .order("created_at", { ascending: true }),
      canViewTelecom
        ? supabase
            .from("telecom_calls")
            .select(
              "id, direction, status, from_number, to_number, duration_seconds, recording_url, summary, created_at"
            )
            .eq("organization_id", auth.organizationId)
            .eq("contact_id", contactId)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: null, error: null }),
      canViewTelecom
        ? supabase
            .from("telecom_sms")
            .select(
              "id, direction, status, from_number, to_number, body, created_at"
            )
            .eq("organization_id", auth.organizationId)
            .eq("contact_id", contactId)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: null, error: null }),
    ]);

  const deals = (dealsResult.data ?? []) as unknown as RawDealProfileRow[];
  const invoices = (invoicesResult.data ?? []) as unknown as RawInvoiceRow[];
  const notes = (notesResult.data ?? []) as unknown as RawNoteRow[];
  const calls = (callsResult.data ?? []) as unknown as RawCallRow[];
  const sms = (smsResult.data ?? []) as unknown as RawSmsRow[];

  return {
    id: contact.id,
    name: contact.name,
    email: contact.email,
    company: contact.company ?? null,
    phone: contact.phone ?? null,
    title: contact.title ?? null,
    address: contact.address ?? null,
    tags: contact.tags ?? [],
    createdAt: contact.created_at,
    updatedAt: contact.updated_at,
    deals: deals.map((row) => {
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
        assignee: assignee
          ? {
              id: assignee.id,
              fullName: assignee.full_name ?? null,
              email: assignee.email ?? null,
            }
          : null,
      };
    }),
    invoices: invoices.map((row) => ({
      id: row.id,
      invoiceNumber: row.invoice_number,
      status: row.status as InvoiceStatus,
      currency: row.currency,
      total: Number(row.total) || 0,
      dueDate: row.due_date ?? null,
      createdAt: row.created_at,
    })),
    notes: notes.map((row) => {
      const author = firstOf(row.author);
      return {
        id: row.id,
        content: row.content,
        createdAt: row.created_at,
        author: author
          ? {
              id: author.id,
              fullName: author.full_name ?? null,
              email: author.email ?? null,
            }
          : null,
      };
    }),
    communications: {
      calls: calls.map((row) => ({
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
      sms: sms.map((row) => ({
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

interface RawDealProfileRow {
  id: string;
  title: string;
  value: string | number;
  currency: string;
  stage: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  assignee:
    | { id: string; full_name: string | null; email: string | null }
    | { id: string; full_name: string | null; email: string | null }[]
    | null;
}

interface RawInvoiceRow {
  id: string;
  invoice_number: string;
  status: string;
  currency: string;
  total: string | number;
  due_date: string | null;
  created_at: string;
}

interface RawNoteRow {
  id: string;
  content: string;
  created_at: string;
  author:
    | { id: string; full_name: string | null; email: string | null }
    | { id: string; full_name: string | null; email: string | null }[]
    | null;
}

interface RawCallRow {
  id: string;
  direction: string;
  status: string;
  from_number: string;
  to_number: string;
  duration_seconds: number;
  recording_url: string | null;
  summary: string | null;
  created_at: string;
}

interface RawSmsRow {
  id: string;
  direction: string;
  status: string;
  from_number: string;
  to_number: string;
  body: string;
  created_at: string;
}

/**
 * Creates a contact in the current organization. Requires
 * `crm.manage`; `organization_id` and `created_by` always come from
 * the session so the 00020 insert policy (org + manager + creator)
 * is satisfied without trusting the payload.
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
    console.error("[crm-contacts] create failed:", error.message);
    return { status: "error", error: err.contactCreateFailed };
  }

  revalidatePath("/crm");
  return { status: "success" };
}

/**
 * Updates an existing contact. Requires `crm.manage`; the row must
 * belong to the caller's organization (RLS backstops the same WHERE).
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
    console.error("[crm-contacts] update failed:", error.message);
    return { status: "error", error: err.contactUpdateFailed };
  }
  if (!updated || updated.length === 0) {
    return { status: "error", error: err.contactNotFound };
  }

  revalidatePath("/crm");
  revalidatePath(`/crm/contacts/${id}`);
  return { status: "success" };
}

/**
 * Deletes a contact and everything that cascades with it (linked
 * deals and internal notes). Requires `crm.manage`. All other
 * references — invoices, tasks, invites, telecom records, profiles —
 * are `on delete set null`, so they survive the removal.
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
    console.error("[crm-contacts] delete failed:", error.message);
    return { status: "error", error: err.contactDeleteFailed };
  }
  if (!deleted || deleted.length === 0) {
    return { status: "error", error: err.contactNotFound };
  }

  revalidatePath("/crm");
  return { status: "success" };
}

/**
 * Appends an internal note to a contact's timeline. Requires
 * `crm.manage`; author_id always comes from the session so the 00020
 * insert policy (org + manager + author) is satisfied without
 * trusting the payload. The contact must exist in the caller's org.
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
    content: parsed.data.content,
    author_id: auth.userId,
  });

  if (error) {
    console.error("[crm-contacts] note insert failed:", error.message);
    return { status: "error", error: err.noteFailed };
  }

  revalidatePath("/crm");
  revalidatePath(`/crm/contacts/${contactId}`);
  return { status: "success" };
}