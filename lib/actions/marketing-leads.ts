"use server";

import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import {
  createMarketingLeadSchema,
  type MarketingLeadState,
} from "@/lib/validations/marketing-leads";
import { getDictionary } from "@/lib/i18n/get-dictionary";

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
 * persists each submission to `data/marketing-leads.jsonl`.
 *
 * When `MARKETING_LEADS_WEBHOOK_URL` is configured (e.g. a Make.com /
 * FormSubmit / Zapier endpoint), the lead is also forwarded there so it can
 * land in a CRM or inbox. Without it, the local store is the source of truth.
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
      // The lead is already stored locally — never fail the submission
      // because the webhook was unreachable.
    }
  }

  return { status: "success" };
}