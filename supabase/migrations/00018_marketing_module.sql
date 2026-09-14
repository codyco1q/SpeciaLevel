-- ============================================================
-- UpLevel — 00018 Marketing module
--
-- Adds the Marketing app: campaign planning with channel/status
-- state, budget vs. spend tracking, and per-campaign content
-- assets.
--
--   marketing_campaigns  — the campaign definitions
--   marketing_assets     — copy/graphic/video/landing-page assets
--                          attached to a campaign
--
-- Security mirrors the rest of the platform: tenant-scoped RLS,
-- the "marketing.view" / "marketing.manage" catalog permissions,
-- and role grants (Owner/Admin/Manager = both, Employee = view,
-- Client = none). Budget and spend are NUMERIC(12,2) and validated
-- non-negative so the metrics never render misleading data.
-- ============================================================

-- ------------------------------------------------------------
-- 1. marketing_campaigns
-- ------------------------------------------------------------
create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  name text not null,
  description text,
  channel text not null,
  status text not null default 'draft',
  budget numeric(12, 2) not null default 0,
  spend numeric(12, 2) not null default 0,
  start_date date,
  end_date date,
  target_audience text,
  utm_campaign text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_marketing_campaigns_organization
    foreign key (organization_id) references public.organizations(id) on delete cascade,
  constraint fk_marketing_campaigns_created_by
    foreign key (created_by) references public.profiles(id),
  constraint chk_marketing_campaigns_name_not_blank
    check (btrim(name) <> ''),
  constraint chk_marketing_campaigns_channel
    check (channel in ('meta', 'google', 'email', 'content', 'linkedin', 'other')),
  constraint chk_marketing_campaigns_status
    check (status in ('draft', 'active', 'paused', 'completed')),
  constraint chk_marketing_campaigns_budget_non_negative
    check (budget >= 0),
  constraint chk_marketing_campaigns_spend_non_negative
    check (spend >= 0),
  constraint chk_marketing_campaigns_date_range
    check (end_date is null or start_date is null or end_date >= start_date)
);

create index if not exists idx_marketing_campaigns_organization
  on public.marketing_campaigns(organization_id);

-- Fast lookup for the campaigns table status filter.
create index if not exists idx_marketing_campaigns_status
  on public.marketing_campaigns(organization_id, status);

-- ------------------------------------------------------------
-- 2. marketing_assets
-- ------------------------------------------------------------
create table if not exists public.marketing_assets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null,
  organization_id uuid not null,
  title text not null,
  asset_type text not null,
  content text,
  storage_path text,
  created_at timestamptz not null default now(),
  constraint fk_marketing_assets_campaign
    foreign key (campaign_id) references public.marketing_campaigns(id) on delete cascade,
  constraint fk_marketing_assets_organization
    foreign key (organization_id) references public.organizations(id) on delete cascade,
  constraint chk_marketing_assets_title_not_blank
    check (btrim(title) <> ''),
  constraint chk_marketing_assets_asset_type
    check (asset_type in ('copy', 'graphic', 'video', 'landing_page'))
);

create index if not exists idx_marketing_assets_campaign
  on public.marketing_assets(campaign_id, created_at desc);

create index if not exists idx_marketing_assets_organization
  on public.marketing_assets(organization_id, created_at desc);

-- ------------------------------------------------------------
-- 3. RLS - tenant-scoped CRUD exactly like every other module.
--    created_by is pinned to the caller and the organization is
--    always resolved from the session (never from the payload),
--    mirroring the invoicing/chat security model.
-- ------------------------------------------------------------
alter table public.marketing_campaigns enable row level security;
alter table public.marketing_assets enable row level security;

-- marketing_campaigns - tenant-scoped CRUD.
create policy "Users can view marketing campaigns in their organization"
  on public.marketing_campaigns for select
  using (organization_id = public.current_organization_id());

create policy "Users can create marketing campaigns in their organization"
  on public.marketing_campaigns for insert
  with check (
    organization_id = public.current_organization_id()
    and created_by = auth.uid()
  );

create policy "Users can update marketing campaigns in their organization"
  on public.marketing_campaigns for update
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

create policy "Users can delete marketing campaigns in their organization"
  on public.marketing_campaigns for delete
  using (organization_id = public.current_organization_id());

-- marketing_assets - tenant-scoped. The organization column mirrors
-- the parent campaign's tenant so the delete cascade never leaks rows.
create policy "Users can view marketing assets in their organization"
  on public.marketing_assets for select
  using (organization_id = public.current_organization_id());

create policy "Users can create marketing assets in their organization"
  on public.marketing_assets for insert
  with check (organization_id = public.current_organization_id());

create policy "Users can update marketing assets in their organization"
  on public.marketing_assets for update
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

create policy "Users can delete marketing assets in their organization"
  on public.marketing_assets for delete
  using (organization_id = public.current_organization_id());

-- ------------------------------------------------------------
-- 4. Grants
--    00001 granted privileges on tables that existed at the time;
--    tables created by later migrations must be granted
--    explicitly. Marketing data is private org data (no anon grant).
-- ------------------------------------------------------------
grant all on table public.marketing_campaigns to authenticated;
grant all on table public.marketing_assets to authenticated;

-- ------------------------------------------------------------
-- 5. Keep updated_at current on marketing_campaigns
-- ------------------------------------------------------------
create trigger trigger_set_updated_at_marketing_campaigns
  before update on public.marketing_campaigns
  for each row execute procedure public.set_updated_at();

-- ------------------------------------------------------------
-- 6. Replace seed_organization() so NEW organizations get the
--    Marketing module, its permissions, and role grants on
--    creation. (Full superset of the 00017 version + marketing
--    additions. role_permissions rows always carry the new
--    organization_id explicitly.)
-- ------------------------------------------------------------
create or replace function public.seed_organization()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Base roles
  insert into public.roles (organization_id, name, key, description, is_system) values
    (new.id, 'Owner', 'owner', 'Full control over the organization.', true),
    (new.id, 'Admin', 'admin', 'Administrative access to most features.', true),
    (new.id, 'Manager', 'manager', 'Manages a team or department.', true),
    (new.id, 'Employee', 'employee', 'Standard employee access.', true),
    (new.id, 'Client', 'client', 'Client portal access with scoped project views.', true);

  -- Default modules
  insert into public.organization_modules (organization_id, module_key, module_name, is_enabled) values
    (new.id, 'dashboard', 'Dashboard', true),
    (new.id, 'calendar', 'Calendar', true),
    (new.id, 'time', 'Time Tracking', true),
    (new.id, 'employees', 'Employees', true),
    (new.id, 'departments', 'Departments', true),
    (new.id, 'roles', 'Roles & Permissions', true),
    (new.id, 'tasks', 'Tasks', true),
    (new.id, 'chat', 'Chat', true),
    (new.id, 'crm', 'CRM', true),
    (new.id, 'invoicing', 'Invoicing & Billing', true),
    (new.id, 'automations', 'Automations', true),
    (new.id, 'analytics', 'Analytics & BI', true),
    (new.id, 'ai', 'AI & Agents', true),
    (new.id, 'marketing', 'Marketing', true);

  -- Default permissions
  insert into public.permissions (organization_id, key, name, description, module) values
    (new.id, 'dashboard.view', 'View Dashboard', 'View the main dashboard.', 'dashboard'),

    (new.id, 'calendar.view', 'View Calendar', 'View calendar events.', 'calendar'),
    (new.id, 'calendar.create', 'Create Calendar Events', 'Create calendar events.', 'calendar'),
    (new.id, 'calendar.edit', 'Edit Calendar Events', 'Edit calendar events.', 'calendar'),
    (new.id, 'calendar.delete', 'Delete Calendar Events', 'Delete calendar events.', 'calendar'),

    (new.id, 'time.view', 'View Time Entries', 'View time entries.', 'time'),
    (new.id, 'time.clock_in', 'Clock In', 'Start a time entry.', 'time'),
    (new.id, 'time.clock_out', 'Clock Out', 'Stop a time entry.', 'time'),

    (new.id, 'employees.view', 'View Employees', 'View employee profiles.', 'employees'),
    (new.id, 'employees.manage', 'Manage Employees', 'Create, edit, and deactivate employees.', 'employees'),

    (new.id, 'departments.view', 'View Departments', 'View departments.', 'departments'),
    (new.id, 'departments.manage', 'Manage Departments', 'Create, edit, and delete departments.', 'departments'),

    (new.id, 'roles.view', 'View Roles', 'View roles and their permissions.', 'roles'),
    (new.id, 'roles.manage', 'Manage Roles', 'Create, edit, and delete roles.', 'roles'),

    (new.id, 'settings.view', 'View Settings', 'View organization settings.', 'settings'),
    (new.id, 'settings.manage', 'Manage Settings', 'Update organization settings.', 'settings'),

    (new.id, 'tasks.view', 'View Tasks', 'View project tasks.', 'tasks'),
    (new.id, 'tasks.manage', 'Manage Tasks', 'Create, edit, and delete tasks.', 'tasks'),

    (new.id, 'chat.view', 'View Chat', 'View workspace chat channels.', 'chat'),
    (new.id, 'chat.manage', 'Manage Chat', 'Create channels and post messages.', 'chat'),

    (new.id, 'crm.view', 'View CRM', 'View leads, contacts, and deals.', 'crm'),
    (new.id, 'crm.manage', 'Manage CRM', 'Create, edit, and delete CRM records.', 'crm'),

    (new.id, 'invoicing.view', 'View Invoices', 'View invoices and payments.', 'invoicing'),
    (new.id, 'invoicing.manage', 'Manage Invoices', 'Create, edit, and delete invoices.', 'invoicing'),

    (new.id, 'automations.view', 'View Automations', 'View automation workflows and logs.', 'automations'),
    (new.id, 'automations.manage', 'Manage Automations', 'Create, edit, and delete automations.', 'automations'),

    (new.id, 'analytics.view', 'View Analytics', 'View dashboards and reports.', 'analytics'),
    (new.id, 'analytics.manage', 'Manage Analytics', 'Export and configure analytics dashboards.', 'analytics'),

    (new.id, 'ai.view', 'View AI', 'Run AI prompts and view execution history.', 'ai'),
    (new.id, 'ai.manage', 'Manage AI', 'Create, edit, and delete AI prompt templates.', 'ai'),

    (new.id, 'marketing.view', 'View Marketing', 'View marketing campaigns and assets.', 'marketing'),
    (new.id, 'marketing.manage', 'Manage Marketing', 'Create, edit, and delete marketing campaigns.', 'marketing'),

    (new.id, 'portal.client', 'Client Portal', 'Access the client portal with scoped project views.', 'portal');
  -- Grayed-out permissions reference only rows that exist — by insert
  -- they are all present above, so a strict materialized lookup is safe.
  -- Role matrix: Owner gets everything latest, Admin misses only
  -- roles.manage / settings.manage, Manager covers tactical ops
  -- (incl. Marketing campaign management), Employee covers daily work
  -- (incl. Marketing view), Client stays portal-scoped.
  insert into public.role_permissions (role_id, permission_id, organization_id)
  select r.id, p.id, new.id
  from public.roles r
  cross join public.permissions p
  where r.organization_id = new.id and p.organization_id = new.id
    and (
      (r.key = 'owner')
      or (r.key = 'admin' and p.key not in ('roles.manage', 'settings.manage'))
      or (r.key = 'manager' and p.key in (
        'dashboard.view',
        'calendar.view', 'calendar.create',
        'time.view', 'time.clock_in', 'time.clock_out',
        'employees.view', 'employees.manage',
        'departments.view',
        'tasks.view', 'tasks.manage',
        'chat.view', 'chat.manage',
        'crm.view', 'crm.manage',
        'invoicing.view', 'invoicing.manage',
        'automations.view', 'automations.manage',
        'analytics.view',
        'ai.view', 'ai.manage',
        'marketing.view', 'marketing.manage'
      ))
      or (r.key = 'employee' and p.key in (
        'dashboard.view',
        'calendar.view',
        'time.view', 'time.clock_in', 'time.clock_out',
        'tasks.view',
        'chat.view',
        'crm.view',
        'invoicing.view',
        'automations.view',
        'analytics.view',
        'ai.view',
        'marketing.view'
      ))
      or (r.key = 'client' and p.key in (
        'portal.client',
        'tasks.view',
        'chat.view',
        'invoicing.view'
      ))
    );

  -- Default global chat channels.
  insert into public.chat_channels (organization_id, name, description, created_by) values
    (new.id, 'general', 'Company-wide announcements and general discussion.', new.id),
    (new.id, 'project-xyz', 'Collaboration channel for Project XYZ.', new.id);

  return new;
end;
$$;
-- ------------------------------------------------------------
-- 7. Backfill EXISTING organizations. Idempotent — each block is
--    keyed on natural keys (permission key, module key, role_permissions
--    pair), so re-running this migration never duplicates rows.
-- ------------------------------------------------------------

-- 7a. marketing.view / marketing.manage for every organization.
insert into public.permissions (organization_id, key, name, description, module)
select o.id, 'marketing.view', 'View Marketing', 'View marketing campaigns and assets.', 'marketing'
from public.organizations o
where not exists (
  select 1 from public.permissions p
  where p.organization_id = o.id and p.key = 'marketing.view'
);

insert into public.permissions (organization_id, key, name, description, module)
select o.id, 'marketing.manage', 'Manage Marketing', 'Create, edit, and delete marketing campaigns.', 'marketing'
from public.organizations o
where not exists (
  select 1 from public.permissions p
  where p.organization_id = o.id and p.key = 'marketing.manage'
);

-- 7b. Enable the Marketing module for every existing organization.
insert into public.organization_modules (organization_id, module_key, module_name, is_enabled)
select o.id, 'marketing', 'Marketing', true
from public.organizations o
where not exists (
  select 1 from public.organization_modules m
  where m.organization_id = o.id and m.module_key = 'marketing'
);

update public.organization_modules m
set is_enabled = true
from public.organizations o
where o.id = m.organization_id and m.module_key = 'marketing' and not m.is_enabled;

-- 7c. Grant matrix: Owner and Admin get both Marketing permissions (the
--     owner/"everything" & admin "all-but-two" grants are maintained
--     declaratively for new orgs; here we materialize the same caps),
--     Manager gets marketing.view + marketing.manage, Employee gets
--     marketing.view only. organization_id is written explicitly so the
--     NOT NULL column is always populated.
insert into public.role_permissions (role_id, permission_id, organization_id)
select r.id, p.id, r.organization_id
from public.roles r
inner join public.permissions p
  on p.organization_id = r.organization_id
 and p.key in ('marketing.view', 'marketing.manage')
where r.key in ('owner', 'admin', 'manager')
  and not exists (
    select 1 from public.role_permissions rp
    where rp.role_id = r.id and rp.permission_id = p.id
  );

insert into public.role_permissions (role_id, permission_id, organization_id)
select r.id, p.id, r.organization_id
from public.roles r
inner join public.permissions p
  on p.organization_id = r.organization_id and p.key = 'marketing.view'
where r.key = 'employee'
  and not exists (
    select 1 from public.role_permissions rp
    where rp.role_id = r.id and rp.permission_id = p.id
  );