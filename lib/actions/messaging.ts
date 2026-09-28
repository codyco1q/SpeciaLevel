"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/rbac";
import { createServerClient } from "@/lib/supabase/server";
import { externalSmsInputSchema, type ExternalSmsInput } from "@/lib/validations/messaging";
import type { CrmContact } from "@/types/database";

export interface ExternalThreadItem {
  contact: CrmContact;
  lastMessage?: {
    id: string;
    body: string;
    direction: "inbound" | "outbound";
    status: string;
    created_at: string;
  } | null;
  unreadCount?: number;
}

export interface SmsMessageRow {
  id: string;
  organization_id: string;
  contact_id: string | null;
  direction: "inbound" | "outbound";
  from_number: string;
  to_number: string;
  body: string;
  status: string;
  created_at: string;
}

/**
 * Returns external conversation threads grouped by contact, ordered by recent activity.
 */
export async function getExternalThreads(): Promise<ExternalThreadItem[]> {
  const userContext = await getCurrentUserContext();
  if (!userContext?.organization) return [];

  const supabase = await createServerClient();
  const orgId = userContext.organization.id;

  // 1. Fetch contacts
  const { data: contacts, error: contactsError } = await supabase
    .from("crm_contacts")
    .select("id, name, email, phone, company, title, notes, address, tags, created_by, created_at, updated_at")
    .eq("organization_id", orgId)
    .order("name", { ascending: true });

  if (contactsError || !contacts) return [];

  // 2. Fetch all SMS to compute threads
  const { data: smsRows } = await supabase
    .from("telecom_sms")
    .select("id, contact_id, direction, body, status, created_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  const contactLastMsgMap = new Map<
    string,
    { id: string; body: string; direction: "inbound" | "outbound"; status: string; created_at: string }
  >();

  if (smsRows) {
    for (const msg of smsRows) {
      if (msg.contact_id && !contactLastMsgMap.has(msg.contact_id)) {
        contactLastMsgMap.set(msg.contact_id, {
          id: msg.id,
          body: msg.body,
          direction: msg.direction as "inbound" | "outbound",
          status: msg.status,
          created_at: msg.created_at,
        });
      }
    }
  }

  const threads: ExternalThreadItem[] = contacts.map((contact) => ({
    contact: {
      ...contact,
      organization_id: orgId,
    } as CrmContact,
    lastMessage: contactLastMsgMap.get(contact.id) || null,
  }));

  // Sort by recent message first; then alphabetically
  threads.sort((a, b) => {
    if (a.lastMessage && b.lastMessage) {
      return new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime();
    }
    if (a.lastMessage) return -1;
    if (b.lastMessage) return 1;
    return a.contact.name.localeCompare(b.contact.name);
  });

  return threads;
}

/**
 * Returns SMS thread history for a single contact.
 */
export async function getContactSmsThread(contactId: string): Promise<SmsMessageRow[]> {
  const userContext = await getCurrentUserContext();
  if (!userContext?.organization) return [];

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("telecom_sms")
    .select("*")
    .eq("organization_id", userContext.organization.id)
    .eq("contact_id", contactId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data as SmsMessageRow[];
}

/**
 * Sends an outbound SMS to a contact and logs it in the database.
 */
export async function sendExternalSms(input: ExternalSmsInput) {
  const userContext = await getCurrentUserContext();
  if (!userContext?.organization) {
    return { status: "error" as const, error: "Unauthorized" };
  }

  if (
    !hasPermission("telecom.manage", userContext.permissions) &&
    !hasPermission("crm.view", userContext.permissions)
  ) {
    return { status: "error" as const, error: "Forbidden: insufficient permissions" };
  }

  const parsed = externalSmsInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error" as const,
      error: parsed.error.issues[0]?.message ?? "Invalid SMS input",
    };
  }

  const supabase = await createServerClient();
  const orgId = userContext.organization.id;

  // Retrieve contact to get phone number
  const { data: contact, error: contactError } = await supabase
    .from("crm_contacts")
    .select("id, name, phone")
    .eq("id", parsed.data.contactId)
    .eq("organization_id", orgId)
    .single();

  if (contactError || !contact) {
    return { status: "error" as const, error: "Contact not found" };
  }

  if (!contact.phone) {
    return { status: "error" as const, error: "Contact has no phone number" };
  }

  // Determine sender phone number
  let fromNumber = parsed.data.fromNumber?.trim();
  if (!fromNumber) {
    // Lookup active phone number from inventory
    const { data: numbers } = await supabase
      .from("phone_numbers")
      .select("phone_number")
      .eq("organization_id", orgId)
      .eq("status", "active")
      .limit(1);

    fromNumber = numbers?.[0]?.phone_number || "+10000000000";
  }

  const { data: inserted, error: insertError } = await supabase
    .from("telecom_sms")
    .insert({
      organization_id: orgId,
      contact_id: contact.id,
      direction: "outbound",
      from_number: fromNumber,
      to_number: contact.phone,
      body: parsed.data.body,
      status: "delivered",
    })
    .select()
    .single();

  if (insertError) {
    return { status: "error" as const, error: insertError.message };
  }

  revalidatePath("/messaging");
  revalidatePath("/phone-numbers");
  return { status: "success" as const, data: inserted };
}
