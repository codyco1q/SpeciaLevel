-- ============================================================
-- UpLevel — 00004 Fix RLS infinite recursion (stack depth exceeded)
--
-- ROOT CAUSE OF THE POST-LOGIN REDIRECT LOOP:
-- `public.current_organization_id()` ran as the INVOKER, so its inner
-- `select ... from public.profiles` was itself subject to RLS. Every
-- RLS policy in the schema calls this function, so evaluating any
-- policy re-entered the function, which re-queried profiles, which
-- re-evaluated policies... infinite recursion until Postgres aborted
-- with `54001 stack depth limit exceeded`.
--
-- Effect in the app: `proxy.ts` (`auth.getUser()`, no DB involved)
-- saw a valid session and sent the user to /dashboard, but every
-- server-side profile/permission query 500'd, so
-- `getCurrentUserContext()` returned null and the dashboard layout
-- bounced back to /login — an infinite /dashboard <-> /login loop
-- (ERR_TOO_MANY_REDIRECTS).
--
-- FIX: run the helper as SECURITY DEFINER (function owner bypasses
-- RLS on the inner lookup), with a locked search_path, matching the
-- other helper functions in 00001 (handle_new_user, seed_organization).
-- The function only ever returns the CALLER's own organization_id
-- (filtered by auth.uid()), so anon callers still get NULL and no
-- data leaks across tenants.
-- ============================================================

create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id
  from public.profiles
  where id = auth.uid()
$$;

-- Keep the execute grant for the app roles (anon gets NULL since it
-- has no auth.uid(); authenticated gets its own org id only).
grant execute on function public.current_organization_id() to anon, authenticated;
