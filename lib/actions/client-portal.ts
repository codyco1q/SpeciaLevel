"use server";

import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import type { InvoiceStatus } from "@/types/database";

/**
 * Client Portal data loader.
 *
 * Serves the personalized Client Hub on /dashboard. Every query is scoped
 * by the database RLS policies added in 00013: a Client caller only ever
 * sees tasks linked to their contact / flagged client-visible, and
 * invoices whose contact_id matches their profile's contact_id.
 */

export interface ClientPortalTaskSummary {
  total: number;
  completed: number;
  active: number;
}

export interface ClientPortalInvoiceRow {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  currency: string;
  total: number;
  dueDate: string | null;
  createdAt: string;
}

export interface ClientPortalInvoiceSummary {
  /** Sum of sent + overdue totals (RLS-scoped to the caller). */
  outstanding: number;
  /** Sum of paid totals. */
  paid: number;
  recent: ClientPortalInvoiceRow[];
}

export interface ClientPortalData {
  tasks: ClientPortalTaskSummary;
  invoices: ClientPortalInvoiceSummary;
}

/** PostgREST returns NUMERIC columns as strings by default. */
function toNumber(value: string | number | null | undefined): number {
  return Number(value ?? 0) || 0;
}

export async function getClientPortalData(): Promise<ClientPortalData | null> {
  const userContext = await getCurrentUserContext();
  if (!userContext || !userContext.organization) return null;

  const organizationId = userContext.organization.id;
  const supabase = await createServerClient();

  const [tasksResult, invoicesResult] = await Promise.all([
    supabase
      .from("tasks")
      .select("status")
      .eq("organization_id", organizationId),
    supabase
      .from("invoices")
      .select(
        "id, invoice_number, status, currency, total, due_date, created_at"
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  // Tasks are RLS-scoped for Client callers; count locally.
  const taskRows = tasksResult.data ?? [];
  const completed = taskRows.filter((row) => row.status === "done").length;

  const invoiceRows = invoicesResult.data ?? [];
  let outstanding = 0;
  let paid = 0;
  const recent: ClientPortalInvoiceRow[] = [];

  for (const row of invoiceRows) {
    const total = toNumber(row.total);
    if (row.status === "sent" || row.status === "overdue") {
      outstanding += total;
    } else if (row.status === "paid") {
      paid += total;
    }
    if (recent.length < 3) {
      recent.push({
        id: row.id,
        invoiceNumber: row.invoice_number,
        status: row.status as InvoiceStatus,
        currency: row.currency,
        total,
        dueDate: row.due_date,
        createdAt: row.created_at,
      });
    }
  }

  return {
    tasks: {
      total: taskRows.length,
      completed,
      active: taskRows.length - completed,
    },
    invoices: {
      outstanding,
      paid,
      recent,
    },
  };
}