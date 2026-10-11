-- ============================================================
-- UpLevel — 00045 Products Catalog & Line Item Title
-- Milestone 2: Products Management & Line Item Title/Description
-- ============================================================

-- 1. Add title column to invoice_items
alter table public.invoice_items
  add column if not exists title text default '';

-- 2. Create products table for reusable line items
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text not null default '',
  unit_price numeric(12, 2) not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_products_unit_price check (unit_price >= 0)
);

create index if not exists idx_products_organization_id
  on public.products(organization_id);

create index if not exists idx_products_created_at
  on public.products(created_at desc);

-- 3. Enable RLS on products table
alter table public.products enable row level security;

drop policy if exists "User can view products in their organization" on public.products;
create policy "User can view products in their organization"
  on public.products for select
  using (organization_id = public.current_organization_id());

drop policy if exists "User can add products in their organization" on public.products;
create policy "User can add products in their organization"
  on public.products for insert
  with check (organization_id = public.current_organization_id());

drop policy if exists "User can update products in their organization" on public.products;
create policy "User can update products in their organization"
  on public.products for update
  using (organization_id = public.current_organization_id());

drop policy if exists "User can delete products in their organization" on public.products;
create policy "User can delete products in their organization"
  on public.products for delete
  using (organization_id = public.current_organization_id());

grant all on table public.products to authenticated;

-- 4. Update create_invoice to support title and description
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
  v_title text;
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

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_title := btrim(coalesce(v_item->>'title', ''));
    v_description := btrim(coalesce(v_item->>'description', ''));
    if v_title = '' and v_description = '' then
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
    title,
    description,
    quantity,
    unit_price,
    amount
  )
  select
    v_invoice.id,
    coalesce(nullif(btrim(item->>'title'), ''), coalesce(nullif(btrim(item->>'description'), ''), '')),
    coalesce(nullif(btrim(item->>'description'), ''), ''),
    (item->>'quantity')::numeric(10, 2),
    (item->>'unit_price')::numeric(12, 2),
    round((item->>'quantity')::numeric * (item->>'unit_price')::numeric, 2)
  from jsonb_array_elements(p_items) as item;

  return v_invoice;
end;
$$;

grant execute on function public.create_invoice(uuid, uuid, date, text, numeric, text, jsonb)
  to authenticated;

-- 5. Update update_invoice to support title and description
create or replace function public.update_invoice(
  p_invoice_id uuid,
  p_contact_id uuid,
  p_due_date date,
  p_tax_rate numeric,
  p_notes text,
  p_items jsonb
)
returns public.invoices
language plpgsql
security definer set search_path = public
as $$
declare
  v_inv public.invoices%rowtype;
  v_updated public.invoices%rowtype;
  v_subtotal numeric(12, 2) := 0;
  v_tax_amount numeric(12, 2);
  v_total numeric(12, 2);
  v_item jsonb;
  v_title text;
  v_desc text;
  v_qty numeric;
  v_price numeric;
  v_amount numeric(12, 2);
begin
  if auth.uid() is null then
    raise exception 'signed_in_required';
  end if;

  select * into v_inv
  from public.invoices
  where id = p_invoice_id
    and organization_id = public.current_organization_id();

  if not found then
    raise exception 'invoice_not_found';
  end if;

  if not public.user_has_organization_permission(
    v_inv.organization_id, 'invoicing.manage'
  ) then
    raise exception 'no_permission';
  end if;

  if v_inv.status = 'paid' then
    raise exception 'cannot_edit_paid_invoice';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 then
    raise exception 'items_required';
  end if;

  if p_tax_rate < 0 or p_tax_rate > 100 then
    raise exception 'invalid_tax_rate';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_title := btrim(coalesce(v_item->>'title', ''));
    v_desc := btrim(coalesce(v_item->>'description', ''));
    if v_title = '' and v_desc = '' then
      raise exception 'invalid_item_description';
    end if;

    begin
      v_qty := (v_item->>'quantity')::numeric;
      v_price := (v_item->>'unit_price')::numeric;
    exception when others then
      raise exception 'invalid_item_number';
    end;

    if v_qty < 0 or v_price < 0 then
      raise exception 'invalid_item_number';
    end if;

    v_subtotal := v_subtotal + round(v_qty * v_price, 2);
  end loop;

  v_tax_amount := round(v_subtotal * p_tax_rate / 100, 2);
  v_total := v_subtotal + v_tax_amount;

  update public.invoices
  set
    contact_id = p_contact_id,
    due_date = p_due_date,
    tax_rate = p_tax_rate,
    subtotal = v_subtotal,
    tax_amount = v_tax_amount,
    total = v_total,
    notes = nullif(btrim(coalesce(p_notes, '')), ''),
    updated_at = now()
  where id = p_invoice_id
  returning * into v_updated;

  delete from public.invoice_items
  where invoice_id = p_invoice_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_title := coalesce(nullif(btrim(v_item->>'title'), ''), coalesce(nullif(btrim(v_item->>'description'), ''), ''));
    v_desc := coalesce(nullif(btrim(v_item->>'description'), ''), '');
    v_qty := (v_item->>'quantity')::numeric;
    v_price := (v_item->>'unit_price')::numeric;
    v_amount := round(v_qty * v_price, 2);

    insert into public.invoice_items (
      invoice_id,
      title,
      description,
      quantity,
      unit_price,
      amount
    ) values (
      p_invoice_id,
      v_title,
      v_desc,
      v_qty,
      v_price,
      v_amount
    );
  end loop;

  return v_updated;
end;
$$;

grant execute on function public.update_invoice(uuid, uuid, date, numeric, text, jsonb)
  to authenticated;
