-- ============================================================
-- UpLevel — 00033 Messaging and Phone Numbers
--
-- Restructuring Phone Numbers (Carrier BYOC & Number Management)
-- and Unified Messaging (External SMS Conversations & Internal Chat).
-- ============================================================

-- ------------------------------------------------------------
-- 1. phone_carrier_settings
-- ------------------------------------------------------------
create table if not exists public.phone_carrier_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  provider text not null default 'twilio' check (provider in ('twilio', 'telnyx', 'custom')),
  account_sid text,
  auth_token_encrypted text,
  api_key_sid text,
  api_key_secret_encrypted text,
  twiml_app_sid text,
  is_active boolean not null default false,
  updated_at timestamptz default now()
);

create index if not exists idx_phone_carrier_settings_org
  on public.phone_carrier_settings(organization_id);

alter table public.phone_carrier_settings enable row level security;

drop policy if exists "carrier_settings_select_policy" on public.phone_carrier_settings;
create policy "carrier_settings_select_policy"
  on public.phone_carrier_settings
  for select
  using (organization_id = public.current_organization_id());

drop policy if exists "carrier_settings_insert_policy" on public.phone_carrier_settings;
create policy "carrier_settings_insert_policy"
  on public.phone_carrier_settings
  for insert
  with check (organization_id = public.current_organization_id());

drop policy if exists "carrier_settings_update_policy" on public.phone_carrier_settings;
create policy "carrier_settings_update_policy"
  on public.phone_carrier_settings
  for update
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

drop policy if exists "carrier_settings_delete_policy" on public.phone_carrier_settings;
create policy "carrier_settings_delete_policy"
  on public.phone_carrier_settings
  for delete
  using (organization_id = public.current_organization_id());

-- ------------------------------------------------------------
-- 2. phone_numbers
-- ------------------------------------------------------------
create table if not exists public.phone_numbers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  phone_number text not null,
  friendly_name text,
  capabilities jsonb not null default '{"voice": true, "sms": true}'::jsonb,
  status text not null default 'active',
  assigned_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists idx_phone_numbers_org
  on public.phone_numbers(organization_id);

create index if not exists idx_phone_numbers_assigned_user
  on public.phone_numbers(assigned_user_id);

alter table public.phone_numbers enable row level security;

drop policy if exists "phone_numbers_select_policy" on public.phone_numbers;
create policy "phone_numbers_select_policy"
  on public.phone_numbers
  for select
  using (organization_id = public.current_organization_id());

drop policy if exists "phone_numbers_insert_policy" on public.phone_numbers;
create policy "phone_numbers_insert_policy"
  on public.phone_numbers
  for insert
  with check (organization_id = public.current_organization_id());

drop policy if exists "phone_numbers_update_policy" on public.phone_numbers;
create policy "phone_numbers_update_policy"
  on public.phone_numbers
  for update
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

drop policy if exists "phone_numbers_delete_policy" on public.phone_numbers;
create policy "phone_numbers_delete_policy"
  on public.phone_numbers
  for delete
  using (organization_id = public.current_organization_id());

-- ------------------------------------------------------------
-- 3. Add telecom_sms to Realtime if possible
-- ------------------------------------------------------------
do $anon$
begin
  begin
    alter publication supabase_realtime add table public.telecom_sms;
  exception
    when duplicate_object then null;
    when others then null;
  end;
end;
$anon$;
