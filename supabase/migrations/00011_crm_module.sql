-- ============================================================
-- SpeciaLevel — 00011 CRM Pipeline & Inbound Lead Bridge
--
-- 1) public.crm_contacts — organization-scoped people records
--    linked to deals.
-- 2) public.crm_deals — pipeline deals with a sales stage,
--    a value + currency, an optional contact link, and an
--    optional assignee.
-- 3) public.marketing_leads — the public lead-capture bridge.
--    The marketing site's contact form writes here (via the
--    service-role client) so authenticated users holding
--    `crm.manage` can review and convert website inquiries.
-- 4) RLS:
--      crm_contacts / crm_deals — isolated through
--        current_organization_id() like every tenant table.
--      marketing_leads — INSERT open to anon/authenticated
--        (public lead capture); SELECT/UPDATE restricted to
--        members who hold crm.manage in their organization.
-- 5) Catalog permissions crm.view / crm.manage, an enabled
--    `crm` row in organization_modules, and the role grant
--    matrix (Owner/Admin/Manager = view+manage, Employee =
--    view) — baked into the seed function AND backfilled for
--    organizations created before this migration.
-- ============================================================

-- ------------------------------------------------------------
-- 1. crm_contacts
-- ------------------------------------------------------------
create table if not exists public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  name text not null,
  email text not null,
  company text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_crm_contacts_organization
    foreign key (organization_id) references public.organizations(id) on delete cascade
);

create index if not exists idx_crm_contacts_organization_id
  on public.crm_contacts(organization_id);

-- ------------------------------------------------------------
-- 2. crm_deals
-- ------------------------------------------------------------
create table if not exists public.crm_deals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  contact_id uuid,
  title text not null,
  value numeric not null default 0,
  currency text not null default 'USD',
  stage text not null default 'lead',
  notes text,
  assigned_to uuid,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_crm_deals_organization
    foreign key (organization_id) references public.organizations(id) on delete cascade,
  constraint fk_crm_deals_contact
    foreign key (contact_id) references public.crm_contacts(id) on delete cascade,
  constraint fk_crm_deals_assigned_to
    foreign key (assigned_to) references public.profiles(id) on delete set null,
  constraint fk_crm_deals_created_by
    foreign key (created_by) references public.profiles(id) on delete cascade,
  constraint chk_crm_deals_stage
    check (stage in ('lead', 'contacted', 'proposal', 'won', 'lost')),
  constraint chk_crm_deals_value
    check (value >= 0),
  constraint chk_crm_deals_currency
    check (currency ~ '^[A-Z]{3}$')
);

create index if not exists idx_crm_deals_organization_id
  on public.crm_deals(organization_id);

create index if not exists idx_crm_deals_organization_stage
  on public.crm_deals(organization_id, stage);

-- ------------------------------------------------------------
-- 3. marketing_leads
-- ------------------------------------------------------------
create table if not exists public.marketing_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  company text,
  bottleneck text,
  package_of_interest text,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  constraint chk_marketing_leads_status
    check (status in ('new', 'contacted', 'converted', 'archived'))
);

create index if not exists idx_marketing_leads_created_at
  on public.marketing_leads(created_at desc);

-- ------------------------------------------------------------
-- 4. RLS
-- ------------------------------------------------------------

-- Helper: does the current user hold a permission key inside the
-- given organization? SECURITY DEFINER so RLS on the role tables
-- never blocks this check, and search_path is pinned to public.
create or replace function public.user_has_organization_permission(
  p_organization_id uuid,
  p_key text
)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp
      on rp.role_id = ur.role_id
     and rp.organization_id = ur.organization_id
    join public.permissions p
      on p.id = rp.permission_id
     and p.organization_id = ur.organization_id
    where ur.user_id = auth.uid()
      and ur.organization_id = p_organization_id
      and p.key = p_key
  );
$$;

alter table public.crm_contacts enable row level security;
alter table public.crm_deals enable row level security;
alter table public.marketing_leads enable row level security;

-- crm_contacts — tenant-scoped CRUD like every other org table.
create policy "User can view contacts in their organization"
  on public.crm_contacts for select
  using (organization_id = public.current_organization_id());

create policy "User can create contacts in their organization"
  on public.crm_contacts for insert
  with check (organization_id = public.current_organization_id());

create policy "User can update contacts in their organization"
  on public.crm_contacts for update
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

create policy "User can delete contacts in their organization"
  on public.crm_contacts for delete
  using (organization_id = public.current_organization_id());

-- crm_deals — tenant-scoped; creators must be authenticated users.
create policy "User can view deals in their organization"
  on public.crm_deals for select
  using (organization_id = public.current_organization_id());

create policy "User can create deals in their organization"
  on public.crm_deals for insert
  with check (
    organization_id = public.current_organization_id()
    and created_by = auth.uid()
  );

create policy "User can update deals in their organization"
  on public.crm_deals for update
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

create policy "User can delete deals in their organization"
  on public.crm_deals for delete
  using (organization_id = public.current_organization_id());

-- marketing_leads — public submissions welcome, but only CRM
-- managers may read or change existing leads.
create policy "Anyone can submit marketing leads"
  on public.marketing_leads for insert
  to anon, authenticated
  with check (true);

create policy "CRM managers can view marketing leads"
  on public.marketing_leads for select
  using (
    public.user_has_organization_permission(
      public.current_organization_id(),
      'crm.manage'
    )
  );

create policy "CRM managers can update marketing leads"
  on public.marketing_leads for update
  using (
    public.user_has_organization_permission(
      public.current_organization_id(),
      'crm.manage'
    )
  )
  with check (
    public.user_has_organization_permission(
      public.current_organization_id(),
      'crm.manage'
    )
  );

-- ------------------------------------------------------------
-- 5. Grants
--    00001 granted privileges on tables that existed at the time;
--    tables created by later migrations must be granted
--    explicitly. Contacts/deals are private org data (no anon
--    grant); leads are anon-insertable by design.
-- ------------------------------------------------------------
grant all on table public.crm_contacts to authenticated;
grant all on table public.crm_deals to authenticated;

grant all on table public.marketing_leads to authenticated;
grant insert on table public.marketing_leads to anon;

-- ------------------------------------------------------------
-- 6. Keep updated_at current on CRM rows
-- ------------------------------------------------------------
create trigger trigger_set_updated_at_crm_contacts
  before update on public.crm_contacts
  for each row execute procedure public.set_updated_at();

create trigger trigger_set_updated_at_crm_deals
  before update on public.crm_deals
  for each row execute procedure public.set_updated_at();

-- ------------------------------------------------------------
-- 7. Replace seed_organization() so NEW organizations get the
--    CRM module, its permissions, and role grants on creation.
--    (Full superset of the 00009 version + CRM additions.)
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
    (new.id, 'chat', 'Chat', true),
    (new.id, 'crm', 'CRM', true);

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
    (new.id, 'chat.manage', 'Manage Chat', 'Create channels and manage chat.', 'chat'),

    (new.id, 'crm.view', 'View CRM', 'View deals, contacts, and inbound leads.', 'crm'),
    (new.id, 'crm.manage', 'Manage CRM', 'Create and edit deals and convert inbound leads.', 'crm');

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
      'crm.view', 'crm.manage'
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
      'crm.view'
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
-- 8. Backfill for organizations created before this migration
--    (idempotent — safe to re-run).
-- ------------------------------------------------------------

-- Catalog permissions
insert into public.permissions (organization_id, key, name, description, module)
select o.id, 'crm.view', 'View CRM', 'View deals, contacts, and inbound leads.', 'crm'
from public.organizations o
where not exists (
  select 1 from public.permissions p
  where p.organization_id = o.id and p.key = 'crm.view'
);

insert into public.permissions (organization_id, key, name, description, module)
select o.id, 'crm.manage', 'Manage CRM', 'Create and edit deals and convert inbound leads.', 'crm'
from public.organizations o
where not exists (
  select 1 from public.permissions p
  where p.organization_id = o.id and p.key = 'crm.manage'
);

-- Module row — force-enabled so the CRM module un-gates automatically.
insert into public.organization_modules (organization_id, module_key, module_name, is_enabled)
select o.id, 'crm', 'CRM', true
from public.organizations o
on conflict (organization_id, module_key)
do update set module_name = excluded.module_name, is_enabled = true;

-- Role grants (unique (role_id, permission_id) makes this idempotent).
insert into public.role_permissions (role_id, permission_id, organization_id)
select r.id, p.id, r.organization_id
from public.roles r
join public.permissions p on p.organization_id = r.organization_id
where r.key in ('owner', 'admin', 'manager')
  and p.key in ('crm.view', 'crm.manage')
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id, organization_id)
select r.id, p.id, r.organization_id
from public.roles r
join public.permissions p on p.organization_id = r.organization_id
where r.key = 'employee'
  and p.key = 'crm.view'
on conflict (role_id, permission_id) do nothing;