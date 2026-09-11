-- ============================================================
-- UpLevel — 00007 Organization Settings & Member Invitations
--
-- 1) organizations.timezone — the company timezone, used later by
--    time-tracking calculations. Defaults to 'UTC' so existing
--    rows and new organizations always have a valid value.
--
-- 2) organization_invitations — pending/revoked/expired member
--    invites, each with a secure unique token that backs
--    /signup?invite=[token] invite links.
--
-- The invite link ACCEPTANCE flow (claiming an invite during
-- signup / onboarding) is a later milestone. This migration only
-- covers the management side + tenant-scoped RLS.
-- ============================================================

-- ------------------------------------------------------------
-- 1. organizations.timezone
-- ------------------------------------------------------------
alter table public.organizations
  add column if not exists timezone text not null default 'UTC';

-- ------------------------------------------------------------
-- 2. organization_invitations
-- ------------------------------------------------------------
create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  email text not null,
  role_id uuid not null,
  department_id uuid,
  invited_by uuid,
  token text not null unique,
  status text not null default 'pending',
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now(),
  constraint fk_organization_invitations_organization
    foreign key (organization_id) references public.organizations(id) on delete cascade,
  constraint fk_organization_invitations_role
    foreign key (role_id) references public.roles(id) on delete cascade,
  constraint fk_organization_invitations_department
    foreign key (department_id) references public.departments(id) on delete set null,
  constraint fk_organization_invitations_invited_by
    foreign key (invited_by) references public.profiles(id) on delete set null,
  constraint chk_organization_invitations_status
    check (status in ('pending', 'accepted', 'revoked', 'expired'))
);

create index if not exists idx_organization_invitations_organization_id
  on public.organization_invitations(organization_id);

create index if not exists idx_organization_invitations_email
  on public.organization_invitations(email);

create index if not exists idx_organization_invitations_status
  on public.organization_invitations(status);

-- ------------------------------------------------------------
-- 3. RLS — invitations are tenant-scoped like every other table.
--    Members may only see/manage invites inside their active
--    organization.
-- ------------------------------------------------------------
alter table public.organization_invitations enable row level security;

create policy "User can view invitations in their organization"
  on public.organization_invitations for select
  using (organization_id = public.current_organization_id());

create policy "User can insert invitations in their organization"
  on public.organization_invitations for insert
  with check (organization_id = public.current_organization_id());

create policy "User can update invitations in their organization"
  on public.organization_invitations for update
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

create policy "User can delete invitations in their organization"
  on public.organization_invitations for delete
  using (organization_id = public.current_organization_id());

-- 00001 granted privileges on tables that existed at the time;
-- tables created by later migrations must be granted explicitly.
-- (No anon grant: invite tokens must never be readable by anon.)
grant all on table public.organization_invitations to authenticated;