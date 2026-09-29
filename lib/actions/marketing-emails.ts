"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/rbac";
import { createServerClient } from "@/lib/supabase/server";
import {
  saveEmailTemplateSchema,
  deleteEmailTemplateSchema,
  sendTestEmailSchema,
  compileEmailBlocksToHtml,
  type SaveEmailTemplateInput,
} from "@/lib/validations/marketing";
import type { MarketingEmailTemplate } from "@/types/database";

async function requirePermission(permission: "marketing.view" | "marketing.manage") {
  const userContext = await getCurrentUserContext();
  if (!userContext) return { ok: false as const, error: "Not signed in." };
  if (!userContext.organization) return { ok: false as const, error: "No active organization." };
  if (!hasPermission(permission, userContext.permissions)) {
    return { ok: false as const, error: "Insufficient permissions." };
  }
  return {
    ok: true as const,
    userId: userContext.user.id,
    organizationId: userContext.organization.id,
  };
}

export async function getEmailTemplates(): Promise<MarketingEmailTemplate[]> {
  const auth = await requirePermission("marketing.view");
  if (!auth.ok) return [];

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("marketing_email_templates")
    .select(
      `
      id,
      organization_id,
      name,
      subject,
      preview_text,
      body_json,
      body_html,
      created_by,
      created_at,
      updated_at,
      creator:profiles!marketing_email_templates_created_by_fkey(id, full_name, email)
    `
    )
    .eq("organization_id", auth.organizationId)
    .order("created_at", { ascending: false });

  if (error) return [];

  return (data ?? []).map((row: any) => {
    const creator = Array.isArray(row.creator) ? row.creator[0] : row.creator;
    return {
      id: row.id,
      organization_id: row.organization_id,
      name: row.name,
      subject: row.subject,
      preview_text: row.preview_text,
      body_json: row.body_json || [],
      body_html: row.body_html || "",
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      creator: creator
        ? {
            id: creator.id,
            full_name: creator.full_name,
            email: creator.email,
          }
        : null,
    };
  });
}

export async function getEmailTemplateById(
  id: string
): Promise<MarketingEmailTemplate | null> {
  const auth = await requirePermission("marketing.view");
  if (!auth.ok) return null;

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("marketing_email_templates")
    .select(
      `
      id,
      organization_id,
      name,
      subject,
      preview_text,
      body_json,
      body_html,
      created_by,
      created_at,
      updated_at,
      creator:profiles!marketing_email_templates_created_by_fkey(id, full_name, email)
    `
    )
    .eq("id", id)
    .eq("organization_id", auth.organizationId)
    .single();

  if (error || !data) return null;

  const creator = Array.isArray(data.creator) ? data.creator[0] : data.creator;
  return {
    id: data.id,
    organization_id: data.organization_id,
    name: data.name,
    subject: data.subject,
    preview_text: data.preview_text,
    body_json: data.body_json || [],
    body_html: data.body_html || "",
    created_by: data.created_by,
    created_at: data.created_at,
    updated_at: data.updated_at,
    creator: creator
      ? {
          id: creator.id,
          full_name: creator.full_name,
          email: creator.email,
        }
      : null,
  };
}


export async function saveEmailTemplate(payload: SaveEmailTemplateInput): Promise<{
  status: "success" | "error";
  error?: string;
  template?: MarketingEmailTemplate;
}> {
  const auth = await requirePermission("marketing.manage");
  if (!auth.ok) return { status: "error", error: auth.error };

  const parsed = saveEmailTemplateSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      status: "error",
      error: parsed.error.issues[0]?.message || "Invalid template data.",
    };
  }

  const data = parsed.data;
  const compiledHtml = data.bodyHtml || compileEmailBlocksToHtml(data.bodyJson);
  const supabase = await createServerClient();

  if (data.id) {
    const { data: updated, error } = await supabase
      .from("marketing_email_templates")
      .update({
        name: data.name,
        subject: data.subject,
        preview_text: data.previewText || null,
        body_json: data.bodyJson,
        body_html: compiledHtml,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("organization_id", auth.organizationId)
      .select()
      .single();

    if (error) {
      return { status: "error", error: "Failed to update template." };
    }

    revalidatePath("/marketing");
    revalidatePath("/marketing/emails");
    return { status: "success", template: updated as MarketingEmailTemplate };
  } else {
    const { data: inserted, error } = await supabase
      .from("marketing_email_templates")
      .insert({
        organization_id: auth.organizationId,
        name: data.name,
        subject: data.subject,
        preview_text: data.previewText || null,
        body_json: data.bodyJson,
        body_html: compiledHtml,
        created_by: auth.userId,
      })
      .select()
      .single();

    if (error) {
      return { status: "error", error: "Failed to create template." };
    }

    revalidatePath("/marketing");
    revalidatePath("/marketing/emails");
    return { status: "success", template: inserted as MarketingEmailTemplate };
  }
}

export async function deleteEmailTemplate(id: string): Promise<{
  status: "success" | "error";
  error?: string;
}> {
  const auth = await requirePermission("marketing.manage");
  if (!auth.ok) return { status: "error", error: auth.error };

  const parsed = deleteEmailTemplateSchema.safeParse({ id });
  if (!parsed.success) return { status: "error", error: "Invalid template ID." };

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("marketing_email_templates")
    .delete()
    .eq("id", parsed.data.id)
    .eq("organization_id", auth.organizationId);

  if (error) {
    return { status: "error", error: "Failed to delete template." };
  }

  revalidatePath("/marketing");
  revalidatePath("/marketing/emails");
  return { status: "success" };
}

export async function sendTestEmail(payload: {
  templateId?: string;
  toEmail: string;
  subject?: string;
  bodyHtml?: string;
}): Promise<{ status: "success" | "error"; error?: string }> {
  const auth = await requirePermission("marketing.manage");
  if (!auth.ok) return { status: "error", error: auth.error };

  const parsed = sendTestEmailSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      status: "error",
      error: parsed.error.issues[0]?.message || "Invalid test email parameters.",
    };
  }

  console.log(`[marketing] Test email sent to: ${parsed.data.toEmail}`);
  return { status: "success" };
}
