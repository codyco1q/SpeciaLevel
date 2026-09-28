"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/rbac";
import type { PhoneNumber } from "@/types/database";

export interface TelephonyTokenResult {
  identity: string;
  organization_id: string;
  provider?: string;
  account_sid?: string;
  api_key_sid?: string;
  twiml_app_sid?: string;
  has_active_carrier: boolean;
  message?: string;
}

export async function getOrgCallerNumbers(): Promise<{
  status: "success" | "error";
  numbers?: PhoneNumber[];
  error?: string;
}> {
  const userContext = await getCurrentUserContext();
  if (!userContext || !userContext.organization) {
    return { status: "error", error: "Unauthorized" };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("phone_numbers")
    .select("*")
    .eq("organization_id", userContext.organization.id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    return { status: "error", error: error.message };
  }

  return { status: "success", numbers: (data as PhoneNumber[]) || [] };
}

export async function getTelephonyClientToken(
  identity?: string
): Promise<{
  status: "success" | "error";
  data?: TelephonyTokenResult;
  error?: string;
}> {
  const userContext = await getCurrentUserContext();
  if (!userContext || !userContext.organization) {
    return { status: "error", error: "Unauthorized" };
  }

  const canCall =
    hasPermission("telecom.manage", userContext.permissions) ||
    hasPermission("telecom.view", userContext.permissions);

  if (!canCall) {
    return { status: "error", error: "Forbidden: insufficient permissions" };
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc(
    "generate_telephony_client_token",
    { p_identity: identity || userContext.user.id }
  );

  if (error) {
    return { status: "error", error: error.message };
  }

  return { status: "success", data: data as TelephonyTokenResult };
}

export async function initiateOutboundCall(input: {
  destinationNumber: string;
  callerIdNumber?: string;
  contactId?: string | null;
  callerPhoneNumberId?: string | null;
}): Promise<{
  status: "success" | "error";
  callId?: string;
  error?: string;
}> {
  const userContext = await getCurrentUserContext();
  if (!userContext || !userContext.organization) {
    return { status: "error", error: "Unauthorized" };
  }

  const canCall =
    hasPermission("telecom.manage", userContext.permissions) ||
    hasPermission("telecom.view", userContext.permissions);

  if (!canCall) {
    return { status: "error", error: "Forbidden: insufficient permissions" };
  }

  const dest = input.destinationNumber.trim();
  if (!dest) {
    return { status: "error", error: "Destination number is required" };
  }

  const supabase = await createServerClient();
  const fromNumber = input.callerIdNumber?.trim() || "+10000000000";

  const { data, error } = await supabase
    .from("telecom_calls")
    .insert({
      organization_id: userContext.organization.id,
      agent_id: userContext.user.id,
      contact_id: input.contactId || null,
      caller_phone_number_id: input.callerPhoneNumberId || null,
      direction: "outbound",
      status: "in-progress",
      from_number: fromNumber,
      to_number: dest,
      duration_seconds: 0,
    })
    .select("id")
    .single();

  if (error) {
    return { status: "error", error: error.message };
  }

  return { status: "success", callId: data.id };
}

export async function completeCall(input: {
  callId: string;
  durationSeconds: number;
  notes?: string;
  outcome?: string;
  contactId?: string | null;
}): Promise<{
  status: "success" | "error";
  error?: string;
}> {
  const userContext = await getCurrentUserContext();
  if (!userContext || !userContext.organization) {
    return { status: "error", error: "Unauthorized" };
  }

  const supabase = await createServerClient();

  // Map outcome to telecom call status
  let finalStatus = "completed";
  if (input.outcome === "no-answer") finalStatus = "no-answer";
  else if (input.outcome === "busy") finalStatus = "busy";
  else if (input.outcome === "left-voicemail") finalStatus = "voicemail";

  const { error } = await supabase
    .from("telecom_calls")
    .update({
      duration_seconds: Math.max(0, input.durationSeconds || 0),
      status: finalStatus,
      notes: input.notes?.trim() || null,
      outcome: input.outcome || "completed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.callId)
    .eq("organization_id", userContext.organization.id);

  if (error) {
    return { status: "error", error: error.message };
  }

  // If notes and contactId were provided, log note to contact timeline
  if (input.contactId && input.notes?.trim()) {
    const outcomeLabel = input.outcome ? ` [Outcome: ${input.outcome}]` : "";
    const durationLabel = ` (Duration: ${Math.floor(input.durationSeconds / 60)}m ${input.durationSeconds % 60}s)`;
    const noteContent = `📞 Call Log${durationLabel}${outcomeLabel}\n\n${input.notes.trim()}`;

    await supabase.from("crm_contact_notes").insert({
      organization_id: userContext.organization.id,
      contact_id: input.contactId,
      author_id: userContext.user.id,
      body: noteContent,
    });
  }

  if (input.contactId) {
    revalidatePath(`/contacts/${input.contactId}`);
    revalidatePath(`/crm/contacts/${input.contactId}`);
  }
  revalidatePath("/contacts");
  revalidatePath("/crm");
  revalidatePath("/phone-numbers");
  revalidatePath("/messaging");

  return { status: "success" };
}
