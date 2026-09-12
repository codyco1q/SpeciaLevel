-- ============================================================
-- UpLevel — 00010 User Language Preference
--
-- 1) profiles.preferred_language — the UI language the user chose
--    through the in-app language switch. Persisted so a signed-in
--    user inherits their language from any new browser or device
--    even before the language cookie exists (getLocale() falls back
--    to this column when NEXT_LOCALE is missing).
--
-- The CHECK constraint mirrors the app's supported locales:
-- 'en' (default) and 'ar'. Both the column ADD and the constraint
-- are guarded so the migration is safe to run on any database state.
-- ============================================================

alter table public.profiles
  add column if not exists preferred_language text not null default 'en';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'chk_profiles_preferred_language'
  ) then
    alter table public.profiles
      add constraint chk_profiles_preferred_language
      check (preferred_language in ('en', 'ar'));
  end if;
end
$$;