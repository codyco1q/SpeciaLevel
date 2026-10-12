"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
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

/**
 * Update the signed-in user's personal profile (name, job title).
 * Available to any authenticated member — no special permission needed.
 */
export async function updateProfile(data: {
  full_name: string;
  job_title?: string;
  timezone?: string;
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
      timezone: parsed.data.timezone?.trim() ? parsed.data.timezone : null,
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

/**
 * Upload personal profile avatar to Supabase storage bucket `organization-assets`
 * and persist the public URL on `public.profiles.avatar_url`.
 */
export async function uploadProfileAvatar(
  formData: FormData
): Promise<SettingsActionState> {
  const userContext = await getCurrentUserContext();
  const dict = await getDictionary();
  const err = dict.platform.settings.errors;

  if (!userContext) {
    return {
      status: "error",
      error: err.signedIn,
    };
  }

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
      error: "Avatar file size must be under 5MB.",
    };
  }

  const allowedTypes = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/gif",
  ];
  if (!allowedTypes.includes(fileObj.type)) {
    return {
      status: "error",
      error: "Unsupported file type. Please upload a PNG, JPG, WebP, or GIF.",
    };
  }

  const extension = fileObj.name.split(".").pop()?.toLowerCase() || "png";
  const storagePath = `avatars/${userContext.user.id}-${Date.now()}.${extension}`;

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
      error: `Could not upload avatar: ${uploadError.message}`,
    };
  }

  const { data: publicUrlData } = admin.storage
    .from("organization-assets")
    .getPublicUrl(storagePath);

  const avatarUrl = publicUrlData.publicUrl;

  const { error: dbError } = await admin
    .from("profiles")
    .update({
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userContext.user.id);

  if (dbError) {
    return {
      status: "error",
      error: "Avatar was uploaded but could not be saved to your profile.",
    };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/employees");
  revalidatePath("/", "layout");

  return { status: "success", avatarUrl };
}

/**
 * Remove personal profile avatar.
 */
export async function removeProfileAvatar(): Promise<SettingsActionState> {
  const userContext = await getCurrentUserContext();
  const dict = await getDictionary();
  const err = dict.platform.settings.errors;

  if (!userContext) {
    return {
      status: "error",
      error: err.signedIn,
    };
  }

  const admin = createServiceRoleClient();
  const { error } = await admin
    .from("profiles")
    .update({
      avatar_url: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userContext.user.id);

  if (error) {
    return {
      status: "error",
      error: "Could not remove avatar from profile.",
    };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/employees");
  revalidatePath("/", "layout");

  return { status: "success", avatarUrl: null };
}
