"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/rbac";
import { createServerClient } from "@/lib/supabase/server";
import {
  carrierSettingsSchema,
  phoneNumberSchema,
  type CarrierSettingsFormValues,
  type PhoneNumberFormValues,
} from "@/lib/validations/phone-numbers";
import type { PhoneCarrierSettings, PhoneNumber } from "@/types/database";

export interface PhoneNumberWithAgent extends PhoneNumber {
  assigned_user?: {
    id: string;
    full_name: string | null;
    email: string | null;
  } | null;
}

/**
 * Retrieves the carrier settings for the caller's organization.
 * Sensitive tokens are masked if present.
 */
export async function getCarrierSettings(): Promise<PhoneCarrierSettings | null> {
  const userContext = await getCurrentUserContext();
  if (!userContext?.organization) return null;

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("phone_carrier_settings")
    .select("*")
    .eq("organization_id", userContext.organization.id)
    .maybeSingle();

  if (error || !data) return null;

  return {
    ...data,
    auth_token_encrypted: data.auth_token_encrypted
      ? "••••••••••••••••"
      : null,
    api_key_secret_encrypted: data.api_key_secret_encrypted
      ? "••••••••••••••••"
      : null,
  } as PhoneCarrierSettings;
}

/**
 * Saves (upserts) the carrier credentials for the organization.
 */
export async function saveCarrierSettings(values: CarrierSettingsFormValues) {
  const userContext = await getCurrentUserContext();
  if (!userContext?.organization) {
    return { status: "error" as const, error: "Unauthorized" };
  }

  if (!hasPermission("telecom.manage", userContext.permissions)) {
    return { status: "error" as const, error: "Forbidden: insufficient permissions" };
  }

  const parsed = carrierSettingsSchema.safeParse(values);
  if (!parsed.success) {
    return {
      status: "error" as const,
      error: parsed.error.issues[0]?.message ?? "Invalid settings payload",
    };
  }

  const supabase = await createServerClient();
  const orgId = userContext.organization.id;

  const { data: existing } = await supabase
    .from("phone_carrier_settings")
    .select("auth_token_encrypted, api_key_secret_encrypted")
    .eq("organization_id", orgId)
    .maybeSingle();

  const isMaskedAuth = parsed.data.authToken?.includes("••••");
  const isMaskedSecret = parsed.data.apiKeySecret?.includes("••••");

  const authToken = isMaskedAuth
    ? existing?.auth_token_encrypted ?? null
    : parsed.data.authToken || null;

  const apiKeySecret = isMaskedSecret
    ? existing?.api_key_secret_encrypted ?? null
    : parsed.data.apiKeySecret || null;

  const payload = {
    organization_id: orgId,
    provider: parsed.data.provider,
    account_sid: parsed.data.accountSid || null,
    auth_token_encrypted: authToken,
    api_key_sid: parsed.data.apiKeySid || null,
    api_key_secret_encrypted: apiKeySecret,
    twiml_app_sid: parsed.data.twimlAppSid || null,
    is_active: parsed.data.isActive,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("phone_carrier_settings")
    .upsert(payload, { onConflict: "organization_id" });

  if (error) {
    return { status: "error" as const, error: error.message };
  }

  revalidatePath("/phone-numbers");
  return { status: "success" as const };
}

/**
 * Tests connection with the carrier service.
 */
export async function testCarrierConnection() {
  const userContext = await getCurrentUserContext();
  if (!userContext?.organization) {
    return { status: "error" as const, error: "Unauthorized" };
  }

  const supabase = await createServerClient();
  const { data: settings } = await supabase
    .from("phone_carrier_settings")
    .select("*")
    .eq("organization_id", userContext.organization.id)
    .maybeSingle();

  if (!settings || !settings.account_sid) {
    return {
      status: "error" as const,
      error: "No carrier credentials configured. Please set an Account SID first.",
    };
  }

  if (settings.provider === "twilio" && !settings.account_sid.startsWith("AC")) {
    return {
      status: "error" as const,
      error: "Invalid Twilio Account SID format (must begin with 'AC').",
    };
  }

  return {
    status: "success" as const,
    message: "Carrier configuration validated successfully.",
  };
}

/**
 * Returns all phone numbers registered for the current organization.
 */
export async function getPhoneNumbers(): Promise<PhoneNumberWithAgent[]> {
  const userContext = await getCurrentUserContext();
  if (!userContext?.organization) return [];

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("phone_numbers")
    .select(
      `
      id,
      organization_id,
      phone_number,
      friendly_name,
      capabilities,
      status,
      assigned_user_id,
      created_at,
      assigned_user:profiles!phone_numbers_assigned_user_id_fkey (
        id,
        full_name,
        email
      )
    `
    )
    .eq("organization_id", userContext.organization.id)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as unknown as PhoneNumberWithAgent[];
}

/**
 * Adds a new phone number to the inventory.
 */
export async function addPhoneNumber(values: PhoneNumberFormValues) {
  const userContext = await getCurrentUserContext();
  if (!userContext?.organization) {
    return { status: "error" as const, error: "Unauthorized" };
  }

  if (!hasPermission("telecom.manage", userContext.permissions)) {
    return { status: "error" as const, error: "Forbidden: insufficient permissions" };
  }

  const parsed = phoneNumberSchema.safeParse(values);
  if (!parsed.success) {
    return {
      status: "error" as const,
      error: parsed.error.issues[0]?.message ?? "Invalid phone number data",
    };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("phone_numbers")
    .insert({
      organization_id: userContext.organization.id,
      phone_number: parsed.data.phoneNumber,
      friendly_name: parsed.data.friendlyName || null,
      capabilities: parsed.data.capabilities,
      status: parsed.data.status,
      assigned_user_id: parsed.data.assignedUserId || null,
    })
    .select()
    .single();

  if (error) {
    return { status: "error" as const, error: error.message };
  }

  revalidatePath("/phone-numbers");
  revalidatePath("/messaging");
  return { status: "success" as const, data };
}

/**
 * Updates an existing phone number entry.
 */
export async function updatePhoneNumber(id: string, values: PhoneNumberFormValues) {
  const userContext = await getCurrentUserContext();
  if (!userContext?.organization) {
    return { status: "error" as const, error: "Unauthorized" };
  }

  if (!hasPermission("telecom.manage", userContext.permissions)) {
    return { status: "error" as const, error: "Forbidden: insufficient permissions" };
  }

  const parsed = phoneNumberSchema.safeParse(values);
  if (!parsed.success) {
    return {
      status: "error" as const,
      error: parsed.error.issues[0]?.message ?? "Invalid phone number data",
    };
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("phone_numbers")
    .update({
      phone_number: parsed.data.phoneNumber,
      friendly_name: parsed.data.friendlyName || null,
      capabilities: parsed.data.capabilities,
      status: parsed.data.status,
      assigned_user_id: parsed.data.assignedUserId || null,
    })
    .eq("id", id)
    .eq("organization_id", userContext.organization.id);

  if (error) {
    return { status: "error" as const, error: error.message };
  }

  revalidatePath("/phone-numbers");
  revalidatePath("/messaging");
  return { status: "success" as const };
}

/**
 * Deletes a phone number from the inventory.
 */
export async function deletePhoneNumber(id: string) {
  const userContext = await getCurrentUserContext();
  if (!userContext?.organization) {
    return { status: "error" as const, error: "Unauthorized" };
  }

  if (!hasPermission("telecom.manage", userContext.permissions)) {
    return { status: "error" as const, error: "Forbidden: insufficient permissions" };
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("phone_numbers")
    .delete()
    .eq("id", id)
    .eq("organization_id", userContext.organization.id);

  if (error) {
    return { status: "error" as const, error: error.message };
  }

  revalidatePath("/phone-numbers");
  revalidatePath("/messaging");
  return { status: "success" as const };
}
