-- ============================================================
-- UpLevel — 00048 Profile Timezone Support
-- ============================================================

alter table public.profiles
  add column if not exists timezone text default 'UTC';

notify pgrst, 'reload schema';
