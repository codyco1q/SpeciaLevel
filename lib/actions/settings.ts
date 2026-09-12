"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import {
  createOrganizationSettingsSchema,
  createProfileSchema,
  type SettingsActionState,
} from "@/lib/validations/settings";
import { getDictionary } from "@/lib/i18n/get-dictionary";

function parseFieldErrors(
  issues: z.ZodIssue[]
): SettingsActionState["fieldErrors"] {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string") {
      (fieldErrors[key] ??= []).push(issue.message);
    }
  }
  return fieldErrors;
}

async function requireSettingsManage(): Promise<
  | { ok: true; organizationId: string }
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

  if (!hasPermission("settings.manage", userContext.permissions)) {
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

  return { ok: true, organizationId };
}

/**
 * Update the organization's name and timezone.
 * Requires the `settings.manage` permission.
 */
export async function updateOrganizationSettings(data: {
  name: string;
  timezone: string;
}): Promise<SettingsActionState> {
  const auth = await requireSettingsManage();
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

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      name: parsed.data.name,
      timezone: parsed.data.timezone,
    })
    .eq("id", auth.organizationId);

  if (error) {
    return {
      status: "error",
      error: err.updateOrgFailed,
    };
  }

  // Refresh the settings page, the dashboard, and the shared layout so
  // sidebar labels (org name / user name) update right away.
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/", "layout");

  return { status: "success" };
}

/**
 * Update the signed-in user's personal profile (name, job title).
 * Available to any authenticated member — no special permission needed.
 */
export async function updateProfile(data: {
  full_name: string;
  job_title?: string;
}): Promise<SettingsActionState> {
  const userContext = await getCurrentUserContext();
  const dict = await getDictionary();
  const err = dict.platform.settings.errors;

  if (!userContext) {
    return {
      status: "error",
      error: err.signedIn,
    };
  }

  const parsed = createProfileSchema(err).safeParse(data);
  if (!parsed.success) {
    return {
      status: "error",
      error: null,
      fieldErrors: parseFieldErrors(parsed.error.issues),
    };
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      job_title: parsed.data.job_title?.trim() ? parsed.data.job_title : null,
    })
    .eq("id", userContext.user.id);

  if (error) {
    return {
      status: "error",
      error: err.updateProfileFailed,
    };
  }

  revalidatePath("/settings");
  revalidatePath("/", "layout");

  return { status: "success" };
}