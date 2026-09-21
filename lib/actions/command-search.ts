"use server";

import { getCurrentUserContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/rbac";
import { createServerClient } from "@/lib/supabase/server";

export interface CommandSearchContact {
  id: string;
  name: string;
  email: string;
  company: string | null;
}

export interface CommandSearchDeal {
  id: string;
  title: string;
  stage: string;
  value: number;
  currency: string;
}

export interface CommandSearchResult {
  contacts: CommandSearchContact[];
  deals: CommandSearchDeal[];
}

/**
 * Live search for contacts and deals across the organization.
 * Requires `crm.view` permission.
 */
export async function searchCommandEntities(
  query: string
): Promise<CommandSearchResult> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return { contacts: [], deals: [] };
  }

  const userContext = await getCurrentUserContext();
  if (!userContext || !userContext.organization) {
    return { contacts: [], deals: [] };
  }

  const organizationId = userContext.organization.id;
  const canViewCrm = hasPermission("crm.view", userContext.permissions);

  if (!canViewCrm) {
    return { contacts: [], deals: [] };
  }

  const supabase = await createServerClient();

  const [contactsRes, dealsRes] = await Promise.all([
    supabase
      .from("crm_contacts")
      .select("id, name, email, company")
      .eq("organization_id", organizationId)
      .or(
        `name.ilike.%${trimmed}%,email.ilike.%${trimmed}%,company.ilike.%${trimmed}%`
      )
      .order("updated_at", { ascending: false })
      .limit(5),
    supabase
      .from("crm_deals")
      .select("id, title, stage, value, currency")
      .eq("organization_id", organizationId)
      .ilike("title", `%${trimmed}%`)
      .order("updated_at", { ascending: false })
      .limit(5),
  ]);

  return {
    contacts: (contactsRes.data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      company: c.company,
    })),
    deals: (dealsRes.data ?? []).map((d) => ({
      id: d.id,
      title: d.title,
      stage: d.stage,
      value: Number(d.value) || 0,
      currency: d.currency || "USD",
    })),
  };
}

/**
 * Retrieves the current user's active booking profile slug if available.
 */
export async function getPersonalBookingSlug(): Promise<string | null> {
  const userContext = await getCurrentUserContext();
  if (!userContext || !userContext.organization) return null;

  const supabase = await createServerClient();
  const { data } = await supabase
    .from("calendar_booking_profiles")
    .select("slug")
    .eq("organization_id", userContext.organization.id)
    .eq("host_user_id", userContext.user.id)
    .maybeSingle();

  return data?.slug ?? null;
}
