"use server";

import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import {
  createMarketingLeadSchema,
  type MarketingLeadState,
} from "@/lib/validations/marketing-leads";
import { getDictionary } from "@/lib/i18n/get-dictionary";
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

/**
 * Public, unauthenticated lead-capture action for the SpeciaLevel marketing
 * site. Re-validates the payload server-side (never trust the client), then
 * inserts the submission into `marketing_leads` via the service-role client
 * so the CRM module can surface it to `crm.manage` holders. If the database
 * insert is unavailable (missing env / transient outage), the lead falls
 * back to `data/marketing-leads.jsonl` so no submission is ever lost.
 *
 * When `MARKETING_LEADS_WEBHOOK_URL` is configured (e.g. a Make.com /
 * FormSubmit / Zapier endpoint), the lead is also forwarded there so it can
 * land in an external CRM or inbox. The webhook never blocks a success.
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
  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("marketing_leads").insert({
      name: lead.name,
      email: lead.email,
      company: lead.company || null,
      bottleneck: lead.bottleneck || null,
      package_of_interest: lead.packageOfInterest || null,
    });
    stored = !error;
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

  // Optional CRM / inbox forwarding once a webhook is configured.
  const webhookUrl = process.env.MARKETING_LEADS_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lead),
      });
    } catch {
      // The lead is already stored in the database (or the jsonl fallback)
      // — never fail the submission because the webhook was unreachable.
    }
  }

  return { status: "success" };
}