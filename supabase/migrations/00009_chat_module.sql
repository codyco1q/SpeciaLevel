-- ============================================================
-- UpLevel — 00009 Real-Time Team Chat Module
--
-- 1) public.chat_channels — organization-scoped channels
--    (lowercase kebab-case names, unique per organization).
-- 2) public.chat_messages — chronological channel messages with
--    realtime replication (postgres_changes INSERT events).
-- 3) RLS isolation via organization_id (multi-tenant) on both
--    tables, strictly through current_organization_id().
-- 4) Catalog permissions chat.view / chat.manage, an enabled
--    `chat` row in organization_modules, the role grant matrix
--    (Owner/Admin/Manager = view+manage, Employee = view), and a
--    default `#general` channel for every organization — baked
--    into the seed function AND backfilled for organizations
--    created before this migration.
-- ============================================================

-- ------------------------------------------------------------
-- 1. chat_channels
-- ------------------------------------------------------------
create table if not exists public.chat_channels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  name text not null,
  description text,
  is_private boolean not null default false,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  constraint fk_chat_channels_organization
    foreign key (organization_id) references public.organizations(id) on delete cascade,
  constraint fk_chat_channels_created_by
    foreign key (created_by) references public.profiles(id) on delete cascade,
  constraint chk_chat_channels_name
    check (name ~ '^[a-z0-9]+([_-][a-z0-9]+)*$'),
  unique (organization_id, name)
);

create index if not exists idx_chat_channels_organization_id
  on public.chat_channels(organization_id);

-- ------------------------------------------------------------
-- 2. chat_messages
-- ------------------------------------------------------------
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  channel_id uuid not null,
  user_id uuid not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_chat_messages_organization
    foreign key (organization_id) references public.organizations(id) on delete cascade,
  constraint fk_chat_messages_channel
    foreign key (channel_id) references public.chat_channels(id) on delete cascade,
  constraint fk_chat_messages_user
    foreign key (user_id) references public.profiles(id) on delete cascade,
  constraint chk_chat_messages_content
    check (char_length(content) between 1 and 2000)
);

create index if not exists idx_chat_messages_channel_id_created_at
  on public.chat_messages(channel_id, created_at);

create index if not exists idx_chat_messages_organization_id
  on public.chat_messages(organization_id);

-- ------------------------------------------------------------
-- 3. Realtime — broadcast new chat messages to subscribed
--    clients. RLS is enforced by Realtime, so a client only
--    receives INSERT events for rows its own tenant can see.
-- ------------------------------------------------------------
alter publication supabase_realtime add table public.chat_messages;

-- ------------------------------------------------------------
-- 4. RLS — chat is tenant-scoped like every other table.
--    Messages: members may read and post; edit/delete of
--    messages is not exposed by the app yet (no policies).
--    Channels: full org-scoped CRUD (the app exposes create;
--    delete/edit policies keep the RLS surface consistent).
-- ------------------------------------------------------------
alter table public.chat_channels enable row level security;
alter table public.chat_messages enable row level security;

create policy "User can view channels in their organization"
  on public.chat_channels for select
  using (organization_id = public.current_organization_id());

create policy "User can create channels in their organization"
  on public.chat_channels for insert
  with check (
    organization_id = public.current_organization_id()
    and created_by = auth.uid()
  );

create policy "User can update channels in their organization"
  on public.chat_channels for update
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

create policy "User can delete channels in their organization"
  on public.chat_channels for delete
  using (organization_id = public.current_organization_id());

create policy "User can view messages in their organization"
  on public.chat_messages for select
  using (organization_id = public.current_organization_id());

create policy "User can insert messages in their organization"
  on public.chat_messages for insert
  with check (
    organization_id = public.current_organization_id()
    and user_id = auth.uid()
    and exists (
      select 1 from public.chat_channels c
      where c.id = channel_id
        and c.organization_id = public.current_organization_id()
    )
  );

-- 00001 granted privileges on tables that existed at the time;
-- tables created by later migrations must be granted explicitly.
-- No anon grant: chat is private organization data.
grant all on table public.chat_channels to authenticated;
grant all on table public.chat_messages to authenticated;

-- ------------------------------------------------------------
-- 5. Replace seed_organization() so NEW organizations get the
--    Chat module, its permissions, and role grants on creation.
--    (Full superset of the 00008 version + chat additions.)
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
    (new.id, 'tasks', 'Tasks', true),
    (new.id, 'chat', 'Chat', true);

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
    (new.id, 'tasks.manage', 'Manage Tasks', 'Create, edit, or delete tasks.', 'tasks'),

    (new.id, 'chat.view', 'View Chat', 'View channels and messages.', 'chat'),
    (new.id, 'chat.manage', 'Manage Chat', 'Create channels and manage chat.', 'chat');

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
      'chat.view', 'chat.manage'
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
      'chat.view'
    );

  -- Default #general channel. chat_channels.created_by is NOT NULL and no
  -- profiles exist for a brand-new organization yet, so this only fires
  -- when members already exist (e.g. re-seeding). New organizations get
  -- their #general channel from the app (lib/actions/onboarding.ts).
  if exists (select 1 from public.profiles where organization_id = new.id) then
    insert into public.chat_channels (organization_id, name, description, created_by)
    select new.id, 'general', 'General discussion for your team.', id
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
-- 6. Backfill for organizations created before this migration
--    (idempotent — safe to re-run).
-- ------------------------------------------------------------

-- Catalog permissions
insert into public.permissions (organization_id, key, name, description, module)
select o.id, 'chat.view', 'View Chat', 'View channels and messages.', 'chat'
from public.organizations o
where not exists (
  select 1 from public.permissions p
  where p.organization_id = o.id and p.key = 'chat.view'
);

insert into public.permissions (organization_id, key, name, description, module)
select o.id, 'chat.manage', 'Manage Chat', 'Create channels and manage chat.', 'chat'
from public.organizations o
where not exists (
  select 1 from public.permissions p
  where p.organization_id = o.id and p.key = 'chat.manage'
);

-- Module row — force-enabled so the Chat module un-gates automatically.
insert into public.organization_modules (organization_id, module_key, module_name, is_enabled)
select o.id, 'chat', 'Chat', true
from public.organizations o
on conflict (organization_id, module_key)
do update set module_name = excluded.module_name, is_enabled = true;

-- Role grants (unique (role_id, permission_id) makes this idempotent).
insert into public.role_permissions (role_id, permission_id, organization_id)
select r.id, p.id, r.organization_id
from public.roles r
join public.permissions p on p.organization_id = r.organization_id
where r.key in ('owner', 'admin', 'manager')
  and p.key in ('chat.view', 'chat.manage')
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id, organization_id)
select r.id, p.id, r.organization_id
from public.roles r
join public.permissions p on p.organization_id = r.organization_id
where r.key = 'employee'
  and p.key = 'chat.view'
on conflict (role_id, permission_id) do nothing;

-- Default #general channel for every existing organization. The creator is
-- that org's oldest member; organizations without members yet get their
-- channel when the first user completes onboarding.
insert into public.chat_channels (organization_id, name, description, created_by)
select o.id, 'general', 'General discussion for your team.', p.id
from public.organizations o
join lateral (
  select id
  from public.profiles
  where organization_id = o.id
  order by created_at
  limit 1
) p on true
on conflict (organization_id, name) do nothing;