-- ============================================================
-- UpLevel — 00019 Telecommunications module
--
-- Adds the Telecom app: a call log (inbound/outbound with
-- outcome + duration + optional recording) and an SMS history
-- table (sent/delivered/failed/received), both linked to CRM
-- contacts so call and messaging activity stays attributable.
--
-- Security mirrors the rest of the platform: tenant-scoped RLS,
-- the "telecom.view" / "telecom.manage" catalog permissions, and
-- role grants (Owner/Admin/Manager = both, Employee = view,
-- Client = none). The organization_modules row uses the
-- 'telecommunications' key (the modules-grid identifier) while
-- the permissions carry module = 'telecom'.
-- ============================================================

-- ------------------------------------------------------------
-- 1. telecom_calls
-- ------------------------------------------------------------
create table if not exists public.telecom_calls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  contact_id uuid,
  direction text not null,
  status text not null default 'completed',
  from_number text not null,
  to_number text not null,
  duration_seconds integer not null default 0,
  recording_url text,
  summary text,
  agent_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_telecom_calls_organization
    foreign key (organization_id) references public.organizations(id) on delete cascade,
  constraint fk_telecom_calls_contact
    foreign key (contact_id) references public.crm_contacts(id) on delete set null,
  constraint fk_telecom_calls_agent
    foreign key (agent_id) references public.profiles(id) on delete set null,
  constraint chk_telecom_calls_direction
    check (direction in ('inbound', 'outbound')),
  constraint chk_telecom_calls_status
    check (status in ('completed', 'missed', 'busy', 'failed', 'voicemail')),
  constraint chk_telecom_calls_duration_non_negative
    check (duration_seconds >= 0),
  constraint chk_telecom_calls_from_number_not_blank
    check (btrim(from_number) <> ''),
  constraint chk_telecom_calls_to_number_not_blank
    check (btrim(to_number) <> '')
);

create index if not exists idx_telecom_calls_organization
  on public.telecom_calls(organization_id);

-- Fast lookup for the calls table (direction filter + recent first).
create index if not exists idx_telecom_calls_organization_direction
  on public.telecom_calls(organization_id, direction, created_at desc);

create index if not exists idx_telecom_calls_contact
  on public.telecom_calls(contact_id, created_at desc);

-- ------------------------------------------------------------
-- 2. telecom_sms
-- ------------------------------------------------------------
create table if not exists public.telecom_sms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  contact_id uuid,
  direction text not null,
  from_number text not null,
  to_number text not null,
  body text not null,
  status text not null default 'delivered',
  created_at timestamptz not null default now(),
  constraint fk_telecom_sms_organization
    foreign key (organization_id) references public.organizations(id) on delete cascade,
  constraint fk_telecom_sms_contact
    foreign key (contact_id) references public.crm_contacts(id) on delete set null,
  constraint chk_telecom_sms_direction
    check (direction in ('inbound', 'outbound')),
  constraint chk_telecom_sms_status
    check (status in ('sent', 'delivered', 'failed', 'received')),
  constraint chk_telecom_sms_from_number_not_blank
    check (btrim(from_number) <> ''),
  constraint chk_telecom_sms_to_number_not_blank
    check (btrim(to_number) <> ''),
  constraint chk_telecom_sms_body_not_blank
    check (btrim(body) <> '')
);
-- ------------------------------------------------------------
-- 3. RLS - tenant-scoped CRUD exactly like every other module.
--    The organization is always resolved from the session via
--    current_organization_id(); contacts and agents live in the
--    same tenant so the joins never leak rows.
-- ------------------------------------------------------------
alter table public.telecom_calls enable row level security;
alter table public.telecom_sms enable row level security;

-- telecom_calls
create policy "Users can view telecom calls in their organization"
  on public.telecom_calls for select
  using (organization_id = public.current_organization_id());

create policy "Users can create telecom calls in their organization"
  on public.telecom_calls for insert
  with check (organization_id = public.current_organization_id());

create policy "Users can update telecom calls in their organization"
  on public.telecom_calls for update
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

create policy "Users can delete telecom calls in their organization"
  on public.telecom_calls for delete
  using (organization_id = public.current_organization_id());

-- telecom_sms
create policy "Users can view telecom SMS in their organization"
  on public.telecom_sms for select
  using (organization_id = public.current_organization_id());

create policy "Users can create telecom SMS in their organization"
  on public.telecom_sms for insert
  with check (organization_id = public.current_organization_id());

create policy "Users can update telecom SMS in their organization"
  on public.telecom_sms for update
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

create policy "Users can delete telecom SMS in their organization"
  on public.telecom_sms for delete
  using (organization_id = public.current_organization_id());

-- ------------------------------------------------------------
-- 4. Grants
--    Tables created by this migration must be granted explicitly.
--    Telecom data is private org data (no anon grant).
-- ------------------------------------------------------------
grant all on table public.telecom_calls to authenticated;
grant all on table public.telecom_sms to authenticated;

-- ------------------------------------------------------------
-- 5. Keep updated_at current on telecom_calls
-- ------------------------------------------------------------
create trigger trigger_set_updated_at_telecom_calls
  before update on public.telecom_calls
  for each row execute procedure public.set_updated_at();

create index if not exists idx_telecom_sms_organization
  on public.telecom_sms(organization_id, created_at desc);

create index if not exists idx_telecom_sms_contact
  on public.telecom_sms(contact_id, created_at desc);

-- ------------------------------------------------------------
-- 6. Replace seed_organization() so NEW organizations get the
--    Telecom module, its permissions, and role grants on
--    creation. (Full superset of the 00018 version + telecom
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
    (new.id, 'marketing', 'Marketing', true),
    (new.id, 'telecommunications', 'Telecommunications', true);

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

    (new.id, 'telecom.view', 'View Telecom', 'View call logs and SMS history.', 'telecom'),
    (new.id, 'telecom.manage', 'Manage Telecom', 'Log calls and send SMS messages.', 'telecom'),

    (new.id, 'portal.client', 'Client Portal', 'Access the client portal with scoped project views.', 'portal');
-- Role matrix: Owner gets everything latest, Admin misses only
  -- roles.manage / settings.manage, Manager covers tactical ops
  -- (incl. Telecom call logging and SMS), Employee covers daily
  -- work (incl. Telecom view), Client stays portal-scoped.
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
        'marketing.view', 'marketing.manage',
        'telecom.view', 'telecom.manage'
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
        'marketing.view',
        'telecom.view'
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
--    keyed on natural keys (permission key, module key,
--    role_permissions pair), so re-running this migration never
--    duplicates rows.
-- ------------------------------------------------------------

-- 7a. telecom.view / telecom.manage for every organization.
insert into public.permissions (organization_id, key, name, description, module)
select o.id, 'telecom.view', 'View Telecom', 'View call logs and SMS history.', 'telecom'
from public.organizations o
where not exists (
  select 1 from public.permissions p
  where p.organization_id = o.id and p.key = 'telecom.view'
);

insert into public.permissions (organization_id, key, name, description, module)
select o.id, 'telecom.manage', 'Manage Telecom', 'Log calls and send SMS messages.', 'telecom'
from public.organizations o
where not exists (
  select 1 from public.permissions p
  where p.organization_id = o.id and p.key = 'telecom.manage'
);

-- 7b. Enable the Telecommunications module for every existing
--     organization ('telecommunications' is the modules-grid key).
insert into public.organization_modules (organization_id, module_key, module_name, is_enabled)
select o.id, 'telecommunications', 'Telecommunications', true
from public.organizations o
where not exists (
  select 1 from public.organization_modules m
  where m.organization_id = o.id and m.module_key = 'telecommunications'
);

update public.organization_modules m
set is_enabled = true
from public.organizations o
where o.id = m.organization_id and m.module_key = 'telecommunications' and not m.is_enabled;

-- 7c. Grant matrix: Owner and Admin get both Telecom permissions,
--     Manager gets telecom.view + telecom.manage, Employee gets
--     telecom.view only. organization_id is written explicitly so
--     the NOT NULL column is always populated.
insert into public.role_permissions (role_id, permission_id, organization_id)
select r.id, p.id, r.organization_id
from public.roles r
inner join public.permissions p
  on p.organization_id = r.organization_id
 and p.key in ('telecom.view', 'telecom.manage')
where r.key in ('owner', 'admin', 'manager')
  and not exists (
    select 1 from public.role_permissions rp
    where rp.role_id = r.id and rp.permission_id = p.id
  );

insert into public.role_permissions (role_id, permission_id, organization_id)
select r.id, p.id, r.organization_id
from public.roles r
inner join public.permissions p
  on p.organization_id = r.organization_id and p.key = 'telecom.view'
where r.key = 'employee'
  and not exists (
    select 1 from public.role_permissions rp
    where rp.role_id = r.id and rp.permission_id = p.id
  );