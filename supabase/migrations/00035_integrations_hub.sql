-- ============================================================
-- Migration 00035: Integrations Hub for Payment Gateways & Social Channels
-- ============================================================

-- ------------------------------------------------------------
-- 1. Create organization_integrations table
-- ------------------------------------------------------------
create table if not exists public.organization_integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  category text not null check (category in ('payment', 'social', 'telecom')),
  status text not null default 'disconnected' check (status in ('connected', 'disconnected', 'error')),
  credentials_encrypted jsonb not null default '{}'::jsonb,
  config jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_org_integrations_provider unique (organization_id, provider)
);

-- Indexes for efficient lookups by org and category
create index if not exists idx_org_integrations_org_cat
  on public.organization_integrations(organization_id, category);

create index if not exists idx_org_integrations_org_prov
  on public.organization_integrations(organization_id, provider);

-- ------------------------------------------------------------
-- 2. Row Level Security Policies
-- ------------------------------------------------------------
alter table public.organization_integrations enable row level security;

drop policy if exists "org_integrations_select_policy" on public.organization_integrations;
create policy "org_integrations_select_policy"
  on public.organization_integrations
  for select
  using (organization_id = public.current_organization_id());

drop policy if exists "org_integrations_insert_policy" on public.organization_integrations;
create policy "org_integrations_insert_policy"
  on public.organization_integrations
  for insert
  with check (organization_id = public.current_organization_id());

drop policy if exists "org_integrations_update_policy" on public.organization_integrations;
create policy "org_integrations_update_policy"
  on public.organization_integrations
  for update
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

drop policy if exists "org_integrations_delete_policy" on public.organization_integrations;
create policy "org_integrations_delete_policy"
  on public.organization_integrations
  for delete
  using (organization_id = public.current_organization_id());

-- ------------------------------------------------------------
-- 3. Automatic updated_at Trigger
-- ------------------------------------------------------------
drop trigger if exists trigger_set_updated_at_org_integrations on public.organization_integrations;
create trigger trigger_set_updated_at_org_integrations
  before update on public.organization_integrations
  for each row execute procedure public.set_updated_at();

-- ------------------------------------------------------------
-- 4. Register Integrations Module in organization_modules
-- ------------------------------------------------------------
insert into public.organization_modules (organization_id, module_key, module_name, is_enabled)
select o.id, 'integrations', 'Integrations Hub', true
from public.organizations o
where not exists (
  select 1 from public.organization_modules m
  where m.organization_id = o.id and m.module_key = 'integrations'
);
