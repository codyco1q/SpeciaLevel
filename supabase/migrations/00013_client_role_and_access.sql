-- ============================================================
-- SpeciaLevel — 00013 Restricted Client Role & Portal View
--
-- 1) public.user_has_organization_role(...) — mirrors the 00011
--    user_has_organization_permission helper so RLS policies can
--    branch on "is the caller a Client?" without RLS recursion.
-- 2) Client role: a system role granted ONLY the scoped keys
--    portal.client, tasks.view, chat.view, invoicing.view — no
--    crm.*, settings.*, roles.*, departments.*, or time.*.
-- 3) profiles.contact_id + organization_invitations.contact_id:
--    a Client profile (or pending invite) can be linked to a
--    crm_contact so RLS can scope invoices/tasks to the client's
--    own contact row.
-- 4) Tasks: contact_id + is_client_visible for client-visible
--    deliverables.
-- 5) chat_channel_members: explicit per-channel access for
--    clients, alongside the public #general + #client-project
--    channels.
-- 6) RLS: invoices / invoice_items / tasks / chat_channels /
--    chat_messages keep org-wide visibility for internal roles
--    but are restricted for a Client caller to rows linked to
--    their contact, their membership, or the public client
--    channels. INSERT/UPDATE/DELETE stay org-scoped exactly like
--    every other tenant table (app layer enforces view/manage).
-- 7) seed_organization() replaced (full superset of the 00012
--    version + Client role) AND backfilled for organizations
--    created before this migration.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Helper: does the current user hold a role key inside the
--    given organization? SECURITY DEFINER so RLS on the role
--    tables never blocks this check; search_path pinned.
-- ------------------------------------------------------------
create or replace function public.user_has_organization_role(
  p_organization_id uuid,
  p_role_key text
)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r
      on r.id = ur.role_id
     and r.organization_id = ur.organization_id
    where ur.user_id = auth.uid()
      and ur.organization_id = p_organization_id
      and r.key = p_role_key
  );
$$;

grant execute on function public.user_has_organization_role(uuid, text)
  to authenticated;

-- ------------------------------------------------------------
-- 2. Client <-> CRM contact linkage
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists contact_id uuid;

alter table public.profiles
  add constraint fk_profiles_contact
  foreign key (contact_id) references public.crm_contacts(id) on delete set null;

create index if not exists idx_profiles_contact_id
  on public.profiles(contact_id);

-- Invites created with the Client role can pre-link the contact;
-- acceptInvitation copies it onto the new profile. The contact FK
-- is nullable and the constraint is named for the PostgREST join.
alter table public.organization_invitations
  add column if not exists contact_id uuid;

alter table public.organization_invitations
  add constraint fk_organization_invitations_contact
  foreign key (contact_id) references public.crm_contacts(id) on delete set null;

-- ------------------------------------------------------------
-- 3. Tasks — client-visible deliverables
-- ------------------------------------------------------------
alter table public.tasks
  add column if not exists contact_id uuid;

alter table public.tasks
  add constraint fk_tasks_contact
  foreign key (contact_id) references public.crm_contacts(id) on delete set null;

alter table public.tasks
  add column if not exists is_client_visible boolean not null default false;

create index if not exists idx_tasks_organization_id_contact_id
  on public.tasks(organization_id, contact_id);

create index if not exists idx_tasks_organization_id_client_visible
  on public.tasks(organization_id, is_client_visible);

-- ------------------------------------------------------------
-- 4. chat_channel_members — explicit client channel access
-- ------------------------------------------------------------
create table if not exists public.chat_channel_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  channel_id uuid not null,
  user_id uuid not null,
  added_by uuid,
  created_at timestamptz not null default now(),
  constraint fk_chat_channel_members_organization
    foreign key (organization_id) references public.organizations(id) on delete cascade,
  constraint fk_chat_channel_members_channel
    foreign key (channel_id) references public.chat_channels(id) on delete cascade,
  constraint fk_chat_channel_members_user
    foreign key (user_id) references public.profiles(id) on delete cascade,
  constraint fk_chat_channel_members_added_by
    foreign key (added_by) references public.profiles(id) on delete set null,
  unique (channel_id, user_id)
);

create index if not exists idx_chat_channel_members_user_id
  on public.chat_channel_members(user_id);

create index if not exists idx_chat_channel_members_organization_id
  on public.chat_channel_members(organization_id);
-- ------------------------------------------------------------
-- 5. RLS — client-scoped visibility
-- ------------------------------------------------------------

-- -- invoices / invoice_items ---------------------------------
-- Internal roles: org-wide. Client: only invoices whose contact
-- matches the client profile's linked crm_contact.
drop policy if exists "User can view invoices in their organization"
  on public.invoices;

create policy "User can view invoices in their organization"
  on public.invoices for select
  using (
    organization_id = public.current_organization_id()
    and (
      not public.user_has_organization_role(
        public.current_organization_id(), 'client'
      )
      or contact_id = (
        select p.contact_id
        from public.profiles p
        where p.id = auth.uid()
      )
    )
  );

drop policy if exists "User can view items on their invoices"
  on public.invoice_items;

create policy "User can view items on their invoices"
  on public.invoice_items for select
  using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_id
        and i.organization_id = public.current_organization_id()
        and (
          not public.user_has_organization_role(
            public.current_organization_id(), 'client'
          )
          or i.contact_id = (
            select p.contact_id
            from public.profiles p
            where p.id = auth.uid()
          )
        )
    )
  );

-- -- tasks ------------------------------------------------------
-- Internal roles: org-wide. Client: tasks flagged client-visible,
-- assigned to them, or linked to their crm_contact.
drop policy if exists "User can view tasks in their organization"
  on public.tasks;

create policy "User can view tasks in their organization"
  on public.tasks for select
  using (
    organization_id = public.current_organization_id()
    and (
      not public.user_has_organization_role(
        public.current_organization_id(), 'client'
      )
      or is_client_visible
      or assigned_to = auth.uid()
      or contact_id = (
        select p.contact_id
        from public.profiles p
        where p.id = auth.uid()
      )
    )
  );

-- -- chat_channels / chat_messages -----------------------------
-- Internal roles: org-wide. Client: only #general, #client-project,
-- or channels they are an explicit member of.
drop policy if exists "User can view channels in their organization"
  on public.chat_channels;

create policy "User can view channels in their organization"
  on public.chat_channels for select
  using (
    organization_id = public.current_organization_id()
    and (
      not public.user_has_organization_role(
        public.current_organization_id(), 'client'
      )
      or name in ('general', 'client-project')
      or exists (
        select 1 from public.chat_channel_members m
        where m.channel_id = id
          and m.user_id = auth.uid()
      )
    )
  );

drop policy if exists "User can view messages in their organization"
  on public.chat_messages;

create policy "User can view messages in their organization"
  on public.chat_messages for select
  using (
    organization_id = public.current_organization_id()
    and (
      not public.user_has_organization_role(
        public.current_organization_id(), 'client'
      )
      or exists (
        select 1 from public.chat_channels c
        where c.id = channel_id
          and c.organization_id = public.current_organization_id()
          and (
            c.name in ('general', 'client-project')
            or exists (
              select 1 from public.chat_channel_members m
              where m.channel_id = c.id
                and m.user_id = auth.uid()
            )
          )
      )
    )
  );

-- A Client may only post into channels they can actually read.
drop policy if exists "User can insert messages in their organization"
  on public.chat_messages;

create policy "User can insert messages in their organization"
  on public.chat_messages for insert
  with check (
    organization_id = public.current_organization_id()
    and user_id = auth.uid()
    and exists (
      select 1 from public.chat_channels c
      where c.id = channel_id
        and c.organization_id = public.current_organization_id()
        and (
          not public.user_has_organization_role(
            public.current_organization_id(), 'client'
          )
          or c.name in ('general', 'client-project')
          or exists (
            select 1 from public.chat_channel_members m
            where m.channel_id = c.id
              and m.user_id = auth.uid()
          )
        )
    )
  );

-- chat_channel_members — tenant-scoped CRUD like every other org table.
alter table public.chat_channel_members enable row level security;

create policy "User can view channel members in their organization"
  on public.chat_channel_members for select
  using (organization_id = public.current_organization_id());

create policy "User can add channel members in their organization"
  on public.chat_channel_members for insert
  with check (organization_id = public.current_organization_id());

create policy "User can update channel members in their organization"
  on public.chat_channel_members for update
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

create policy "User can remove channel members in their organization"
  on public.chat_channel_members for delete
  using (organization_id = public.current_organization_id());

-- Tables created by later migrations must be granted explicitly;
-- no anon grant (private org data).
grant all on table public.chat_channel_members to authenticated;
-- ------------------------------------------------------------
-- 6. Replace seed_organization() so NEW organizations get the
--    Client role, portal permission, and scoped grants on
--    creation. (Full superset of the 00012 version.)
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
    (new.id, 'invoicing', 'Invoicing & Billing', true);

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
      'invoicing.view', 'invoicing.manage'
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
      'invoicing.view'
    );
-- Client: scoped portal access ONLY — no CRM, settings, roles,
  -- departments, or time permissions.
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
  -- (lib/actions/onboarding.ts); the client project channel is created
  -- here for re-seeds and backfilled for existing orgs below.
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

-- Catalog permission
insert into public.permissions (organization_id, key, name, description, module)
select o.id, 'portal.client', 'Client Portal', 'Access the client portal views.', 'portal'
from public.organizations o
where not exists (
  select 1 from public.permissions p
  where p.organization_id = o.id and p.key = 'portal.client'
);

-- System Client role
insert into public.roles (organization_id, name, key, description, is_system)
select o.id, 'Client', 'client', 'Client portal access with scoped project views.', true
from public.organizations o
on conflict (organization_id, key) do nothing;

-- Scoped grants (unique (role_id, permission_id) makes this idempotent).
insert into public.role_permissions (role_id, permission_id, organization_id)
select r.id, p.id, r.organization_id
from public.roles r
join public.permissions p on p.organization_id = r.organization_id
where r.key = 'client'
  and p.key in ('portal.client', 'tasks.view', 'chat.view', 'invoicing.view')
on conflict (role_id, permission_id) do nothing;

-- #client-project channel for existing organizations that already have
-- members (created_by is NOT NULL). No rows -> no-op.
insert into public.chat_channels (organization_id, name, description, created_by)
select distinct on (o.id) o.id, 'client-project', 'Client project updates and support.', pr.id
from public.organizations o
join public.profiles pr on pr.organization_id = o.id
order by o.id, pr.created_at
on conflict (organization_id, name) do nothing;
