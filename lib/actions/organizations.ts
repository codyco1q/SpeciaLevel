"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  createOrganizationSettingsSchema,
  type OrganizationSettingsValues,
  type SettingsActionState,
} from "@/lib/validations/organizations";
import { getDictionary } from "@/lib/i18n/get-dictionary";

function parseFieldErrors(
  issues: z.ZodIssue[]
): SettingsActionState["fieldErrors"] {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path.join(".");
    if (key) {
      (fieldErrors[key] ??= []).push(issue.message);
    }
  }
  return fieldErrors;
}

export async function requireOrganizationManage(): Promise<
  | { ok: true; organizationId: string; userId: string }
  | { ok: false; error: SettingsActionState }
> {
  const userContext = await getCurrentUserContext();
  const dict = await getDictionary();
  const err = dict.platform.settings.errors;

  if (!userContext) {
    return {
      ok: false,
      error: { status: "error", error: err.signedIn },
    };
  }

  const isOwnerOrAdmin = userContext.roles.some(
    (role) => role.key === "owner" || role.key === "admin"
  );
  const canManage =
    isOwnerOrAdmin ||
    hasPermission("settings.manage", userContext.permissions) ||
    hasPermission("organization.manage", userContext.permissions);

  if (!canManage) {
    return {
      ok: false,
      error: {
        status: "error",
        error: err.noPermission,
      },
    };
  }

  const organizationId = userContext.organization?.id;
  if (!organizationId) {
    return {
      ok: false,
      error: {
        status: "error",
        error: err.noOrg,
      },
    };
  }

  return { ok: true, organizationId, userId: userContext.user.id };
}

/**
 * Update organization branding, profile metadata, contact info, security, and billing defaults.
 */
export async function updateOrganizationSettings(
  data: Partial<OrganizationSettingsValues>
): Promise<SettingsActionState> {
  const auth = await requireOrganizationManage();
  if (!auth.ok) return auth.error;

  const dict = await getDictionary();
  const err = dict.platform.settings.errors;

  const parsed = createOrganizationSettingsSchema(err).safeParse(data);
  if (!parsed.success) {
    return {
      status: "error",
      error: null,
      fieldErrors: parseFieldErrors(parsed.error.issues),
    };
  }

  const admin = createServiceRoleClient();
  const { error } = await admin
    .from("organizations")
    .update({
      name: parsed.data.name,
      legal_name: parsed.data.legal_name?.trim() || null,
      tax_id: parsed.data.tax_id?.trim() || null,
      website: parsed.data.website?.trim() || null,
      contact_email: parsed.data.contact_email?.trim() || null,
      contact_phone: parsed.data.contact_phone?.trim() || null,
      address: parsed.data.address,
      timezone: parsed.data.timezone,
      default_currency: parsed.data.default_currency,
      date_format: parsed.data.date_format,
      security_settings: parsed.data.security_settings,
      billing_defaults: parsed.data.billing_defaults,
      logo_url: parsed.data.logo_url ?? undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", auth.organizationId);

  if (error) {
    return {
      status: "error",
      error: err.updateOrgFailed,
    };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/employees");
  revalidatePath("/invoicing");
  revalidatePath("/", "layout");

  return { status: "success", logoUrl: parsed.data.logo_url ?? null };
}

/**
 * Upload organization logo to Supabase storage bucket `organization-assets`
 * and persist the public URL on `public.organizations.logo_url`.
 */
export async function uploadOrganizationLogo(
  formData: FormData
): Promise<SettingsActionState> {
  const auth = await requireOrganizationManage();
  if (!auth.ok) return auth.error;

  const file = formData.get("file");
  if (!file || !(file instanceof Blob) || typeof (file as File).name !== "string") {
    return {
      status: "error",
      error: "Please select an image file to upload.",
    };
  }

  const fileObj = file as File;

  // 5MB limit
  if (fileObj.size > 5 * 1024 * 1024) {
    return {
      status: "error",
      error: "Logo file size must be under 5MB.",
    };
  }

  const allowedTypes = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/svg+xml",
    "image/gif",
  ];
  if (!allowedTypes.includes(fileObj.type)) {
    return {
      status: "error",
      error: "Unsupported file type. Please upload a PNG, JPG, WebP, SVG, or GIF.",
    };
  }

  const extension = fileObj.name.split(".").pop()?.toLowerCase() || "png";
  const storagePath = `${auth.organizationId}/logo-${Date.now()}.${extension}`;

  const admin = createServiceRoleClient();
  const fileBuffer = await fileObj.arrayBuffer();

  const { error: uploadError } = await admin.storage
    .from("organization-assets")
    .upload(storagePath, fileBuffer, {
      contentType: fileObj.type,
      upsert: true,
    });

  if (uploadError) {
    return {
      status: "error",
      error: `Could not upload logo: ${uploadError.message}`,
    };
  }

  const { data: publicUrlData } = admin.storage
    .from("organization-assets")
    .getPublicUrl(storagePath);

  const logoUrl = publicUrlData.publicUrl;

  const { error: dbError } = await admin
    .from("organizations")
    .update({
      logo_url: logoUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", auth.organizationId);

  if (dbError) {
    return {
      status: "error",
      error: "Logo was uploaded but could not be saved to organization settings.",
    };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/employees");
  revalidatePath("/", "layout");

  return { status: "success", logoUrl };
}

/**
 * Remove organization logo.
 */
export async function removeOrganizationLogo(): Promise<SettingsActionState> {
  const auth = await requireOrganizationManage();
  if (!auth.ok) return auth.error;

  const admin = createServiceRoleClient();
  const { error } = await admin
    .from("organizations")
    .update({
      logo_url: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", auth.organizationId);

  if (error) {
    return {
      status: "error",
      error: "Could not remove organization logo.",
    };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/employees");
  revalidatePath("/", "layout");

  return { status: "success", logoUrl: null };
}

