"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import {
  createInvoiceInputSchema,
  invoiceStatusSchema,
  type InvoicingActionState,
  type InvoiceInput,
} from "@/lib/validations/invoicing";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { InvoiceStatus } from "@/types/database";

/**
 * Invoicing server actions.
 *
 * Security model:
 *  - organization_id / created_by come exclusively from the session.
 *  - Viewing requires `invoicing.view`; create/status/delete require
 *    `invoicing.manage`.
 *  - Input is re-validated with Zod server-side before it reaches the
 *    atomic `create_invoice(...)` RPC, which re-checks the
 *    `invoicing.manage` grant inside the transaction (RLS on the
 *    tables org-scopes every other read/write path).
 */

export interface InvoiceContact {
  id: string;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
}

export interface InvoiceItemRow {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  currency: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  dueDate: string | null;
  notes: string | null;
  createdAt: string;
  contact: InvoiceContact | null;
  items: InvoiceItemRow[];
}

/** Aggregates derived from the organization's invoices. */
export interface InvoicingSummary {
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
  invoiceCount: number;
  paidCount: number;
  openCount: number;
  overdueCount: number;
}

export interface InvoicingList {
  invoices: InvoiceRow[];
  summary: InvoicingSummary;
}

export type InvoicingAuthResult =
  | { ok: true; organizationId: string; userId: string }
  | { ok: false; error: InvoicingActionState };

/** Verifies the session, org, and that the caller holds the given permission. */
async function requireInvoicingPermission(
  permission: "invoicing.view" | "invoicing.manage"
): Promise<InvoicingAuthResult> {
  const userContext = await getCurrentUserContext();
  const dict = await getDictionary();
  const err = dict.platform.invoicing.errors;

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
): InvoicingActionState["fieldErrors"] {
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

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

interface InvoiceJoinRow {
  id: string;
  invoice_number: string;
  status: string;
  currency: string;
  subtotal: string | number;
  tax_rate: string | number;
  tax_amount: string | number;
  total: string | number;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  contact: InvoiceContact | null;
  items: {
    id: string;
    description: string;
    quantity: string | number;
    unit_price: string | number;
    amount: string | number;
  }[];
}

function toInvoiceRow(row: InvoiceJoinRow): InvoiceRow {
  const contact = firstOf(row.contact);
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    status: row.status as InvoiceStatus,
    currency: row.currency,
    subtotal: Number(row.subtotal) || 0,
    taxRate: Number(row.tax_rate) || 0,
    taxAmount: Number(row.tax_amount) || 0,
    total: Number(row.total) || 0,
    dueDate: row.due_date,
    notes: row.notes,
    createdAt: row.created_at,
    contact: contact
      ? {
          id: contact.id,
          name: contact.name,
          email: contact.email,
          company: contact.company ?? null,
          phone: contact.phone ?? null,
        }
      : null,
    items: (row.items ?? []).map((item) => ({
      id: item.id,
      description: item.description,
      quantity: Number(item.quantity) || 0,
      unitPrice: Number(item.unit_price) || 0,
      amount: Number(item.amount) || 0,
    })),
  };
}

function summarize(invoices: InvoiceRow[]): InvoicingSummary {
  let totalInvoiced = 0;
  let totalPaid = 0;
  let totalOutstanding = 0;
  let paidCount = 0;
  let openCount = 0;
  let overdueCount = 0;

  for (const invoice of invoices) {
    if (invoice.status === "cancelled") continue;
    totalInvoiced += invoice.total;

    if (invoice.status === "paid") {
      totalPaid += invoice.total;
      paidCount += 1;
    } else if (invoice.status === "overdue" || invoice.status === "sent") {
      totalOutstanding += invoice.total;
    }

    if (
      invoice.status === "draft" ||
      invoice.status === "sent" ||
      invoice.status === "overdue"
    ) {
      openCount += 1;
    }
    if (invoice.status === "overdue") overdueCount += 1;
  }

  return {
    totalInvoiced: round2(totalInvoiced),
    totalPaid: round2(totalPaid),
    totalOutstanding: round2(totalOutstanding),
    invoiceCount: invoices.length,
    paidCount,
    openCount,
    overdueCount,
  };
}

/**
 * Retrieves the current organization's invoices with their contacts and
 * line items, plus summary aggregates. Requires `invoicing.view`.
 */
export async function getInvoices(): Promise<InvoicingList | null> {
  const userContext = await getCurrentUserContext();
  if (!userContext || !hasPermission("invoicing.view", userContext.permissions)) {
    return null;
  }

  const organizationId = userContext.organization?.id;
  if (!organizationId) return null;

  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("invoices")
    .select(
      `
        id,
        invoice_number,
        status,
        currency,
        subtotal,
        tax_rate,
        tax_amount,
        total,
        due_date,
        notes,
        created_at,
        contact:crm_contacts(id, name, email, company, phone),
        items:invoice_items(id, description, quantity, unit_price, amount)
      `
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("[invoicing] invoices fetch failed:", error?.message ?? "no rows");
    return null;
  }

  const invoices = (data as unknown as InvoiceJoinRow[]).map(toInvoiceRow);
  return { invoices, summary: summarize(invoices) };
}

/**
 * Fetches a single invoice with its line items. Requires `invoicing.view`
 * and that the invoice belongs to the caller's organization.
 */
export async function getInvoiceById(id: string): Promise<InvoiceRow | null> {
  const userContext = await getCurrentUserContext();
  if (!userContext || !hasPermission("invoicing.view", userContext.permissions)) {
    return null;
  }
  const organizationId = userContext.organization?.id;
  if (!organizationId || !id) return null;

  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("invoices")
    .select(
      `
        id,
        invoice_number,
        status,
        currency,
        subtotal,
        tax_rate,
        tax_amount,
        total,
        due_date,
        notes,
        created_at,
        contact:crm_contacts(id, name, email, company, phone),
        items:invoice_items(id, description, quantity, unit_price, amount)
      `
    )
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error || !data) {
    console.error("[invoicing] invoice fetch failed:", error?.message ?? "no row");
    return null;
  }

  return toInvoiceRow(data as unknown as InvoiceJoinRow);
}

/**
 * Creates an invoice and its line items atomically. Requires
 * `invoicing.manage`. Totals and the invoice number are computed by the
 * DB function inside the same transaction; this layer only shape-checks
 * the payload with Zod and maps failures to localized errors.
 */
export async function createInvoice(
  data: InvoiceInput
): Promise<InvoicingActionState> {
  const auth = await requireInvoicingPermission("invoicing.manage");
  if (!auth.ok) return auth.error;

  const dict = await getDictionary();
  const err = dict.platform.invoicing.errors;

  const parsed = createInvoiceInputSchema(err).safeParse(data);
  if (!parsed.success) {
    return {
      status: "error",
      error: err.highlightFields,
      fieldErrors: parseFieldErrors(parsed.error.issues),
    };
  }

  const supabase = await createServerClient();

  // The dialog sends camelCase field names; the DB function reads the
  // line items with snake_case keys (`unit_price`). Without this mapping
  // `unit_price` arrives as NULL and the invoice_items insert fails its
  // NOT NULL constraint, so every UI-driven invoice creation would error.
  const rpcItems = parsed.data.items.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unitPrice,
  }));

  const { error } = await supabase.rpc("create_invoice", {
    p_contact_id: parsed.data.contactId || null,
    p_deal_id: null,
    p_due_date: parsed.data.dueDate || null,
    p_currency: parsed.data.currency,
    p_tax_rate: parsed.data.taxRate,
    p_notes: parsed.data.notes || null,
    p_items: rpcItems,
  });

  if (error) {
    console.error("[invoicing] invoice create failed:", error.message);
    return { status: "error", error: err.createFailed };
  }

  revalidatePath("/invoicing");
  return { status: "success" };
}

/**
 * Updates an invoice's status (e.g. mark as paid). Requires
 * `invoicing.manage`; the update is org-scoped in the same statement.
 */
export async function updateInvoiceStatus(
  id: string,
  status: string
): Promise<InvoicingActionState> {
  const auth = await requireInvoicingPermission("invoicing.manage");
  if (!auth.ok) return auth.error;

  const dict = await getDictionary();
  const err = dict.platform.invoicing.errors;

  if (!id) {
    return { status: "error", error: err.missingId };
  }

  const parsed = invoiceStatusSchema.safeParse(status);
  if (!parsed.success) {
    return { status: "error", error: err.statusInvalid };
  }

  const supabase = await createServerClient();

  const { data: updated, error } = await supabase
    .from("invoices")
    .update({ status: parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", auth.organizationId)
    .select("id");

  if (error) {
    console.error("[invoicing] status update failed:", error.message);
    return { status: "error", error: err.updateFailed };
  }
  if (!updated || updated.length === 0) {
    return { status: "error", error: err.notFound };
  }

  revalidatePath("/invoicing");
  return { status: "success" };
}

/**
 * Deletes an invoice; `invoice_items` cascade via the FK. Requires
 * `invoicing.manage`; the delete is org-scoped in the same statement.
 */
export async function deleteInvoice(id: string): Promise<InvoicingActionState> {
  const auth = await requireInvoicingPermission("invoicing.manage");
  if (!auth.ok) return auth.error;

  const dict = await getDictionary();
  const err = dict.platform.invoicing.errors;

  if (!id) {
    return { status: "error", error: err.missingId };
  }

  const supabase = await createServerClient();

  const { data: deleted, error } = await supabase
    .from("invoices")
    .delete()
    .eq("id", id)
    .eq("organization_id", auth.organizationId)
    .select("id");

  if (error) {
    console.error("[invoicing] invoice delete failed:", error.message);
    return { status: "error", error: err.deleteFailed };
  }
  if (!deleted || deleted.length === 0) {
    return { status: "error", error: err.notFound };
  }

  revalidatePath("/invoicing");
  return { status: "success" };
}