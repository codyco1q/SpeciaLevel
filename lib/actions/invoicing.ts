"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  createInvoiceInputSchema,
  createProductInputSchema,
  invoiceStatusSchema,
  type InvoicingActionState,
  type InvoiceInput,
  type ProductInput,
} from "@/lib/validations/invoicing";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { dispatchWorkflowTrigger } from "@/lib/services/workflow-runner";
import type { InvoiceStatus, PaymentProvider, Product } from "@/types/database";

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
  title: string;
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
  paymentProvider?: PaymentProvider;
  paymentIntentId?: string | null;
  paidAt?: string | null;
  createdAt: string;
  shareToken: string;
  isShareable: boolean;
  contact: InvoiceContact | null;
  items: InvoiceItemRow[];
}

export interface PublicInvoiceData {
  id: string;
  organizationId?: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  currency: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  dueDate: string | null;
  notes: string | null;
  paymentProvider?: PaymentProvider;
  paymentIntentId?: string | null;
  paidAt?: string | null;
  createdAt: string;
  shareToken: string;
  isShareable: boolean;
  organizationName: string;
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
  payment_provider?: string | null;
  payment_intent_id?: string | null;
  paid_at?: string | null;
  created_at: string;
  share_token?: string | null;
  is_shareable?: boolean | null;
  contact: InvoiceContact | null;
  items: {
    id: string;
    title?: string | null;
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
    paymentProvider: (row.payment_provider as PaymentProvider) || "manual",
    paymentIntentId: row.payment_intent_id ?? null,
    paidAt: row.paid_at ?? null,
    createdAt: row.created_at,
    shareToken: row.share_token ?? "",
    isShareable: row.is_shareable ?? true,
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
      title: item.title || item.description || "",
      description: item.description || "",
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
        payment_provider,
        payment_intent_id,
        paid_at,
        created_at,
        share_token,
        is_shareable,
        contact:crm_contacts(id, name, email, company, phone),
        items:invoice_items(id, title, description, quantity, unit_price, amount)
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
        payment_provider,
        payment_intent_id,
        paid_at,
        created_at,
        share_token,
        is_shareable,
        contact:crm_contacts(id, name, email, company, phone),
        items:invoice_items(id, title, description, quantity, unit_price, amount)
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
    title: item.title || item.description || "",
    description: item.description || item.title || "",
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
  status: string,
  provider?: PaymentProvider,
  paymentIntentId?: string
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
  const now = new Date().toISOString();
  const updatePayload: Record<string, any> = {
    status: parsed.data,
    updated_at: now,
  };

  if (parsed.data === "paid") {
    updatePayload.paid_at = now;
    if (provider) {
      updatePayload.payment_provider = provider;
    }
    if (paymentIntentId) {
      updatePayload.payment_intent_id = paymentIntentId;
    }
  }

  const { data: updated, error } = await supabase
    .from("invoices")
    .update(updatePayload)
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

  if (parsed.data === "paid") {
    try {
      await dispatchWorkflowTrigger({
        type: "invoice_paid",
        orgId: auth.organizationId,
        payload: {
          invoice_id: id,
          invoice: {
            id,
          },
        },
      });
    } catch (triggerErr) {
      console.error("[invoicing] dispatchWorkflowTrigger error:", triggerErr);
    }
  }

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

/**
 * Updates an invoice and replaces its line items atomically. Requires
 * `invoicing.manage`. Gated from editing paid invoices.
 */
export async function updateInvoice(
  invoiceId: string,
  data: InvoiceInput
): Promise<InvoicingActionState> {
  const auth = await requireInvoicingPermission("invoicing.manage");
  if (!auth.ok) return auth.error;

  const dict = await getDictionary();
  const err = dict.platform.invoicing.errors;

  if (!invoiceId) {
    return { status: "error", error: err.missingId };
  }

  const parsed = createInvoiceInputSchema(err).safeParse(data);
  if (!parsed.success) {
    return {
      status: "error",
      error: err.highlightFields,
      fieldErrors: parseFieldErrors(parsed.error.issues),
    };
  }

  const supabase = await createServerClient();

  const rpcItems = parsed.data.items.map((item) => ({
    title: item.title || item.description || "",
    description: item.description || item.title || "",
    quantity: item.quantity,
    unit_price: item.unitPrice,
  }));

  const { error } = await supabase.rpc("update_invoice", {
    p_invoice_id: invoiceId,
    p_contact_id: parsed.data.contactId || null,
    p_due_date: parsed.data.dueDate || null,
    p_tax_rate: parsed.data.taxRate,
    p_notes: parsed.data.notes || null,
    p_items: rpcItems,
  });

  if (error) {
    console.error("[invoicing] invoice update failed:", error.message);
    return { status: "error", error: err.updateFailed };
  }

  revalidatePath("/invoicing");
  revalidatePath(`/invoicing/${invoiceId}`);
  return { status: "success" };
}

/**
 * Regenerates the share token for an invoice, invalidating previous links.
 * Requires `invoicing.manage`.
 */
export async function regenerateShareToken(
  invoiceId: string
): Promise<
  | { status: "success"; shareToken: string }
  | { status: "error"; error: string }
> {
  const auth = await requireInvoicingPermission("invoicing.manage");
  if (!auth.ok) {
    return { status: "error", error: auth.error.error ?? "Unauthorized" };
  }

  const dict = await getDictionary();
  const err = dict.platform.invoicing.errors;

  if (!invoiceId) {
    return { status: "error", error: err.missingId };
  }

  const supabase = await createServerClient();
  const newShareToken = crypto.randomUUID();

  const { data, error } = await supabase
    .from("invoices")
    .update({ share_token: newShareToken, updated_at: new Date().toISOString() })
    .eq("id", invoiceId)
    .eq("organization_id", auth.organizationId)
    .select("share_token")
    .single();

  if (error || !data) {
    console.error("[invoicing] regenerate share token failed:", error?.message);
    return { status: "error", error: err.updateFailed };
  }

  revalidatePath(`/invoicing/${invoiceId}`);
  return { status: "success", shareToken: data.share_token };
}

/**
 * Public invoice lookup by share token. Unauthenticated; returns sanitized
 * invoice payload via SECURITY DEFINER function.
 */
export async function getPublicInvoiceByToken(
  shareToken: string
): Promise<PublicInvoiceData | null> {
  if (!shareToken) return null;

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("get_public_invoice_by_token", {
    p_share_token: shareToken,
  });

  if (error || !data) {
    console.error(
      "[invoicing] public invoice fetch failed:",
      error?.message ?? "no data"
    );
    return null;
  }

  return data as unknown as PublicInvoiceData;
}

// ============================================================
// Products Catalog Actions (Milestone 2)
// ============================================================

/**
 * Retrieves the organization's reusable product line items.
 * Requires `invoicing.view` permission.
 */
export async function getProducts(): Promise<Product[]> {
  const auth = await requireInvoicingPermission("invoicing.view");
  if (!auth.ok) return [];

  const supabase = await createServerClient();
  let { data, error } = await supabase
    .from("products")
    .select("id, organization_id, title, description, unit_price, image_url, created_by, created_at, updated_at")
    .eq("organization_id", auth.organizationId)
    .order("created_at", { ascending: false });

  // Graceful fallback if PostgREST schema cache has not reloaded image_url
  if (error && (error.message.includes("image_url") || error.code === "PGRST204")) {
    const fallback = await supabase
      .from("products")
      .select("id, organization_id, title, description, unit_price, created_by, created_at, updated_at")
      .eq("organization_id", auth.organizationId)
      .order("created_at", { ascending: false });

    data = (fallback.data ?? []).map((row) => ({ ...row, image_url: null }));
    error = fallback.error;
  }

  if (error) {
    console.error("[invoicing] getProducts failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    ...row,
    unit_price: Number(row.unit_price) || 0,
  })) as Product[];
}

/**
 * Uploads a product featured image to the organization-assets bucket.
 * Requires `invoicing.manage` permission.
 */
export async function uploadProductImage(
  formData: FormData
): Promise<{ status: "success"; imageUrl: string } | { status: "error"; error: string }> {
  const auth = await requireInvoicingPermission("invoicing.manage");
  if (!auth.ok) return { status: "error", error: auth.error.error ?? "Unauthorized" };

  const file = formData.get("file");
  if (!file || !(file instanceof Blob) || typeof (file as File).name !== "string") {
    return { status: "error", error: "Please select an image file to upload." };
  }

  const fileObj = file as File;
  if (fileObj.size > 5 * 1024 * 1024) {
    return { status: "error", error: "Image file size must be under 5MB." };
  }

  const allowedTypes = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/gif",
    "image/svg+xml",
  ];
  if (!allowedTypes.includes(fileObj.type)) {
    return {
      status: "error",
      error: "Unsupported image format. Please upload PNG, JPG, WebP, GIF, or SVG.",
    };
  }

  const extension = fileObj.name.split(".").pop()?.toLowerCase() || "png";
  const storagePath = `products/${auth.organizationId}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${extension}`;

  const admin = createServiceRoleClient();
  const fileBuffer = await fileObj.arrayBuffer();

  const { error: uploadError } = await admin.storage
    .from("organization-assets")
    .upload(storagePath, fileBuffer, {
      contentType: fileObj.type,
      upsert: true,
    });

  if (uploadError) {
    console.error("[invoicing] product image upload failed:", uploadError.message);
    return {
      status: "error",
      error: `Could not upload product image: ${uploadError.message}`,
    };
  }

  const { data: publicUrlData } = admin.storage
    .from("organization-assets")
    .getPublicUrl(storagePath);

  return { status: "success", imageUrl: publicUrlData.publicUrl };
}

/**
 * Creates a reusable product.
 * Requires `invoicing.manage` permission.
 */
export async function createProduct(
  data: ProductInput
): Promise<{ status: "success"; data?: Product } | { status: "error"; error: string }> {
  const auth = await requireInvoicingPermission("invoicing.manage");
  if (!auth.ok) return { status: "error", error: auth.error.error ?? "Unauthorized" };

  const dict = await getDictionary();
  const err = dict.platform.invoicing.errors;

  const parsed = createProductInputSchema(err).safeParse(data);
  if (!parsed.success) {
    return {
      status: "error",
      error: parsed.error.issues[0]?.message ?? err.createFailed,
    };
  }

  const supabase = await createServerClient();
  let { data: created, error } = await supabase
    .from("products")
    .insert({
      organization_id: auth.organizationId,
      title: parsed.data.title,
      description: parsed.data.description ?? "",
      unit_price: parsed.data.unitPrice,
      image_url: parsed.data.imageUrl || null,
      created_by: auth.userId,
    })
    .select("id, organization_id, title, description, unit_price, image_url, created_by, created_at, updated_at")
    .single();

  // Graceful fallback if PostgREST schema cache has not reloaded image_url
  if (error && (error.message.includes("image_url") || error.code === "PGRST204")) {
    const fallback = await supabase
      .from("products")
      .insert({
        organization_id: auth.organizationId,
        title: parsed.data.title,
        description: parsed.data.description ?? "",
        unit_price: parsed.data.unitPrice,
        created_by: auth.userId,
      })
      .select("id, organization_id, title, description, unit_price, created_by, created_at, updated_at")
      .single();

    created = fallback.data ? { ...fallback.data, image_url: null } : null;
    error = fallback.error;
  }

  if (error || !created) {
    console.error("[invoicing] product create failed:", error?.message);
    return { status: "error", error: error?.message ?? err.createFailed };
  }

  revalidatePath("/invoicing");
  return {
    status: "success",
    data: {
      ...created,
      unit_price: Number(created.unit_price) || 0,
    } as Product,
  };
}

/**
 * Updates an existing reusable product.
 * Requires `invoicing.manage` permission.
 */
export async function updateProduct(
  id: string,
  data: ProductInput
): Promise<{ status: "success" } | { status: "error"; error: string }> {
  const auth = await requireInvoicingPermission("invoicing.manage");
  if (!auth.ok) return { status: "error", error: auth.error.error ?? "Unauthorized" };

  const dict = await getDictionary();
  const err = dict.platform.invoicing.errors;

  const parsed = createProductInputSchema(err).safeParse(data);
  if (!parsed.success) {
    return {
      status: "error",
      error: parsed.error.issues[0]?.message ?? err.updateFailed,
    };
  }

  const supabase = await createServerClient();
  let { error } = await supabase
    .from("products")
    .update({
      title: parsed.data.title,
      description: parsed.data.description ?? "",
      unit_price: parsed.data.unitPrice,
      image_url: parsed.data.imageUrl || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organization_id", auth.organizationId);

  // Graceful fallback if PostgREST schema cache has not reloaded image_url
  if (error && (error.message.includes("image_url") || error.code === "PGRST204")) {
    const fallback = await supabase
      .from("products")
      .update({
        title: parsed.data.title,
        description: parsed.data.description ?? "",
        unit_price: parsed.data.unitPrice,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("organization_id", auth.organizationId);

    error = fallback.error;
  }

  if (error) {
    console.error("[invoicing] product update failed:", error.message);
    return { status: "error", error: error.message };
  }

  revalidatePath("/invoicing");
  return { status: "success" };
}

/**
 * Deletes a reusable product. Existing invoices referencing it remain untouched.
 * Requires `invoicing.manage` permission.
 */
export async function deleteProduct(
  id: string
): Promise<{ status: "success" } | { status: "error"; error: string }> {
  const auth = await requireInvoicingPermission("invoicing.manage");
  if (!auth.ok) return { status: "error", error: auth.error.error ?? "Unauthorized" };

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", id)
    .eq("organization_id", auth.organizationId);

  if (error) {
    console.error("[invoicing] product delete failed:", error.message);
    return { status: "error", error: error.message };
  }

  revalidatePath("/invoicing");
  return { status: "success" };
}
