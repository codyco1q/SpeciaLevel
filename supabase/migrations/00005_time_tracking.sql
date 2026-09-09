-- ============================================================
-- UpLevel — 00005 Time Tracking milestone
--
-- 1) Canonical time-tracking permission keys (per PROJECT_CONTEXT.md /
--    PROJECT_ARCHITECTURE.md: time_tracking.view_self,
--    time_tracking.manage_self, time_tracking.view_team,
--    time_tracking.manage_team), wired into the role matrix for new
--    organizations and backfilled for existing ones.
--    (The older coarse `time.*` keys stay granted — legacy, harmless.)
--
-- 2) time_entries state columns:
--      status            'active' | 'completed'
--      duration_seconds  set on clock-out, NULL while active
--    plus constraints that make invalid states unrepresentable:
--      - status is locked to clocked_out_at (active <=> open)
--      - duration is never negative
--      - partial unique index: at most ONE open entry per user
--        (race-proof "cannot clock in twice", beyond the app check)
-- ============================================================

-- ------------------------------------------------------------
-- 1. New columns (nullable first so any legacy rows survive;
--    backfilled below, then tightened).
-- ------------------------------------------------------------
alter table public.time_entries
  add column if not exists status text;

alter table public.time_entries
  add column if not exists duration_seconds integer;

-- Backfill from the source of truth (clocked_out_at).
update public.time_entries
  set status = case when clocked_out_at is null then 'active' else 'completed' end
  where status is null;

update public.time_entries
  set duration_seconds = greatest(0, extract(epoch from (clocked_out_at - clocked_in_at))::integer)
  where clocked_out_at is not null
    and duration_seconds is null;

alter table public.time_entries
  alter column status set not null,
  alter column status set default 'active';

-- ------------------------------------------------------------
-- 2. Integrity guards.
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'time_entries_status_values'
  ) then
    alter table public.time_entries
      add constraint time_entries_status_values
      check (status in ('active', 'completed'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'time_entries_status_clock_out_check'
  ) then
    -- 'active' rows must be open; 'completed' rows must be closed.
    alter table public.time_entries
      add constraint time_entries_status_clock_out_check
      check ((status = 'active') = (clocked_out_at is null));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'time_entries_duration_check'
  ) then
    alter table public.time_entries
      add constraint time_entries_duration_check
      check (duration_seconds is null or duration_seconds >= 0);
  end if;
end
$$;

create unique index if not exists idx_time_entries_one_open_per_user
  on public.time_entries (user_id)
  where clocked_out_at is null;

-- ------------------------------------------------------------
-- 3. Permission catalog + matrix (new orgs via seed_organization).
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
    (new.id, 'roles', 'Roles & Permissions', true);

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
    (new.id, 'time_tracking.view_self', 'View Own Time', 'View personal time entries.', 'time'),
    (new.id, 'time_tracking.manage_self', 'Manage Own Time', 'Clock in and out.', 'time'),
    (new.id, 'time_tracking.view_team', 'View Team Time', 'See who is currently clocked in.', 'time'),
    (new.id, 'time_tracking.manage_team', 'Manage Team Time', 'Manage team members time entries.', 'time'),
    (new.id, 'employees.view', 'View Employees', 'View employee list.', 'employees'),
    (new.id, 'employees.manage', 'Manage Employees', 'Add, edit, or remove employees.', 'employees'),
    (new.id, 'employees.create', 'Create Employees', 'Add new employees to the organization.', 'employees'),
    (new.id, 'employees.update', 'Update Employees', 'Edit employee details and status.', 'employees'),
    (new.id, 'employees.delete', 'Delete Employees', 'Remove employees from the organization.', 'employees'),
    (new.id, 'departments.view', 'View Departments', 'View departments.', 'departments'),
    (new.id, 'departments.manage', 'Manage Departments', 'Create, edit, or delete departments.', 'departments'),
    (new.id, 'roles.view', 'View Roles', 'View roles and permissions.', 'roles'),
    (new.id, 'roles.manage', 'Manage Roles', 'Create, edit, or delete roles.', 'roles'),
    (new.id, 'settings.view', 'View Settings', 'View organization settings.', 'settings'),
    (new.id, 'settings.manage', 'Manage Settings', 'Update organization settings.', 'settings');

  -- -----------------------------------------------------------
  -- Role > permissions matrix
  -- -----------------------------------------------------------

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

  -- Manager: operational day-to-day access + team attendance
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
      'time_tracking.view_self', 'time_tracking.manage_self',
      'time_tracking.view_team',
      'employees.view', 'employees.create', 'employees.update', 'employees.delete',
      'departments.view'
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
      'time_tracking.view_self', 'time_tracking.manage_self'
    );

  return new;
end;
$$;

-- ------------------------------------------------------------
-- 4. Backfill for organizations created before this migration
--    (idempotent — safe to re-run).
-- ------------------------------------------------------------
insert into public.permissions (organization_id, key, name, description, module)
select o.id, p.key, p.name, p.description, p.module
from public.organizations o
cross join (
  values
    ('time_tracking.view_self', 'View Own Time', 'View personal time entries.', 'time'),
    ('time_tracking.manage_self', 'Manage Own Time', 'Clock in and out.', 'time'),
    ('time_tracking.view_team', 'View Team Time', 'See who is currently clocked in.', 'time'),
    ('time_tracking.manage_team', 'Manage Team Time', 'Manage team members time entries.', 'time')
) as p(key, name, description, module)
on conflict (organization_id, key) do nothing;

-- Owner + Admin get all four (admin exclusion list is roles/settings only).
insert into public.role_permissions (role_id, permission_id, organization_id)
select r.id, p.id, r.organization_id
from public.roles r
join public.permissions p on p.organization_id = r.organization_id
where r.key in ('owner', 'admin')
  and p.key in (
    'time_tracking.view_self', 'time_tracking.manage_self',
    'time_tracking.view_team', 'time_tracking.manage_team'
  )
on conflict (role_id, permission_id) do nothing;

-- Manager gets self-service + team view.
insert into public.role_permissions (role_id, permission_id, organization_id)
select r.id, p.id, r.organization_id
from public.roles r
join public.permissions p on p.organization_id = r.organization_id
where r.key = 'manager'
  and p.key in (
    'time_tracking.view_self', 'time_tracking.manage_self',
    'time_tracking.view_team'
  )
on conflict (role_id, permission_id) do nothing;

-- Employee gets self-service.
insert into public.role_permissions (role_id, permission_id, organization_id)
select r.id, p.id, r.organization_id
from public.roles r
join public.permissions p on p.organization_id = r.organization_id
where r.key = 'employee'
  and p.key in (
    'time_tracking.view_self', 'time_tracking.manage_self'
  )
on conflict (role_id, permission_id) do nothing;
