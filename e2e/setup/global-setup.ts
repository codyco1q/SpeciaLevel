import type { SupabaseClient } from "@supabase/supabase-js";

import { serviceRoleClient } from "../helpers/supabase";
import {
  E2E_ORG_NAME,
  E2E_ORG_SLUG,
  E2E_PREFERRED_LANGUAGE,
  E2E_USER_EMAIL,
  E2E_USER_FULL_NAME,
  E2E_USER_PASSWORD,
  SEED_CONTACT_EMAIL,
  SEED_CONTACT_NAME,
  SEED_DEAL_TITLE,
  SEED_DEAL_VALUE,
  SEED_INVOICE_NUMBER,
  SEED_INVOICE_SUBTOTAL,
  SEED_INVOICE_TAX_RATE,
  SEED_INVOICE_TOTAL,
  SEED_NOTE_CONTENT,
  SEED_SECOND_CONTACT_NAME,
} from "./constants";

/**
 * Global setup for the E2E suite — runs once before any spec.
 *
 * Idempotent, and scoped strictly to the E2E organization:
 *
 *   1. Ensure the deterministic E2E auth user exists (confirmed email,
 *      known password) so `auth.setup.ts` can sign in through the real form.
 *   2. Ensure that user has a profile, an organization, and the `owner`
 *      role (owners hold every permission: crm.*, invoicing.*, ai.*…).
 *   3. Wipe the organization's previous fixture data and re-seed a known
 *      CRM contact (deal + note) plus one invoice, so the specs can assert
 *      on exact numbers regardless of how the previous run finished.
 *
 * Nothing outside the E2E organization is ever touched. Invoice rows are
 * deleted first so contact/invoice foreign keys can never surprise us;
 * `marketing_leads` is deliberately left alone (it is not org-scoped and
 * the marketing spec asserts on a run-unique email instead).
 */

const PROFILE_ATTEMPTS = 20;
const PROFILE_RETRY_MS = 250;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureAuthUser(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (error) {
    throw new Error(`[e2e] Could not list auth users: ${error.message}`);
  }

  const existing = data.users.find(
    (user) => user.email?.toLowerCase() === E2E_USER_EMAIL
  );

  if (existing) {
    // Reset the password + confirmation so the credentials in constants.ts
    // are always valid, even if the account was touched manually.
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      existing.id,
      {
        password: E2E_USER_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: E2E_USER_FULL_NAME },
      }
    );
    if (updateError) {
      throw new Error(
        `[e2e] Could not reset the E2E user password: ${updateError.message}`
      );
    }
    return existing.id;
  }

  const { data: created, error: createError } =
    await supabase.auth.admin.createUser({
      email: E2E_USER_EMAIL,
      password: E2E_USER_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: E2E_USER_FULL_NAME },
    });
  if (createError || !created.user) {
    throw new Error(
      `[e2e] Could not create the E2E user: ${
        createError?.message ?? "no user returned"
      }`
    );
  }
  return created.user.id;
}

/** The signup trigger inserts the profile asynchronously — wait for it. */
async function waitForProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<{ id: string; organization_id: string | null }> {
  for (let attempt = 0; attempt < PROFILE_ATTEMPTS; attempt += 1) {
    const { data } = await supabase
      .from("profiles")
      .select("id, organization_id")
      .eq("id", userId)
      .maybeSingle();

    if (data) {
      return data as { id: string; organization_id: string | null };
    }
    await delay(PROFILE_RETRY_MS);
  }

  throw new Error(
    "[e2e] The signup trigger never created a profile row for the E2E user."
  );
}

/**
 * Resolves (or creates) the E2E organization.
 *
 * Note on the explicit `id`: the deployed `seed_organization()` trigger
 * inserts the default `chat_channels` rows with `created_by = new.id`, and
 * `chat_channels.created_by` has a foreign key to `profiles.id`. A freshly
 * generated organization id therefore violates that FK (this is why the
 * app's own onboarding insert fails on this database). Creating the tenant
 * with the E2E user's profile id satisfies the constraint, and nothing in
 * the app relies on an organization id differing from a profile id.
 */
async function ensureOrganization(
  supabase: SupabaseClient,
  userId: string,
  currentOrganizationId: string | null
): Promise<string> {
  if (currentOrganizationId) return currentOrganizationId;

  // Already provisioned by an earlier run?
  const { data: existing } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (!existing) {
    let inserted = false;

    for (let attempt = 0; attempt < 3 && !inserted; attempt += 1) {
      // The slug is unique; retry with a random suffix when it is taken.
      const slug =
        attempt === 0
          ? E2E_ORG_SLUG
          : `${E2E_ORG_SLUG}-${Math.random().toString(36).slice(2, 8)}`;

      const { error } = await supabase
        .from("organizations")
        .insert({ id: userId, name: E2E_ORG_NAME, slug })
        .select("id")
        .single();

      if (!error) {
        inserted = true;
        break;
      }
      if (error.code !== "23505") {
        throw new Error(
          `[e2e] Could not create the E2E organization: ${error.message}`
        );
      }
    }

    if (!inserted) {
      throw new Error(
        "[e2e] Could not claim a unique slug for the E2E organization."
      );
    }
  }

  const { error: linkError } = await supabase
    .from("profiles")
    .update({ organization_id: userId })
    .eq("id", userId);
  if (linkError) {
    throw new Error(
      `[e2e] Could not link the E2E profile to its organization: ${linkError.message}`
    );
  }

  return userId;
}

async function ensureOwnerRole(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string
): Promise<void> {
  const { data: role, error } = await supabase
    .from("roles")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("key", "owner")
    .maybeSingle();

  if (error) {
    throw new Error(`[e2e] Could not read the owner role: ${error.message}`);
  }
  if (!role) {
    throw new Error(
      "[e2e] The owner role is missing — has the 00002 role matrix migration " +
        "been applied to this database?"
    );
  }

  const { error: assignError } = await supabase.from("user_roles").upsert(
    {
      user_id: userId,
      role_id: (role as { id: string }).id,
      organization_id: organizationId,
    },
    { onConflict: "user_id,role_id" }
  );
  if (assignError) {
    throw new Error(
      `[e2e] Could not assign the owner role to the E2E user: ${assignError.message}`
    );
  }
}
/** Removes the E2E organization's previous fixture data (rerun-safe). */
async function purgeFixtures(
  supabase: SupabaseClient,
  organizationId: string
): Promise<void> {
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id")
    .eq("organization_id", organizationId);

  const invoiceIds = ((invoices ?? []) as { id: string }[]).map((row) => row.id);
  if (invoiceIds.length > 0) {
    await supabase.from("invoice_items").delete().in("invoice_id", invoiceIds);
  }

  await supabase.from("invoices").delete().eq("organization_id", organizationId);
  await supabase
    .from("crm_contact_notes")
    .delete()
    .eq("organization_id", organizationId);
  await supabase.from("crm_deals").delete().eq("organization_id", organizationId);
  await supabase
    .from("crm_contacts")
    .delete()
    .eq("organization_id", organizationId);
  await supabase
    .from("ai_executions")
    .delete()
    .eq("organization_id", organizationId);
  await supabase.from("ai_prompts").delete().eq("organization_id", organizationId);
}

async function seedFixtures(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string
): Promise<void> {
  const { data: primary, error: primaryError } = await supabase
    .from("crm_contacts")
    .insert({
      organization_id: organizationId,
      name: SEED_CONTACT_NAME,
      email: SEED_CONTACT_EMAIL,
      company: SEED_CONTACT_NAME,
      title: "COO",
      phone: "+1 555 010 0101",
      address: "Riyadh, Saudi Arabia",
      tags: ["retail", "warehouse"],
      notes: "Prefers morning calls.",
      created_by: userId,
    })
    .select("id")
    .single();

  if (primaryError || !primary) {
    throw new Error(
      `[e2e] Could not seed the primary CRM contact: ${
        primaryError?.message ?? "no row returned"
      }`
    );
  }
  const primaryId = (primary as { id: string }).id;

  const { error: secondError } = await supabase.from("crm_contacts").insert({
    organization_id: organizationId,
    name: SEED_SECOND_CONTACT_NAME,
    email: "ops@globex.test",
    company: SEED_SECOND_CONTACT_NAME,
    created_by: userId,
  });
  if (secondError) {
    throw new Error(
      `[e2e] Could not seed the second CRM contact: ${secondError.message}`
    );
  }

  const { error: dealError } = await supabase.from("crm_deals").insert({
    organization_id: organizationId,
    contact_id: primaryId,
    title: SEED_DEAL_TITLE,
    value: SEED_DEAL_VALUE,
    currency: "USD",
    stage: "proposal",
    notes: "Nearing signature.",
    created_by: userId,
  });
  if (dealError) {
    throw new Error(`[e2e] Could not seed the CRM deal: ${dealError.message}`);
  }

  const { error: noteError } = await supabase.from("crm_contact_notes").insert({
    organization_id: organizationId,
    contact_id: primaryId,
    content: SEED_NOTE_CONTENT,
    author_id: userId,
  });
  if (noteError) {
    throw new Error(`[e2e] Could not seed the contact note: ${noteError.message}`);
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      organization_id: organizationId,
      invoice_number: SEED_INVOICE_NUMBER,
      contact_id: primaryId,
      status: "sent",
      currency: "USD",
      subtotal: SEED_INVOICE_SUBTOTAL,
      tax_rate: SEED_INVOICE_TAX_RATE,
      tax_amount: SEED_INVOICE_TOTAL - SEED_INVOICE_SUBTOTAL,
      total: SEED_INVOICE_TOTAL,
      due_date: "2026-10-31",
      notes: "Net 15 terms.",
      created_by: userId,
    })
    .select("id")
    .single();

  if (invoiceError || !invoice) {
    throw new Error(
      `[e2e] Could not seed the invoice: ${
        invoiceError?.message ?? "no row returned"
      }`
    );
  }

  const { error: itemError } = await supabase.from("invoice_items").insert({
    invoice_id: (invoice as { id: string }).id,
    description: "Consulting — process audit",
    quantity: 10,
    unit_price: 100,
    amount: 1_000,
  });
  if (itemError) {
    throw new Error(
      `[e2e] Could not seed the invoice line item: ${itemError.message}`
    );
  }
}

export default async function globalSetup(): Promise<void> {
  const supabase = serviceRoleClient();

  const userId = await ensureAuthUser(supabase);
  const profile = await waitForProfile(supabase, userId);
  const organizationId = await ensureOrganization(
    supabase,
    userId,
    profile.organization_id
  );

  await ensureOwnerRole(supabase, userId, organizationId);

  // Pin English + the display name so locale-dependent assertions are stable.
  await supabase
    .from("profiles")
    .update({
      full_name: E2E_USER_FULL_NAME,
      email: E2E_USER_EMAIL,
      preferred_language: E2E_PREFERRED_LANGUAGE,
    })
    .eq("id", userId);

  await purgeFixtures(supabase, organizationId);
  await seedFixtures(supabase, organizationId, userId);

  console.log(
    `[e2e] ready · user=${E2E_USER_EMAIL} · organization=${organizationId}`
  );
}


