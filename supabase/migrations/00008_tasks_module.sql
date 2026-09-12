-- ============================================================
-- UpLevel — 00008 Tasks Module
--
-- 1) public.tasks — organization-scoped task management with
--    status + priority and assignee support.
-- 2) RLS isolation via organization_id (multi-tenant).
-- 3) Catalog permissions tasks.view / tasks.manage, an enabled
--    `tasks` row in organization_modules, and the role grant
--    matrix (Owner/Admin/Manager = view+manage, Employee =
--    view) baked into the seed function AND backfilled for
--    organizations created before this migration.
-- ============================================================

-- ------------------------------------------------------------
-- 1. tasks
-- ------------------------------------------------------------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  title text not null,
  description text,
  status text not null default 'todo',
  priority text not null default 'medium',
  assigned_to uuid,
  created_by uuid not null,
  due_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_tasks_organization
    foreign key (organization_id) references public.organizations(id) on delete cascade,
  constraint fk_tasks_assigned_to
    foreign key (assigned_to) references public.profiles(id) on delete set null,
  constraint fk_tasks_created_by
    foreign key (created_by) references public.profiles(id) on delete cascade,
  constraint chk_tasks_status
    check (status in ('todo', 'in_progress', 'review', 'done')),
  constraint chk_tasks_priority
    check (priority in ('low', 'medium', 'high', 'urgent'))
);

create index if not exists idx_tasks_organization_id_status
  on public.tasks(organization_id, status);

create index if not exists idx_tasks_organization_id_assigned_to
  on public.tasks(organization_id, assigned_to);

create index if not exists idx_tasks_organization_id
  on public.tasks(organization_id);

-- ------------------------------------------------------------
-- 2. RLS — tasks are tenant-scoped like every other table.
-- ------------------------------------------------------------
alter table public.tasks enable row level security;

create policy "User can view tasks in their organization"
  on public.tasks for select
  using (organization_id = public.current_organization_id());

create policy "User can insert tasks in their organization"
  on public.tasks for insert
  with check (organization_id = public.current_organization_id());

create policy "User can update tasks in their organization"
  on public.tasks for update
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

create policy "User can delete tasks in their organization"
  on public.tasks for delete
  using (organization_id = public.current_organization_id());

-- 00001 granted privileges on tables that existed at the time;
-- tables created by later migrations must be granted explicitly.
-- No anon grant: tasks are private organization data.
grant all on table public.tasks to authenticated;

-- ------------------------------------------------------------
-- 3. Replace seed_organization() so NEW organizations get the
--    Tasks module, its permissions, and role grants on creation.
--    (Full superset of the 00002 version + tasks additions.)
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
    (new.id, 'Employee', 'employee', 'Standard employee access.', true);

  -- Default modules
  insert into public.organization_modules (organization_id, module_key, module_name, is_enabled) values
    (new.id, 'dashboard', 'Dashboard', true),
    (new.id, 'calendar', 'Calendar', true),
    (new.id, 'time', 'Time Tracking', true),
    (new.id, 'employees', 'Employees', true),
    (new.id, 'departments', 'Departments', true),
    (new.id, 'roles', 'Roles & Permissions', true),
    (new.id, 'tasks', 'Tasks', true);

  -- Default permissions
  insert into public.permissions (organization_id, key, name, description, module) values
    (new.id, 'dashboard.view', 'View Dashboard', 'View the main dashboard.', 'dashboard'),

    (new.id, 'calendar.view', 'View Calendar', 'View calendar events.', 'calendar'),
    (new.id, 'calendar.create', 'Create Calendar Events', 'Create calendar events.', 'calendar'),
    (new.id, 'calendar.edit', 'Edit Calendar Events', 'Edit calendar events.', 'calendar'),
    (new.id, 'calendar.delete', 'Delete Calendar Events', 'Delete calendar events.', 'calendar'),

    (new.id, 'time.view', 'View Time Entries', 'View time entries.', 'time'),
    (new.id, 'time.clock_in', 'Clock In', 'Clock in.', 'time'),
    (new.id, 'time.clock_out', 'Clock Out', 'Clock out.', 'time'),
    (new.id, 'time.manage', 'Manage Time Entries', 'Manage all time entries.', 'time'),

    (new.id, 'employees.view', 'View Employees', 'View employee list.', 'employees'),
    (new.id, 'employees.manage', 'Manage Employees', 'Add, edit, or remove employees.', 'employees'),

    (new.id, 'departments.view', 'View Departments', 'View departments.', 'departments'),
    (new.id, 'departments.manage', 'Manage Departments', 'Create, edit, or delete departments.', 'departments'),

    (new.id, 'roles.view', 'View Roles', 'View roles and permissions.', 'roles'),
    (new.id, 'roles.manage', 'Manage Roles', 'Create, edit, or delete roles.', 'roles'),

    (new.id, 'settings.view', 'View Settings', 'View organization settings.', 'settings'),
    (new.id, 'settings.manage', 'Manage Settings', 'Update organization settings.', 'settings'),

    (new.id, 'tasks.view', 'View Tasks', 'View tasks.', 'tasks'),
    (new.id, 'tasks.manage', 'Manage Tasks', 'Create, edit, or delete tasks.', 'tasks');

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
      'tasks.view', 'tasks.manage'
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
      'tasks.view'
    );

  return new;
end;
$$;

-- ------------------------------------------------------------
-- 4. Backfill for organizations created before this migration
--    (idempotent — safe to re-run).
-- ------------------------------------------------------------

-- Catalog permissions
insert into public.permissions (organization_id, key, name, description, module)
select o.id, 'tasks.view', 'View Tasks', 'View tasks.', 'tasks'
from public.organizations o
where not exists (
  select 1 from public.permissions p
  where p.organization_id = o.id and p.key = 'tasks.view'
);

insert into public.permissions (organization_id, key, name, description, module)
select o.id, 'tasks.manage', 'Manage Tasks', 'Create, edit, or delete tasks.', 'tasks'
from public.organizations o
where not exists (
  select 1 from public.permissions p
  where p.organization_id = o.id and p.key = 'tasks.manage'
);

-- Module row — force-enabled so the Tasks module un-gates automatically.
insert into public.organization_modules (organization_id, module_key, module_name, is_enabled)
select o.id, 'tasks', 'Tasks', true
from public.organizations o
on conflict (organization_id, module_key)
do update set module_name = excluded.module_name, is_enabled = true;

-- Role grants (unique (role_id, permission_id) makes this idempotent).
insert into public.role_permissions (role_id, permission_id, organization_id)
select r.id, p.id, r.organization_id
from public.roles r
join public.permissions p on p.organization_id = r.organization_id
where r.key in ('owner', 'admin', 'manager')
  and p.key in ('tasks.view', 'tasks.manage')
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id, organization_id)
select r.id, p.id, r.organization_id
from public.roles r
join public.permissions p on p.organization_id = r.organization_id
where r.key = 'employee'
  and p.key = 'tasks.view'
on conflict (role_id, permission_id) do nothing;