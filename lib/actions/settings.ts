"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { hasPermission } from "@/lib/auth/rbac";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import {
  organizationSettingsSchema,
  profileSchema,
  type SettingsActionState,
} from "@/lib/validations/settings";

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
  if (!userContext) {
    return {
      ok: false,
      error: { status: "error", error: "You must be signed in to do this." },
    };
  }

  if (!hasPermission("settings.manage", userContext.permissions)) {
    return {
      ok: false,
      error: {
        status: "error",
        error: "You don't have permission to manage settings.",
      },
    };
  }

  const organizationId = userContext.organization?.id;
  if (!organizationId) {
    return {
      ok: false,
      error: {
        status: "error",
        error: "No organization found for your account.",
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

  const parsed = organizationSettingsSchema.safeParse(data);
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
      error: "Could not update organization settings. Please try again.",
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
  if (!userContext) {
    return {
      status: "error",
      error: "You must be signed in to do this.",
    };
  }

  const parsed = profileSchema.safeParse(data);
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
      error: "Could not update your profile. Please try again.",
    };
  }

  revalidatePath("/settings");
  revalidatePath("/", "layout");

  return { status: "success" };
}