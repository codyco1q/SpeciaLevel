-- ============================================================
-- SpeciaLevel — 00050 Multi-Tenant Super Admin Control Panel
-- ============================================================

-- 1. Add platform-level tenant management columns to public.organizations
alter table public.organizations
  add column if not exists status text not null default 'active' check (status in ('active', 'suspended', 'restricted', 'trial')),
  add column if not exists plan_tier text not null default 'pro' check (plan_tier in ('free', 'starter', 'pro', 'enterprise')),
  add column if not exists subscription_status text not null default 'active' check (subscription_status in ('active', 'trialing', 'past_due', 'canceled', 'unpaid')),
  add column if not exists mrr numeric not null default 0,
  add column if not exists feature_flags jsonb not null default '{"api_access": true, "custom_domain": false, "advanced_ai": true, "white_label": false, "telecom_sip": true, "webhooks": true, "social_planner_addon": false}'::jsonb,
  add column if not exists support_notes text,
  add column if not exists suspended_reason text,
  add column if not exists suspended_at timestamptz;

-- 2. Create public.super_admin_audit_logs for impersonation & platform actions
create table if not exists public.super_admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references auth.users(id) on delete set null,
  admin_email text,
  target_organization_id uuid references public.organizations(id) on delete cascade,
  target_organization_name text,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_super_admin_audit_logs_target_org
  on public.super_admin_audit_logs(target_organization_id);

create index if not exists idx_super_admin_audit_logs_created_at
  on public.super_admin_audit_logs(created_at desc);

-- 3. RLS for super_admin_audit_logs
alter table public.super_admin_audit_logs enable row level security;

-- Only service role / owners can view and insert audit logs
create policy "Super admin audit logs are accessible by platform admins"
  on public.super_admin_audit_logs for select
  using (
    public.user_has_organization_role(public.current_organization_id(), 'owner')
    or public.user_has_organization_role(public.current_organization_id(), 'admin')
  );

-- 4. Register super_admin permissions in permissions catalog
insert into public.permissions (organization_id, key, name, description, module)
select o.id, 'super_admin.view', 'View Super Admin', 'Access platform-wide multi-tenant control panel.', 'settings'
from public.organizations o
where not exists (
  select 1 from public.permissions p
  where p.organization_id = o.id and p.key = 'super_admin.view'
);

insert into public.permissions (organization_id, key, name, description, module)
select o.id, 'super_admin.manage', 'Manage Super Admin', 'Manage organizations, billing tiers, and feature flags platform-wide.', 'settings'
from public.organizations o
where not exists (
  select 1 from public.permissions p
  where p.organization_id = o.id and p.key = 'super_admin.manage'
);

-- Grant super_admin permissions to Owner role
insert into public.role_permissions (role_id, permission_id, organization_id)
select r.id, p.id, r.organization_id
from public.roles r
join public.permissions p on p.organization_id = r.organization_id
where r.key = 'owner' and p.key in ('super_admin.view', 'super_admin.manage')
on conflict (role_id, permission_id) do nothing;
