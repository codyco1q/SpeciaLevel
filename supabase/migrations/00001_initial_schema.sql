-- ============================================================
-- UpLevel — 00001 Initial Schema
-- Multi-tenant foundation: organizations, profiles, roles,
-- permissions, modules, time entries, calendar events.
-- All tables enforce Row Level Security for tenant isolation.
-- ============================================================

create extension if not exists "uuid-ossp";

-- ============================================================
-- ORGANIZATIONS
-- ============================================================
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- DEPARTMENTS
-- ============================================================
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create index if not exists idx_departments_organization_id on public.departments(organization_id);

-- ============================================================
-- PROFILES (1:1 with auth.users)
-- organization_id is NULL until the user completes onboarding
-- (creates or is invited to an organization). The signup trigger
-- inserts a profile before any organization exists.
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  full_name text,
  email text,
  avatar_url text,
  department_id uuid references public.departments(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_organization_id on public.profiles(organization_id);
create index if not exists idx_profiles_department_id on public.profiles(department_id);

-- ============================================================
-- ROLES
-- ============================================================
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  key text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, key)
);

create index if not exists idx_roles_organization_id on public.roles(organization_id);

-- ============================================================
-- PERMISSIONS
-- ============================================================
create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  name text not null,
  description text,
  module text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, key)
);

create index if not exists idx_permissions_organization_id on public.permissions(organization_id);

-- ============================================================
-- ROLE_PERMISSIONS (join: roles <-> permissions)
-- ============================================================
create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (role_id, permission_id)
);

create index if not exists idx_role_permissions_role_id on public.role_permissions(role_id);
create index if not exists idx_role_permissions_permission_id on public.role_permissions(permission_id);
create index if not exists idx_role_permissions_organization_id on public.role_permissions(organization_id);

-- ============================================================
-- USER_ROLES (join: profiles <-> roles)
-- ============================================================
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, role_id)
);

create index if not exists idx_user_roles_user_id on public.user_roles(user_id);
create index if not exists idx_user_roles_role_id on public.user_roles(role_id);
create index if not exists idx_user_roles_organization_id on public.user_roles(organization_id);

-- ============================================================
-- ORGANIZATION_MODULES
-- ============================================================
create table if not exists public.organization_modules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  module_key text not null,
  module_name text not null,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, module_key)
);

create index if not exists idx_organization_modules_organization_id
  on public.organization_modules(organization_id);

-- ============================================================
-- TIME_ENTRIES
-- ============================================================
create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  clocked_in_at timestamptz not null default now(),
  clocked_out_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_time_entries_organization_id on public.time_entries(organization_id);
create index if not exists idx_time_entries_user_id on public.time_entries(user_id);

-- ============================================================
-- CALENDAR_EVENTS
-- ============================================================
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_calendar_events_organization_id on public.calendar_events(organization_id);
create index if not exists idx_calendar_events_user_id on public.calendar_events(user_id);

-- ============================================================
-- HELPER: get current user's organization_id
-- Returns NULL for unauthenticated / unassigned users so RLS denies
-- access to rows belonging to any organization.
-- ============================================================
create or replace function public.current_organization_id()
returns uuid
language sql
stable
as $$
  select organization_id
  from public.profiles
  where id = auth.uid()
$$;

-- ============================================================
-- ROW LEVEL SECURITY (ENABLED ON ALL TABLES)
-- ============================================================

-- ---- ORGANIZATIONS ----
alter table public.organizations enable row level security;

create policy "User can view their own organization"
  on public.organizations for select
  using (id = public.current_organization_id());

create policy "User can update their own organization"
  on public.organizations for update
  using (id = public.current_organization_id())
  with check (id = public.current_organization_id());

-- ---- DEPARTMENTS ----
alter table public.departments enable row level security;

create policy "User can view departments in their organization"
  on public.departments for select
  using (organization_id = public.current_organization_id());

create policy "User can insert departments in their organization"
  on public.departments for insert
  with check (organization_id = public.current_organization_id());

create policy "User can update departments in their organization"
  on public.departments for update
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

create policy "User can delete departments in their organization"
  on public.departments for delete
  using (organization_id = public.current_organization_id());

-- ---- PROFILES ----
alter table public.profiles enable row level security;

create policy "User can view own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "User can view profiles in their organization"
  on public.profiles for select
  using (organization_id = public.current_organization_id());

create policy "User can update own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and (
      organization_id is null
      or organization_id = public.current_organization_id()
    )
  );

create policy "User can update profiles in their organization"
  on public.profiles for update
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

-- ---- ROLES ----
alter table public.roles enable row level security;

create policy "User can view roles in their organization"
  on public.roles for select
  using (organization_id = public.current_organization_id());

create policy "User can insert roles in their organization"
  on public.roles for insert
  with check (organization_id = public.current_organization_id());

create policy "User can update roles in their organization"
  on public.roles for update
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

create policy "User can delete roles in their organization"
  on public.roles for delete
  using (organization_id = public.current_organization_id());

-- ---- PERMISSIONS ----
alter table public.permissions enable row level security;

create policy "User can view permissions in their organization"
  on public.permissions for select
  using (organization_id = public.current_organization_id());

create policy "User can insert permissions in their organization"
  on public.permissions for insert
  with check (organization_id = public.current_organization_id());

create policy "User can update permissions in their organization"
  on public.permissions for update
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

create policy "User can delete permissions in their organization"
  on public.permissions for delete
  using (organization_id = public.current_organization_id());

-- ---- ROLE_PERMISSIONS ----
alter table public.role_permissions enable row level security;

create policy "User can view role_permissions in their organization"
  on public.role_permissions for select
  using (organization_id = public.current_organization_id());

create policy "User can insert role_permissions in their organization"
  on public.role_permissions for insert
  with check (organization_id = public.current_organization_id());

create policy "User can update role_permissions in their organization"
  on public.role_permissions for update
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

create policy "User can delete role_permissions in their organization"
  on public.role_permissions for delete
  using (organization_id = public.current_organization_id());

-- ---- USER_ROLES ----
alter table public.user_roles enable row level security;

create policy "User can view user_roles in their organization"
  on public.user_roles for select
  using (organization_id = public.current_organization_id());

create policy "User can insert user_roles in their organization"
  on public.user_roles for insert
  with check (organization_id = public.current_organization_id());

create policy "User can update user_roles in their organization"
  on public.user_roles for update
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

create policy "User can delete user_roles in their organization"
  on public.user_roles for delete
  using (organization_id = public.current_organization_id());

-- ---- ORGANIZATION_MODULES ----
alter table public.organization_modules enable row level security;

create policy "User can view modules in their organization"
  on public.organization_modules for select
  using (organization_id = public.current_organization_id());

create policy "User can insert modules in their organization"
  on public.organization_modules for insert
  with check (organization_id = public.current_organization_id());

create policy "User can update modules in their organization"
  on public.organization_modules for update
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

create policy "User can delete modules in their organization"
  on public.organization_modules for delete
  using (organization_id = public.current_organization_id());

-- ---- TIME_ENTRIES ----
alter table public.time_entries enable row level security;

create policy "User can view time entries in their organization"
  on public.time_entries for select
  using (organization_id = public.current_organization_id());

create policy "User can insert time entries in their organization"
  on public.time_entries for insert
  with check (organization_id = public.current_organization_id());

create policy "User can update time entries in their organization"
  on public.time_entries for update
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

create policy "User can delete time entries in their organization"
  on public.time_entries for delete
  using (organization_id = public.current_organization_id());

-- ---- CALENDAR_EVENTS ----
alter table public.calendar_events enable row level security;

create policy "User can view calendar events in their organization"
  on public.calendar_events for select
  using (organization_id = public.current_organization_id());

create policy "User can insert calendar events in their organization"
  on public.calendar_events for insert
  with check (organization_id = public.current_organization_id());

create policy "User can update calendar events in their organization"
  on public.calendar_events for update
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

create policy "User can delete calendar events in their organization"
  on public.calendar_events for delete
  using (organization_id = public.current_organization_id());

-- ============================================================
-- TRIGGER: automatic profile creation on auth.users signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- TRIGGER: seed base roles, modules & permissions on org creation
-- Owner, Admin, Manager, Employee
-- ============================================================
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

    (new.id, 'departments.view', 'View Departments', 'View departments.', 'departments'),
    (new.id, 'departments.manage', 'Manage Departments', 'Create, edit, or delete departments.', 'departments'),

    (new.id, 'roles.view', 'View Roles', 'View roles and permissions.', 'roles'),
    (new.id, 'roles.manage', 'Manage Roles', 'Create, edit, or delete roles.', 'roles'),
    (new.id, 'settings.view', 'View Settings', 'View organization settings.', 'settings'),
    (new.id, 'settings.manage', 'Manage Settings', 'Update organization settings.', 'settings');

  return new;
end;
$$;

create trigger on_organization_created
  after insert on public.organizations
  for each row execute procedure public.seed_organization();

-- ============================================================
-- TRIGGER: keep updated_at current on tables with updated_at
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trigger_set_updated_at_organizations
  before update on public.organizations
  for each row execute procedure public.set_updated_at();

create trigger trigger_set_updated_at_departments
  before update on public.departments
  for each row execute procedure public.set_updated_at();

create trigger trigger_set_updated_at_profiles
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

create trigger trigger_set_updated_at_roles
  before update on public.roles
  for each row execute procedure public.set_updated_at();

create trigger trigger_set_updated_at_modules
  before update on public.organization_modules
  for each row execute procedure public.set_updated_at();

create trigger trigger_set_updated_at_time_entries
  before update on public.time_entries
  for each row execute procedure public.set_updated_at();

create trigger trigger_set_updated_at_calendar_events
  before update on public.calendar_events
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- GRANTS (Supabase role access)
-- RLS controls row-level access; grants control table-level access.
-- ============================================================
grant usage on schema public to anon, authenticated;

grant all on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant all on all sequences in schema public to authenticated;
grant all on all functions in schema public to authenticated;