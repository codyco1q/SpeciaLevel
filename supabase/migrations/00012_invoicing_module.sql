-- ============================================================
-- SpeciaLevel — 00012 Invoicing & Billing Module
--
-- 1) public.invoices — organization-scoped billing records with a
--    per-organization invoice number ('INV-0001'), an optional CRM
--    contact/deal link, monetary totals (subtotal / tax / total),
--    and a lifecycle status (draft / sent / paid / overdue /
--    cancelled).
-- 2) public.invoice_items — line items owned by an invoice, with
--    per-line amount computed as quantity * unit_price.
-- 3) public.create_invoice(...) — an atomic SECURITY DEFINER helper
--    that validates the caller holds `invoicing.manage`, generates
--    the next invoice number without races (advisory lock),
--    recomputes all totals server-side, and inserts the invoice +
--    its line items in a single transaction.
-- 4) RLS: both tables are isolated through current_organization_id()
--    exactly like every other tenant table (invoice_items via their
--    parent invoice's organization). The app layer enforces
--    invoicing.view / invoicing.manage; the DB keeps the standard
--    org-scoped policy shape used across the codebase.
-- 5) Catalog permissions invoicing.view / invoicing.manage, an
--    enabled `invoicing` row in organization_modules, and the role
--    grant matrix (Owner/Admin/Manager = view+manage, Employee =
--    view) — baked into the seed function AND backfilled for
--    organizations created before this migration.
-- ============================================================

-- ------------------------------------------------------------
-- 1. invoices
-- ------------------------------------------------------------
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  invoice_number text not null,
  contact_id uuid,
  deal_id uuid,
  status text not null default 'draft',
  currency text not null default 'USD',
  subtotal numeric(12, 2) not null default 0,
  tax_rate numeric(5, 2) not null default 0,
  tax_amount numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  due_date date,
  notes text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_invoices_organization
    foreign key (organization_id) references public.organizations(id) on delete cascade,
  constraint fk_invoices_contact
    foreign key (contact_id) references public.crm_contacts(id) on delete set null,
  constraint fk_invoices_deal
    foreign key (deal_id) references public.crm_deals(id) on delete set null,
  constraint fk_invoices_created_by
    foreign key (created_by) references public.profiles(id) on delete cascade,
  constraint uq_invoices_organization_number
    unique (organization_id, invoice_number),
  constraint chk_invoices_status
    check (status in ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  constraint chk_invoices_currency
    check (currency ~ '^[A-Z]{3}$'),
  constraint chk_invoices_amounts
    check (
      subtotal >= 0 and tax_rate >= 0 and tax_amount >= 0 and total >= 0
    )
);

create index if not exists idx_invoices_organization_id
  on public.invoices(organization_id);

create index if not exists idx_invoices_organization_status
  on public.invoices(organization_id, status);

create index if not exists idx_invoices_due_date
  on public.invoices(due_date);

-- ------------------------------------------------------------
-- 2. invoice_items
-- ------------------------------------------------------------
create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null,
  description text not null,
  quantity numeric(10, 2) not null default 1,
  unit_price numeric(12, 2) not null default 0,
  amount numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  constraint fk_invoice_items_invoice
    foreign key (invoice_id) references public.invoices(id) on delete cascade,
  constraint chk_invoice_items_quantity
    check (quantity >= 0),
  constraint chk_invoice_items_unit_price
    check (unit_price >= 0),
  constraint chk_invoice_items_amount
    check (amount >= 0)
);

create index if not exists idx_invoice_items_invoice_id
  on public.invoice_items(invoice_id);

-- ------------------------------------------------------------
-- 3. create_invoice — atomic invoice + items, totals computed
--    server-side, race-free invoice number, permission checked.
--    SECURITY DEFINER so PostgREST can write the invoice and its
--    items in ONE transaction; the caller's `invoicing.manage`
--    grant is verified inside the function (the org-scoped RLS
--    policies cover every other read/write path).
-- ------------------------------------------------------------
create or replace function public.create_invoice(
  p_contact_id uuid,
  p_deal_id uuid,
  p_due_date date,
  p_currency text,
  p_tax_rate numeric,
  p_notes text,
  p_items jsonb
)
returns public.invoices
language plpgsql
security definer set search_path = public
as $$
declare
  v_organization_id uuid;
  v_seq integer;
  v_invoice_number text;
  v_subtotal numeric(12, 2) := 0;
  v_tax_amount numeric(12, 2);
  v_total numeric(12, 2);
  v_invoice public.invoices%rowtype;
  v_item jsonb;
  v_description text;
  v_quantity numeric(10, 2);
  v_unit_price numeric(12, 2);
begin
  if auth.uid() is null then
    raise exception 'signed_in_required';
  end if;

  v_organization_id := public.current_organization_id();
  if v_organization_id is null then
    raise exception 'no_organization';
  end if;

  if not public.user_has_organization_permission(
    v_organization_id, 'invoicing.manage'
  ) then
    raise exception 'no_permission';
  end if;

  -- Shape checks
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'invalid_items';
  end if;
  if jsonb_array_length(p_items) < 1 then
    raise exception 'items_required';
  end if;
  if p_tax_rate < 0 or p_tax_rate > 100 then
    raise exception 'invalid_tax_rate';
  end if;
  if btrim(coalesce(p_currency, '')) !~ '^[A-Z]{3}$' then
    raise exception 'invalid_currency';
  end if;

  -- Race-free per-organization invoice numbering. The advisory lock
  -- serializes concurrent creates so two invoices can never claim the
  -- same number (the unique constraint backstops it).
  perform pg_advisory_xact_lock(
    hashtext('specialevel_invoice_number:' || v_organization_id::text)
  );

  select coalesce(
    max(substring(invoice_number from 'INV-([0-9]+)$')::int),
    0
  )
  into v_seq
  from public.invoices
  where organization_id = v_organization_id
    and invoice_number ~ '^INV-[0-9]+$';

  v_invoice_number := 'INV-' || lpad((v_seq + 1)::text, 4, '0');

  -- Validate every line item and accumulate the subtotal.
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_description := btrim(coalesce(v_item->>'description', ''));
    if v_description = '' then
      raise exception 'invalid_item_description';
    end if;
    if length(v_description) > 500 then
      raise exception 'invalid_item_description';
    end if;

    begin
      v_quantity := coalesce((v_item->>'quantity')::numeric(10, 2), 0);
      v_unit_price := coalesce((v_item->>'unit_price')::numeric(12, 2), 0);
    exception when others then
      raise exception 'invalid_item_number';
    end;

    if v_quantity < 0 or v_unit_price < 0 then
      raise exception 'invalid_item_number';
    end if;

    v_subtotal := v_subtotal + round(v_quantity * v_unit_price, 2);
  end loop;

  v_tax_amount := round(v_subtotal * p_tax_rate / 100, 2);
  v_total := v_subtotal + v_tax_amount;

  insert into public.invoices (
    organization_id,
    invoice_number,
    contact_id,
    deal_id,
    status,
    currency,
    subtotal,
    tax_rate,
    tax_amount,
    total,
    due_date,
    notes,
    created_by
  )
  values (
    v_organization_id,
    v_invoice_number,
    p_contact_id,
    p_deal_id,
    'draft',
    upper(p_currency),
    v_subtotal,
    p_tax_rate,
    v_tax_amount,
    v_total,
    p_due_date,
    nullif(btrim(coalesce(p_notes, '')), ''),
    auth.uid()
  )
  returning * into v_invoice;

  insert into public.invoice_items (
    invoice_id,
    description,
    quantity,
    unit_price,
    amount
  )
  select
    v_invoice.id,
    btrim(item->>'description'),
    (item->>'quantity')::numeric(10, 2),
    (item->>'unit_price')::numeric(12, 2),
    round((item->>'quantity')::numeric * (item->>'unit_price')::numeric, 2)
  from jsonb_array_elements(p_items) as item;

  return v_invoice;
end;
$$;

grant execute on function public.create_invoice(uuid, uuid, date, text, numeric, text, jsonb)
  to authenticated;

-- ------------------------------------------------------------
-- 4. RLS
-- ------------------------------------------------------------
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;

-- invoices — tenant-scoped CRUD like every other org table.
create policy "User can view invoices in their organization"
  on public.invoices for select
  using (organization_id = public.current_organization_id());

create policy "User can create invoices in their organization"
  on public.invoices for insert
  with check (
    organization_id = public.current_organization_id()
    and created_by = auth.uid()
  );

create policy "User can update invoices in their organization"
  on public.invoices for update
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

create policy "User can delete invoices in their organization"
  on public.invoices for delete
  using (organization_id = public.current_organization_id());

-- invoice_items — isolated through their parent invoice's
-- organization (RLS resolves the join with the current user's own
-- SELECT policy, so cross-tenant rows can never leak).
create policy "User can view items on their invoices"
  on public.invoice_items for select
  using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_id
        and i.organization_id = public.current_organization_id()
    )
  );

create policy "User can add items to their invoices"
  on public.invoice_items for insert
  with check (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_id
        and i.organization_id = public.current_organization_id()
    )
  );

create policy "User can update items on their invoices"
  on public.invoice_items for update
  using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_id
        and i.organization_id = public.current_organization_id()
    )
  )
  with check (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_id
        and i.organization_id = public.current_organization_id()
    )
  );

create policy "User can delete items on their invoices"
  on public.invoice_items for delete
  using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_id
        and i.organization_id = public.current_organization_id()
    )
  );

-- ------------------------------------------------------------
-- 5. Grants
--    00001 granted privileges on tables that existed at the time;
--    tables created by later migrations must be granted
--    explicitly. Invoices are private org data (no anon grant).
-- ------------------------------------------------------------
grant all on table public.invoices to authenticated;
grant all on table public.invoice_items to authenticated;

-- ------------------------------------------------------------
-- 6. Keep updated_at current on invoices
-- ------------------------------------------------------------
create trigger trigger_set_updated_at_invoices
  before update on public.invoices
  for each row execute procedure public.set_updated_at();

-- ------------------------------------------------------------
-- 7. Replace seed_organization() so NEW organizations get the
--    Invoicing module, its permissions, and role grants on
--    creation. (Full superset of the 00011 version + invoicing
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
    (new.id, 'crm.manage', 'Manage CRM', 'Create and edit deals and convert inbound leads.', 'crm'),

    (new.id, 'invoicing.view', 'View Invoicing', 'View invoices and billing.', 'invoicing'),
    (new.id, 'invoicing.manage', 'Manage Invoicing', 'Create, send, and update invoices.', 'invoicing');

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
select o.id, 'invoicing.view', 'View Invoicing', 'View invoices and billing.', 'invoicing'
from public.organizations o
where not exists (
  select 1 from public.permissions p
  where p.organization_id = o.id and p.key = 'invoicing.view'
);

insert into public.permissions (organization_id, key, name, description, module)
select o.id, 'invoicing.manage', 'Manage Invoicing', 'Create, send, and update invoices.', 'invoicing'
from public.organizations o
where not exists (
  select 1 from public.permissions p
  where p.organization_id = o.id and p.key = 'invoicing.manage'
);

-- Module row — force-enabled so the Invoicing module un-gates automatically.
insert into public.organization_modules (organization_id, module_key, module_name, is_enabled)
select o.id, 'invoicing', 'Invoicing & Billing', true
from public.organizations o
on conflict (organization_id, module_key)
do update set module_name = excluded.module_name, is_enabled = true;

-- Role grants (unique (role_id, permission_id) makes this idempotent).
insert into public.role_permissions (role_id, permission_id, organization_id)
select r.id, p.id, r.organization_id
from public.roles r
join public.permissions p on p.organization_id = r.organization_id
where r.key in ('owner', 'admin', 'manager')
  and p.key in ('invoicing.view', 'invoicing.manage')
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id, organization_id)
select r.id, p.id, r.organization_id
from public.roles r
join public.permissions p on p.organization_id = r.organization_id
where r.key = 'employee'
  and p.key = 'invoicing.view'
on conflict (role_id, permission_id) do nothing;