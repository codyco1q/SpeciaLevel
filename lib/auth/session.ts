import { cache } from "react";
import { createServerClient } from "@/lib/supabase/server";
import type {
  Profile,
  Organization,
  Role,
  UserContext,
} from "@/types/database";

/**
 * Fetches the current authenticated user's full context in a single joined query:
 * profile, organization, assigned roles, and the array of permission keys.
 *
 * React's `cache()` dedupes concurrent calls within a single render pass,
 * so every server component in a request shares one fetch.
 *
 * Refetch semantics for mutations (e.g. onboarding): `cache()` is scoped to
 * the current request only. After a server action writes and calls
 * `revalidatePath()` + `redirect("/dashboard")`, the redirect triggers a NEW
 * request — this function runs again with fresh data (completed profile,
 * organization, owner role + permissions), so the sidebar rendered by the
 * dashboard layout is always up to date.
 */
export const getCurrentUserContext = cache(
  async (): Promise<UserContext | null> => {
    try {
      const supabase = await createServerClient();

      // 1. Get the authenticated user's ID from the session.
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return null;
      }

    // 2. Fetch the profile for that user.
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(
        `
          *,
          organization:organizations(*),
          roles:user_roles(
            role_id,
            roles(*)
          )
        `
      )
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      // Anomalous: valid session but no readable profile (e.g. RLS
      // misconfiguration or a missing signup-trigger row). Log the code
      // server-side so a redirect loop like this is diagnosable instead
      // of silently bouncing between /dashboard and /login.
      console.error("[auth] profile fetch failed for authed user:", {
        code: profileError?.code ?? "no-row",
        message: profileError?.message ?? "no profile row",
      });
      return null;
    }

    // 3. Fetch the permission keys for the user's roles in one query.
    const roleIds = profile.roles?.map(
      (ur: { role_id: string }) => ur.role_id
    ) ?? [];

    let permissions: string[] = [];
    if (roleIds.length > 0) {
      const { data: permissionRows } = await supabase
        .from("role_permissions")
        .select(
          `
            permission:permissions(key)
          `
        )
        .in("role_id", roleIds);

      if (permissionRows) {
        permissions = Array.from(
          new Set(
            permissionRows
              .map(
                (
                  row: {
                    permission?:
                      | { key?: string }
                      | { key?: string }[]
                      | null;
                  }
                ) => {
                  const perm = row.permission;
                  // PostgREST may return a single object or an array here.
                  const key = Array.isArray(perm) ? perm[0]?.key : perm?.key;
                  return key;
                }
              )
              .filter((key): key is string => typeof key === "string")
          )
        );
      }
    }

    const organization: Organization | undefined = profile.organization;
    const roles: Role[] = (profile.roles ?? []).map(
      (ur: { roles: Role }) => ur.roles
    );

    return {
      user: {
        id: user.id,
        email: user.email ?? "",
      },
      profile: profile as Profile,
      organization,
      roles,
      permissions,
    };
    } catch {
      // Never throw from here: layouts/pages treat `null` as "signed out"
      // and redirect to /login. A Supabase outage or transient failure
      // should degrade to a login redirect, not a 500 crash.
      return null;
    }
  }
);
