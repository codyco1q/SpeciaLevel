"use server";

import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import {
  createMarketingLeadSchema,
  type MarketingLeadState,
} from "@/lib/validations/marketing-leads";
import {
  getDictionary,
  getLocale,
  type Locale,
} from "@/lib/i18n/get-dictionary";
import { createServiceRoleClient } from "@/lib/supabase/admin";

function parseFieldErrors(
  issues: z.ZodIssue[]
): MarketingLeadState["fieldErrors"] {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string") {
      (fieldErrors[key] ??= []).push(issue.message);
    }
  }
  return fieldErrors;
}

/** Row returned by the marketing_leads insert (DB-generated id + timestamp). */
interface InsertedMarketingLead {
  id: string;
  created_at: string;
}

/** Payload forwarded to the optional outbound endpoint for a stored lead. */
interface MarketingLeadWebhookPayload {
  event: "marketing.lead_created";
  lead_id: string;
  name: string;
  email: string;
  company: string | null;
  bottleneck: string | null;
  package_of_interest: string | null;
  locale: Locale;
  created_at: string;
}

/**
 * Fire-and-forget outbound webhook dispatch. The caller never awaits it, so
 * a slow or unreachable endpoint cannot delay the public submission's
 * success response. `AbortSignal.timeout(5000)` bounds the network hop in
 * case the process lingers, and a non-2xx response rejects here so the
 * caller can log and swallow it.
 */
async function dispatchMarketingLeadWebhook(
  url: string,
  payload: MarketingLeadWebhookPayload
): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`webhook responded with ${response.status}`);
  }
}

/**
 * Public, unauthenticated lead-capture action for the SpeciaLevel marketing
 * site. Re-validates the payload server-side (never trust the client), then
 * inserts the submission into `marketing_leads` via the service-role client
 * so the CRM module can surface it to `crm.manage` holders. If the database
 * insert is unavailable (missing env / transient outage), the lead falls
 * back to `data/marketing-leads.jsonl` so no submission is ever lost.
 *
 * When `MARKETING_LEADS_WEBHOOK_URL` is configured (e.g. a Make.com /
 * FormSubmit / Zapier endpoint), leads saved to `marketing_leads` are also
 * forwarded there so they can land in an external CRM or inbox. The
 * dispatch is fire-and-forget with a 5s timeout — it never blocks, delays,
 * or fails the public submission.
 */
export async function submitMarketingLead(
  _prevState: MarketingLeadState,
  formData: FormData
): Promise<MarketingLeadState> {
  const payload = {
    name: formData.get("name"),
    email: formData.get("email"),
    company: formData.get("company"),
    bottleneck: formData.get("bottleneck"),
    packageOfInterest: formData.get("packageOfInterest"),
  };

  // Validate with messages matching the visitor's active locale so
  // server-side field errors render in the same language as the form.
  const dict = await getDictionary();
  const locale = await getLocale();
  const parsed = createMarketingLeadSchema(
    dict.contact.form
  ).safeParse(payload);
  if (!parsed.success) {
    return {
      status: "error",
      error: null,
      fieldErrors: parseFieldErrors(parsed.error.issues),
    };
  }

  const lead = {
    ...parsed.data,
    submittedAt: new Date().toISOString(),
  };

  // 1) Primary store: insert into `marketing_leads` with the service-role
  //    client (public action — bypasses RLS deliberately). The CRM module
  //    surfaces these rows to users holding `crm.manage`.
  let stored = false;
  let insertedLead: InsertedMarketingLead | null = null;
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("marketing_leads")
      .insert({
        name: lead.name,
        email: lead.email,
        company: lead.company || null,
        bottleneck: lead.bottleneck || null,
        package_of_interest: lead.packageOfInterest || null,
      })
      .select("id, created_at")
      .single();
    insertedLead = data;
    stored = !error && !!insertedLead;
    if (error) {
      console.error("[marketing-leads] DB insert failed:", error.message);
    }
  } catch (error) {
    console.error("[marketing-leads] DB insert threw:", error);
  }

  // 2) Fallback store: append to data/marketing-leads.jsonl so a DB outage
  //    never loses a submission.
  if (!stored) {
    try {
      const dir = path.join(process.cwd(), "data");
      await mkdir(dir, { recursive: true });
      await appendFile(
        path.join(dir, "marketing-leads.jsonl"),
        `${JSON.stringify(lead)}\n`,
        "utf8"
      );
    } catch {
      return {
        status: "error",
        error: dict.contact.form.submitError,
      };
    }
  }

  // 3) Optional outbound forwarding for leads saved to `marketing_leads`.
  //    The dispatch is fire-and-forget (never awaited) and wrapped in a
  //    non-blocking try/catch plus a 5s abort timeout, so webhook latency
  //    or downtime can neither fail nor delay the public submission.
  //    Without the database row there is no lead_id to forward, so a failed
  //    insert relies on the jsonl fallback alone.
  const webhookUrl = process.env.MARKETING_LEADS_WEBHOOK_URL;
  if (!webhookUrl) {
    console.debug(
      "[marketing-leads] MARKETING_LEADS_WEBHOOK_URL is not set; " +
        "skipping webhook dispatch"
    );
  } else if (insertedLead) {
    const webhookPayload: MarketingLeadWebhookPayload = {
      event: "marketing.lead_created",
      lead_id: insertedLead.id,
      name: lead.name,
      email: lead.email,
      company: lead.company ?? null,
      bottleneck: lead.bottleneck ?? null,
      package_of_interest: lead.packageOfInterest ?? null,
      locale,
      created_at: insertedLead.created_at,
    };

    console.debug(
      `[marketing-leads] Dispatching lead webhook for id ${insertedLead.id}`
    );
    try {
      void dispatchMarketingLeadWebhook(webhookUrl, webhookPayload).catch(
        (reason) => {
          // The lead is already stored — a failed forward must not affect
          // the success the visitor already saw.
          console.error("[marketing-leads] Webhook dispatch failed:", reason);
        }
      );
    } catch (error) {
      console.error("[marketing-leads] Webhook dispatch failed:", error);
    }
  } else {
    console.debug(
      "[marketing-leads] lead was not saved to marketing_leads; " +
        "skipping webhook dispatch"
    );
  }

  return { status: "success" };
}