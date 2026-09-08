-- ============================================================
-- UpLevel — 00003 Departments & Employees support
--
-- Adds the schema support the Department/Employee management
-- pages require:
--
--   1) profiles.job_title  — free-text job title
--   2) profiles.status     — active / suspended / invited
--      (kept in sync with the legacy is_active boolean)
--   3) Granular employee permissions (employees.create /
--      employees.update / employees.delete), so server actions
--      can enforce the exact mutation permission instead of the
--      coarse employees.manage.
-- ============================================================

-- ------------------------------------------------------------
-- 1. New profile columns
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists job_title text;

alter table public.profiles
  add column if not exists status text not null default 'active'
  check (status in ('active', 'suspended', 'invited'));

-- Keep the legacy is_active flag in sync with status so any
-- existing logic that reads is_active keeps working.
create or replace function public.sync_profile_is_active()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.is_active := (new.status = 'active');
  return new;
end;
$$;

drop trigger if exists trg_profiles_sync_is_active on public.profiles;
create trigger trg_profiles_sync_is_active
  before insert or update of status on public.profiles
  for each row execute function public.sync_profile_is_active();

-- Existing profiles keep their current is_active value mapped to status.
update public.profiles
  set status = case when is_active then 'active' else 'suspended' end
  where status = 'active' and not is_active;
-- ------------------------------------------------------------
-- 2. Granular employee permissions
-- ------------------------------------------------------------

-- 2a. Replace seed_organization() so NEW organizations get the
--     granular employee permission keys wired into the matrix.
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
      'time.view', 'time.clock_in', 'time.clock_out'
    );

  return new;
end;
$$;
-- ------------------------------------------------------------
-- 3. Backfill granular permissions for organizations created
--    before this migration (idempotent — safe to re-run).
-- ------------------------------------------------------------

-- Create the new permission rows for existing orgs.
insert into public.permissions (organization_id, key, name, description, module)
select o.id, p.key, p.name, p.description, p.module
from public.organizations o
cross join (
  values
    ('employees.create', 'Create Employees', 'Add new employees to the organization.', 'employees'),
    ('employees.update', 'Update Employees', 'Edit employee details and status.', 'employees'),
    ('employees.delete', 'Delete Employees', 'Remove employees from the organization.', 'employees')
) as p(key, name, description, module)
on conflict (organization_id, key) do nothing;

-- Grant them like the matrix in 00002 does:
-- Owner (all), Admin (everything except roles.manage/settings.manage),
-- Manager (explicit list).
insert into public.role_permissions (role_id, permission_id, organization_id)
select r.id, p.id, r.organization_id
from public.roles r
join public.permissions p on p.organization_id = r.organization_id
where r.key in ('owner', 'admin')
  and p.key in ('employees.create', 'employees.update', 'employees.delete')
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id, organization_id)
select r.id, p.id, r.organization_id
from public.roles r
join public.permissions p on p.organization_id = r.organization_id
where r.key = 'manager'
  and p.key in ('employees.create', 'employees.update', 'employees.delete')
on conflict (role_id, permission_id) do nothing;
