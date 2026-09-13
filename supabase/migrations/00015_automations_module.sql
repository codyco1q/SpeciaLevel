-- ============================================================
-- UpLevel — 00015 Automations module
--
-- Adds the Automations app: rule-based triggers (lead.created,
-- deal.stage_changed, invoice.paid, task.completed) that run
-- configured actions (webhook dispatch, system chat message,
-- create_task) and record every execution in automation_logs.
--
--   automations      — the automation definitions
--   automation_logs  — execution history per automation
--
-- Security mirrors the rest of the platform: tenant-scoped RLS,
-- the "automations.view" / "automations.manage" catalog permissions,
-- and role grants (Owner/Admin/Manager = both, Employee = view,
-- Client = none).
-- ============================================================

-- ------------------------------------------------------------
-- 1. automations
-- ------------------------------------------------------------
create table if not exists public.automations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  name text not null,
  description text,
  trigger_event text not null,
  action_type text not null,
  action_config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_automations_organization
    foreign key (organization_id) references public.organizations(id) on delete cascade,
  constraint fk_automations_created_by
    foreign key (created_by) references public.profiles(id),
  constraint chk_automations_name_not_blank
    check (btrim(name) <> ''),
  constraint chk_automations_trigger_event
    check (
      trigger_event in (
        'lead.created',
        'deal.stage_changed',
        'invoice.paid',
        'task.completed'
      )
    ),
  constraint chk_automations_action_type
    check (action_type in ('webhook', 'chat_message', 'create_task'))
);

create index if not exists idx_automations_organization
  on public.automations(organization_id);

-- Fast lookup for the execution runner: enabled automations for a
-- given event within an organization.
create index if not exists idx_automations_active_lookup
  on public.automations(organization_id, trigger_event)
  where is_active = true;
-- ------------------------------------------------------------
-- 2. automation_logs
-- ------------------------------------------------------------
create table if not exists public.automation_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  automation_id uuid not null,
  status text not null,
  trigger_payload jsonb not null default '{}'::jsonb,
  action_result jsonb not null default '{}'::jsonb,
  error_message text,
  executed_at timestamptz not null default now(),
  constraint fk_automation_logs_organization
    foreign key (organization_id) references public.organizations(id) on delete cascade,
  constraint fk_automation_logs_automation
    foreign key (automation_id) references public.automations(id) on delete cascade,
  constraint chk_automation_logs_status
    check (status in ('success', 'failed', 'running'))
);

create index if not exists idx_automation_logs_automation_id
  on public.automation_logs(automation_id, executed_at desc);

create index if not exists idx_automation_logs_organization
  on public.automation_logs(organization_id, executed_at desc);

-- ------------------------------------------------------------
-- 3. RLS - tenant-scoped CRUD exactly like every other module.
--    created_by is pinned to the caller and the organization is
--    always resolved from the session (never from the payload),
--    mirroring the invoicing/chat security model.
-- ------------------------------------------------------------
alter table public.automations enable row level security;
alter table public.automation_logs enable row level security;

-- automations - tenant-scoped CRUD.
create policy "Users can view automations in their organization"
  on public.automations for select
  using (organization_id = public.current_organization_id());

create policy "Users can create automations in their organization"
  on public.automations for insert
  with check (
    organization_id = public.current_organization_id()
    and created_by = auth.uid()
  );

create policy "Users can update automations in their organization"
  on public.automations for update
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

create policy "Users can delete automations in their organization"
  on public.automations for delete
  using (organization_id = public.current_organization_id());

-- automation_logs - tenant-scoped through the parent automation or
-- directly. Every insert comes from the server-side runner, which also
-- enforces the automation.view permission.
create policy "Users can view automation logs in their organization"
  on public.automation_logs for select
  using (organization_id = public.current_organization_id());

create policy "Users can create automation logs in their organization"
  on public.automation_logs for insert
  with check (organization_id = public.current_organization_id());

create policy "Users can update automation logs in their organization"
  on public.automation_logs for update
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

create policy "Users can delete automation logs in their organization"
  on public.automation_logs for delete
  using (organization_id = public.current_organization_id());

-- ------------------------------------------------------------
-- 4. Grants
--    00001 granted privileges on tables that existed at the time;
--    tables created by later migrations must be granted
--    explicitly. Automations data is private org data (no anon grant).
-- ------------------------------------------------------------
grant all on table public.automations to authenticated;
grant all on table public.automation_logs to authenticated;

-- ------------------------------------------------------------
-- 5. Keep updated_at current on automations
-- ------------------------------------------------------------
create trigger trigger_set_updated_at_automations
  before update on public.automations
  for each row execute procedure public.set_updated_at();

-- ------------------------------------------------------------
-- 6. Replace seed_organization() so NEW organizations get the
--    Automations module, its permissions, and role grants on
--    creation. (Full superset of the 00013 version + automations
--    additions.)
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
    (new.id, 'automations', 'Automations', true);

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

    (new.id, 'employees.view', 'View Employees', 'View employees.', 'employees'),
    (new.id, 'employees.manage', 'Manage Employees', 'Add, edit, or remove employees.', 'employees'),

    (new.id, 'departments.view', 'View Departments', 'View departments.', 'departments'),
    (new.id, 'departments.manage', 'Manage Departments', 'Create, edit, or delete departments.', 'departments'),

    (new.id, 'roles.view', 'View Roles', 'View roles and permissions.', 'roles'),
    (new.id, 'roles.manage', 'Manage Roles', 'Create, edit, or delete roles.', 'roles'),

    (new.id, 'settings.view', 'View Settings', 'View organization settings.', 'settings'),
    (new.id, 'settings.manage', 'Manage Settings', 'Update organization settings.', 'settings'),

    (new.id, 'tasks.view', 'View Tasks', 'View tasks.', 'tasks'),
    (new.id, 'tasks.manage', 'Manage Tasks', 'Create, edit, or delete tasks.', 'tasks'),

    (new.id, 'chat.view', 'View Chat', 'View channels and messages.', 'chat'),
    (new.id, 'chat.manage', 'Manage Chat', 'Create channels and manage chat.', 'chat'),

    (new.id, 'crm.view', 'View CRM', 'View deals, contacts, and inbound leads.', 'crm'),
    (new.id, 'crm.manage', 'Manage CRM', 'Create and edit deals and convert inbound leads.', 'crm'),

    (new.id, 'invoicing.view', 'View Invoicing', 'View invoices and billing.', 'invoicing'),
    (new.id, 'invoicing.manage', 'Manage Invoicing', 'Create, send, and update invoices.', 'invoicing'),

    (new.id, 'automations.view', 'View Automations', 'View automations and their execution history.', 'automations'),
    (new.id, 'automations.manage', 'Manage Automations', 'Create, edit, and delete automations.', 'automations'),

    (new.id, 'portal.client', 'Client Portal', 'Access the client portal views.', 'portal');

  -- Role > permissions matrix
  -- Owner: every permission in the catalog
  insert into public.role_permissions (role_id, permission_id, organization_id)
  select r.id, p.id, new.id
  from public.roles r, public.permissions p
  where r.organization_id = new.id
    and p.organization_id = new.id
    and r.key = 'owner';

  -- Admin: everything except role management and settings management
  insert into public.role_permissions (role_id, permission_id, organization_id)
  select r.id, p.id, new.id
  from public.roles r, public.permissions p
  where r.organization_id = new.id
    and p.organization_id = new.id
    and r.key = 'admin'
    and p.key not in ('roles.manage', 'settings.manage');

  -- Manager: operational day-to-day access
  insert into public.role_permissions (role_id, permission_id, organization_id)
  select r.id, p.id, new.id
  from public.roles r, public.permissions p
  where r.organization_id = new.id
    and p.organization_id = new.id
    and r.key = 'manager'
    and p.key in (
      'dashboard.view',
      'calendar.view', 'calendar.create',
      'time.view', 'time.clock_in', 'time.clock_out',
      'employees.view', 'employees.manage',
      'departments.view',
      'tasks.view', 'tasks.manage',
      'chat.view', 'chat.manage',
      'crm.view', 'crm.manage',
      'invoicing.view', 'invoicing.manage',
      'automations.view', 'automations.manage'
    );

  -- Employee: self-service access
  insert into public.role_permissions (role_id, permission_id, organization_id)
  select r.id, p.id, new.id
  from public.roles r, public.permissions p
  where r.organization_id = new.id
    and p.organization_id = new.id
    and r.key = 'employee'
    and p.key in (
      'dashboard.view',
      'calendar.view',
      'time.view', 'time.clock_in', 'time.clock_out',
      'tasks.view',
      'chat.view',
      'crm.view',
      'invoicing.view',
      'automations.view'
    );

  -- Client: scoped portal access ONLY - no automations, no CRM, no
  -- settings, no roles, no departments, no time permissions.
  insert into public.role_permissions (role_id, permission_id, organization_id)
  select r.id, p.id, new.id
  from public.roles r, public.permissions p
  where r.organization_id = new.id
    and p.organization_id = new.id
    and r.key = 'client'
    and p.key in (
      'portal.client',
      'tasks.view',
      'chat.view',
      'invoicing.view'
    );

  -- Default #general + #client-project channels. chat_channels.created_by
  -- is NOT NULL and no profiles exist for a brand-new organization yet, so
  -- this only fires when members already exist (e.g. re-seeding). New
  -- organizations get their #general channel from the app
  -- (lib/actions/onboarding.ts).
  if exists (select 1 from public.profiles where organization_id = new.id) then
    insert into public.chat_channels (organization_id, name, description, created_by)
    select new.id, 'general', 'General discussion for your team.', id
    from public.profiles
    where organization_id = new.id
    order by created_at
    limit 1
    on conflict (organization_id, name) do nothing;

    insert into public.chat_channels (organization_id, name, description, created_by)
    select new.id, 'client-project', 'Client project updates and support.', id
    from public.profiles
    where organization_id = new.id
    order by created_at
    limit 1
    on conflict (organization_id, name) do nothing;
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------
-- 7. Backfill for organizations created before this migration
--    (idempotent — safe to re-run).
-- ------------------------------------------------------------

-- Catalog permissions
insert into public.permissions (organization_id, key, name, description, module)
select o.id, 'automations.view', 'View Automations', 'View automations and their execution history.', 'automations'
from public.organizations o
where not exists (
  select 1 from public.permissions p
  where p.organization_id = o.id and p.key = 'automations.view'
);

insert into public.permissions (organization_id, key, name, description, module)
select o.id, 'automations.manage', 'Manage Automations', 'Create, edit, and delete automations.', 'automations'
from public.organizations o
where not exists (
  select 1 from public.permissions p
  where p.organization_id = o.id and p.key = 'automations.manage'
);

-- Module row — force-enabled so the Automations module un-gates automatically.
insert into public.organization_modules (organization_id, module_key, module_name, is_enabled)
select o.id, 'automations', 'Automations', true
from public.organizations o
on conflict (organization_id, module_key)
do update set module_name = excluded.module_name, is_enabled = true;

-- Role grants (unique (role_id, permission_id) makes this idempotent).
-- Owner / Admin / Manager: view + manage.
insert into public.role_permissions (role_id, permission_id, organization_id)
select r.id, p.id, r.organization_id
from public.roles r
join public.permissions p on p.organization_id = r.organization_id
where r.key in ('owner', 'admin', 'manager')
  and p.key in ('automations.view', 'automations.manage')
on conflict (role_id, permission_id) do nothing;

-- Employee: view only.
insert into public.role_permissions (role_id, permission_id, organization_id)
select r.id, p.id, r.organization_id
from public.roles r
join public.permissions p on p.organization_id = r.organization_id
where r.key = 'employee'
  and p.key = 'automations.view'
on conflict (role_id, permission_id) do nothing;

-- Client: none (no automations permissions granted by design).
