"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { dispatchNotificationToOrgAdmins } from "@/lib/services/notifications";
import { getDictionary, type Locale } from "@/lib/i18n/get-dictionary";
import {
  createFormInputSchema,
  type CreateFormInput,
  type FormRow,
  type FormSubmissionRow,
  type PublicFormData,
} from "@/lib/validations/forms";

interface ActionResult<T = undefined> {
  status: "success" | "error";
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

async function getActionErrors() {
  const dictionary = await getDictionary();
  const fe = dictionary.platform.forms.errors;
  return {
    signedIn: fe.signedIn,
    noPermission: fe.noPermission,
    noOrg: fe.noOrg,
    titleRequired: fe.titleRequired,
    titleMax: fe.titleMax,
    slugInvalid: fe.slugInvalid,
    slugRequired: fe.slugRequired,
    slugExists: fe.slugExists,
    fieldsRequired: fe.fieldsRequired,
    createFailed: fe.createFailed,
    updateFailed: fe.updateFailed,
    deleteFailed: fe.deleteFailed,
  };
}

function toFormRow(row: any): FormRow {
  return {
    id: row.id,
    organizationId: row.organization_id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    isPublished: row.is_published,
    fields: row.fields ?? [],
    settings: {
      submitButtonText: row.settings?.submit_button_text,
      successMessage: row.settings?.success_message,
      autoCreateDeal: row.settings?.auto_create_deal,
      defaultDealStage: row.settings?.default_deal_stage,
      defaultDealValue: row.settings?.default_deal_value,
      redirectUrl: row.settings?.redirect_url,
    },
    submissionsCount: row.submissions_count ?? 0,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getForms(): Promise<FormRow[] | null> {
  const userContext = await getCurrentUserContext();
  if (
    !userContext ||
    !userContext.organization ||
    !hasPermission("forms.view", userContext.permissions)
  ) {
    return null;
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("inbound_forms")
    .select("*")
    .eq("organization_id", userContext.organization.id)
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("Failed to load forms:", error);
    return null;
  }

  return data.map(toFormRow);
}

export async function getFormById(id: string): Promise<FormRow | null> {
  const userContext = await getCurrentUserContext();
  if (
    !userContext ||
    !userContext.organization ||
    !hasPermission("forms.view", userContext.permissions)
  ) {
    return null;
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("inbound_forms")
    .select("*")
    .eq("id", id)
    .eq("organization_id", userContext.organization.id)
    .single();

  if (error || !data) {
    return null;
  }

  return toFormRow(data);
}

export async function createForm(
  input: CreateFormInput,
  _locale?: Locale
): Promise<ActionResult<FormRow>> {
  const err = await getActionErrors();
  const userContext = await getCurrentUserContext();

  if (!userContext || !userContext.organization) {
    return { status: "error", error: err.signedIn };
  }
  if (!hasPermission("forms.manage", userContext.permissions)) {
    return { status: "error", error: err.noPermission };
  }

  const schema = createFormInputSchema(err);
  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      error: err.createFailed,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createServerClient();

  const { data: existingSlug } = await supabase
    .from("inbound_forms")
    .select("id")
    .eq("slug", parsed.data.slug)
    .maybeSingle();

  if (existingSlug) {
    return {
      status: "error",
      error: err.slugExists,
      fieldErrors: { slug: [err.slugExists] },
    };
  }

  const dbSettings = {
    submit_button_text: parsed.data.settings?.submitButtonText || null,
    success_message: parsed.data.settings?.successMessage || null,
    auto_create_deal: parsed.data.settings?.autoCreateDeal ?? false,
    default_deal_stage: parsed.data.settings?.defaultDealStage || "lead",
    default_deal_value: parsed.data.settings?.defaultDealValue ?? 0,
    redirect_url: parsed.data.settings?.redirectUrl || null,
  };

  const { data, error } = await supabase
    .from("inbound_forms")
    .insert({
      organization_id: userContext.organization.id,
      title: parsed.data.title,
      slug: parsed.data.slug,
      description: parsed.data.description || null,
      is_published: parsed.data.isPublished,
      fields: parsed.data.fields,
      settings: dbSettings,
      created_by: userContext.user.id,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("Failed to create form:", error);
    return { status: "error", error: err.createFailed };
  }

  revalidatePath("/forms");
  return { status: "success", data: toFormRow(data) };
}

export async function updateForm(
  formId: string,
  input: CreateFormInput,
  _locale?: Locale
): Promise<ActionResult<FormRow>> {
  const err = await getActionErrors();
  const userContext = await getCurrentUserContext();

  if (!userContext || !userContext.organization) {
    return { status: "error", error: err.signedIn };
  }
  if (!hasPermission("forms.manage", userContext.permissions)) {
    return { status: "error", error: err.noPermission };
  }

  const schema = createFormInputSchema(err);
  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      error: err.updateFailed,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createServerClient();

  const { data: existingSlug } = await supabase
    .from("inbound_forms")
    .select("id")
    .eq("slug", parsed.data.slug)
    .neq("id", formId)
    .maybeSingle();

  if (existingSlug) {
    return {
      status: "error",
      error: err.slugExists,
      fieldErrors: { slug: [err.slugExists] },
    };
  }

  const dbSettings = {
    submit_button_text: parsed.data.settings?.submitButtonText || null,
    success_message: parsed.data.settings?.successMessage || null,
    auto_create_deal: parsed.data.settings?.autoCreateDeal ?? false,
    default_deal_stage: parsed.data.settings?.defaultDealStage || "lead",
    default_deal_value: parsed.data.settings?.defaultDealValue ?? 0,
    redirect_url: parsed.data.settings?.redirectUrl || null,
  };

  const { data, error } = await supabase
    .from("inbound_forms")
    .update({
      title: parsed.data.title,
      slug: parsed.data.slug,
      description: parsed.data.description || null,
      is_published: parsed.data.isPublished,
      fields: parsed.data.fields,
      settings: dbSettings,
      updated_at: new Date().toISOString(),
    })
    .eq("id", formId)
    .eq("organization_id", userContext.organization.id)
    .select()
    .single();

  if (error || !data) {
    console.error("Failed to update form:", error);
    return { status: "error", error: err.updateFailed };
  }

  revalidatePath("/forms");
  revalidatePath(`/f/${parsed.data.slug}`);
  return { status: "success", data: toFormRow(data) };
}

export async function deleteForm(
  formId: string,
  _locale?: Locale
): Promise<ActionResult> {
  const err = await getActionErrors();
  const userContext = await getCurrentUserContext();

  if (!userContext || !userContext.organization) {
    return { status: "error", error: err.signedIn };
  }
  if (!hasPermission("forms.manage", userContext.permissions)) {
    return { status: "error", error: err.noPermission };
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("inbound_forms")
    .delete()
    .eq("id", formId)
    .eq("organization_id", userContext.organization.id);

  if (error) {
    console.error("Failed to delete form:", error);
    return { status: "error", error: err.deleteFailed };
  }

  revalidatePath("/forms");
  return { status: "success" };
}

export async function toggleFormPublished(
  formId: string,
  isPublished: boolean,
  _locale?: Locale
): Promise<ActionResult> {
  const err = await getActionErrors();
  const userContext = await getCurrentUserContext();

  if (!userContext || !userContext.organization) {
    return { status: "error", error: err.signedIn };
  }
  if (!hasPermission("forms.manage", userContext.permissions)) {
    return { status: "error", error: err.noPermission };
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("inbound_forms")
    .update({ is_published: isPublished, updated_at: new Date().toISOString() })
    .eq("id", formId)
    .eq("organization_id", userContext.organization.id);

  if (error) {
    console.error("Failed to toggle published status:", error);
    return { status: "error", error: err.updateFailed };
  }

  revalidatePath("/forms");
  return { status: "success" };
}

export async function getFormSubmissions(
  formId: string
): Promise<FormSubmissionRow[] | null> {
  const userContext = await getCurrentUserContext();
  if (
    !userContext ||
    !userContext.organization ||
    !hasPermission("forms.view", userContext.permissions)
  ) {
    return null;
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("inbound_form_submissions")
    .select(
      `
      id,
      form_id,
      organization_id,
      data,
      contact_id,
      deal_id,
      ip_hash,
      created_at,
      crm_contacts(id, name, email, company, phone),
      crm_deals(id, title, value, currency, stage)
    `
    )
    .eq("form_id", formId)
    .eq("organization_id", userContext.organization.id)
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("Failed to load submissions:", error);
    return null;
  }

  return data.map((sub: any) => ({
    id: sub.id,
    formId: sub.form_id,
    organizationId: sub.organization_id,
    data: (sub.data as Record<string, unknown>) ?? {},
    contactId: sub.contact_id,
    dealId: sub.deal_id,
    ipHash: sub.ip_hash,
    createdAt: sub.created_at,
    contact: sub.crm_contacts
      ? {
          id: sub.crm_contacts.id,
          name: sub.crm_contacts.name,
          email: sub.crm_contacts.email,
          company: sub.crm_contacts.company,
          phone: sub.crm_contacts.phone,
        }
      : null,
    deal: sub.crm_deals
      ? {
          id: sub.crm_deals.id,
          title: sub.crm_deals.title,
          value: Number(sub.crm_deals.value ?? 0),
          currency: sub.crm_deals.currency ?? "USD",
          stage: sub.crm_deals.stage,
        }
      : null,
  }));
}

export async function getPublicFormBySlug(
  slug: string
): Promise<PublicFormData | null> {
  if (!slug) return null;

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("get_public_form_by_slug", {
    p_slug: slug,
  });

  if (error || !data) {
    return null;
  }

  const raw = data as any;

  return {
    id: raw.id,
    title: raw.title,
    slug: raw.slug,
    description: raw.description,
    isPublished: raw.is_published,
    fields: raw.fields ?? [],
    settings: {
      submitButtonText:
        raw.settings?.submit_button_text ??
        raw.settings?.submitButtonText ??
        "Submit",
      successMessage:
        raw.settings?.success_message ??
        raw.settings?.successMessage ??
        "Thank you! Your submission has been received.",
      redirectUrl: raw.settings?.redirect_url ?? raw.settings?.redirectUrl,
    },
    organizationName: raw.organization_name,
  };
}

export async function submitPublicForm(
  slug: string,
  submissionData: Record<string, unknown>
): Promise<{
  status: "success" | "error";
  redirectUrl?: string | null;
  successMessage?: string;
  error?: string;
}> {
  if (!slug || !submissionData) {
    return { status: "error", error: "Missing submission data" };
  }

  const headerList = await headers();
  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headerList.get("x-real-ip") ||
    "anon";

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("submit_public_form", {
    p_form_slug: slug,
    p_submission_data: submissionData,
    p_ip_hash: ip,
  });

  if (error || !data) {
    console.error("Public submission failed:", error);
    return {
      status: "error",
      error: error?.message || "Failed to submit form. Please try again.",
    };
  }

  const result = data as any;

  // Dispatch alert to organization admins/managers
  try {
    if (result.organization_id) {
      await dispatchNotificationToOrgAdmins({
        orgId: result.organization_id,
        title: "New Inbound Lead",
        message: `${result.lead_name || "New lead"} submitted form: ${result.form_title || slug}`,
        type: "lead",
        link: `/forms?formId=${result.form_id || ""}`,
        specificUserId: result.created_by,
      });
    }
  } catch (err) {
    console.error("[forms] Failed to dispatch lead notification:", err);
  }

  return {
    status: "success",
    redirectUrl: result.redirect_url,
    successMessage: result.success_message,
  };
}

