"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";
import {
  onboardingSchema,
  type OnboardingState,
} from "@/lib/validations/onboarding";

/**
 * Creates the user's first organization and wires them into it:
 *
 *   1. Insert the organization (service role — bypasses RLS, since the
 *      `organizations` table intentionally has no INSERT policy and the
 *      self-serve profile update would fail its WITH CHECK for a user
 *      with no organization yet).
 *   2. Set profile.organization_id to the new organization.
 *   3. Assign the seeded `owner` role via user_roles.
 *   4. Revalidate + redirect to /dashboard so the next request fetches
 *      fresh session context (org + owner permissions) for the sidebar.
 *
 * The user's identity is verified with the cookie-based client first, so
 * the service-role write is always scoped to the authenticated user.
 */

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return base || "organization";
}

function randomSuffix(length = 6): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export async function createOrganization(
  _prevState: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  // 1. Validate input (client passes the same form; re-validate server-side).
  const rawOrganizationName = formData.get("organizationName");
  const parsed = onboardingSchema.safeParse({
    organizationName: typeof rawOrganizationName === "string" ? rawOrganizationName : "",
  });

  if (!parsed.success) {
    // Build an object keyed by field name; cast to the narrow per-field type.
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string") {
        (fieldErrors[key] ??= []).push(issue.message);
      }
    }
    return {
      status: "error",
      error: null,
      fieldErrors: fieldErrors as OnboardingState["fieldErrors"],
    };
  }

  const { organizationName } = parsed.data;

  // 2. Verify the caller is authenticated via the cookie session.
  const userClient = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  // Only onboard users who don't already belong to an organization.
  const { data: profile } = await userClient
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.organization_id) {
    redirect("/dashboard");
  }

  // 3. Service-role write path (RLS bypass; server-only module).
  const admin = createServiceRoleClient();

  // The slug column is NOT NULL + UNIQUE; retry with a random suffix if
  // the human-readable slug is already taken (PostgREST error code 23505).
  const baseSlug = slugify(organizationName);
  let organizationId: string | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${randomSuffix()}`;
    const { data, error } = await admin
      .from("organizations")
      .insert({ name: organizationName, slug })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505" && attempt < 2) {
        continue; // slug collision — try again with a suffix
      }
      return {
        status: "error",
        error: "Could not create your organization right now. Please try again.",
      };
    }
    organizationId = data.id;
    break;
  }

  if (!organizationId) {
    return {
      status: "error",
      error: "Could not create your organization right now. Please try again.",
    };
  }

  // 4. Link the creator's profile to the new organization.
  const { error: profileError } = await admin
    .from("profiles")
    .update({ organization_id: organizationId })
    .eq("id", user.id);

  if (profileError) {
    return {
      status: "error",
      error: "Your organization was created but your profile could not be linked. Please try again.",
    };
  }

  // 5. Assign the Owner role (seeded by the on_organization_created trigger).
  const { data: ownerRole } = await admin
    .from("roles")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("key", "owner")
    .maybeSingle();

  if (ownerRole) {
    const { error: roleError } = await admin.from("user_roles").insert({
      user_id: user.id,
      role_id: ownerRole.id,
      organization_id: organizationId,
    });

    if (roleError) {
      return {
        status: "error",
        error: "Your organization was created but the owner role could not be assigned. Please try again.",
      };
    }
  }

  // 5b. Seed the default #general channel. `chat_channels.created_by` is
  // NOT NULL and no profiles exist when the seed_organization() trigger
  // fires, so brand-new organizations get their channel here (the creator
  // is the user who just onboarded). Idempotent via the
  // (organization_id, name) unique constraint.
  const { error: channelError } = await admin
    .from("chat_channels")
    .upsert(
      {
        organization_id: organizationId,
        name: "general",
        description: "General discussion for your team.",
        created_by: user.id,
      },
      { onConflict: "organization_id,name", ignoreDuplicates: true }
    );

  if (channelError) {
    return {
      status: "error",
      error: "Your organization was created but the default channel could not be set up. Please try again.",
    };
  }

  // 6. Bust cached route data so the redirect to /dashboard renders with a
  //    fresh user context (organization, roles, permissions) — the sidebar
  //    shows the org name and full owner permission set.
  revalidatePath("/dashboard", "layout");
  revalidatePath("/", "layout");

  redirect("/dashboard");
}