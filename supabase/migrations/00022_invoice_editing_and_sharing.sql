-- ============================================================
-- SpeciaLevel — 00022 Invoice Editing & Shareable Public Payment
--
-- 1) invoices table additions:
--    - share_token (uuid unique default gen_random_uuid())
--    - is_shareable (boolean not null default true)
-- 2) update_invoice RPC (atomic update + line items replacement)
-- 3) get_public_invoice_by_token RPC (secure public invoice view)
-- ============================================================

-- ------------------------------------------------------------
-- 1. Invoices table additions
-- ------------------------------------------------------------
alter table public.invoices
  add column if not exists share_token uuid not null default gen_random_uuid();

alter table public.invoices
  add column if not exists is_shareable boolean not null default true;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'invoices_share_token_key'
  ) then
    alter table public.invoices
      add constraint invoices_share_token_key unique (share_token);
  end if;
end $$;

create index if not exists idx_invoices_share_token
  on public.invoices(share_token);

-- ------------------------------------------------------------
-- 2. update_invoice atomic RPC
-- ------------------------------------------------------------
create or replace function public.update_invoice(
  p_invoice_id uuid,
  p_contact_id uuid,
  p_due_date date,
  p_notes text,
  p_tax_rate numeric,
  p_items jsonb
)
returns public.invoices
language plpgsql
security definer set search_path = public
as $$
declare
  v_organization_id uuid;
  v_existing public.invoices%rowtype;
  v_subtotal numeric(12, 2) := 0;
  v_tax_amount numeric(12, 2) := 0;
  v_total numeric(12, 2) := 0;
  v_item jsonb;
  v_item_desc text;
  v_item_qty numeric(10, 2);
  v_item_price numeric(12, 2);
  v_item_amount numeric(12, 2);
  v_updated public.invoices%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  v_organization_id := public.current_organization_id();
  if v_organization_id is null then
    raise exception 'no_organization';
  end if;

  if not public.user_has_organization_permission(
    v_organization_id, 'invoicing.manage'
  ) then
    raise exception 'permission_denied';
  end if;

  select * into v_existing
  from public.invoices
  where id = p_invoice_id
    and organization_id = v_organization_id;

  if not found then
    raise exception 'invoice_not_found';
  end if;

  if v_existing.status = 'paid' then
    raise exception 'cannot_edit_paid_invoice';
  end if;

  if p_contact_id is not null then
    if not exists (
      select 1 from public.crm_contacts
      where id = p_contact_id
        and organization_id = v_organization_id
    ) then
      raise exception 'invalid_contact';
    end if;
  end if;

  if p_tax_rate is null or p_tax_rate < 0 or p_tax_rate > 100 then
    raise exception 'invalid_tax_rate';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'items_required';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_item_desc := btrim(coalesce(v_item->>'description', ''));
    if v_item_desc = '' then
      raise exception 'item_description_required';
    end if;

    begin
      v_item_qty := (v_item->>'quantity')::numeric;
      v_item_price := (v_item->>'unit_price')::numeric;
    exception when others then
      raise exception 'invalid_item_numbers';
    end;

    if v_item_qty is null or v_item_qty < 0 or v_item_price is null or v_item_price < 0 then
      raise exception 'invalid_item_values';
    end if;

    v_item_amount := round(v_item_qty * v_item_price, 2);
    v_subtotal := v_subtotal + v_item_amount;
  end loop;

  v_tax_amount := round(v_subtotal * (p_tax_rate / 100), 2);
  v_total := v_subtotal + v_tax_amount;

  update public.invoices
  set
    contact_id = p_contact_id,
    due_date = p_due_date,
    notes = nullif(btrim(coalesce(p_notes, '')), ''),
    tax_rate = p_tax_rate,
    subtotal = v_subtotal,
    tax_amount = v_tax_amount,
    total = v_total,
    updated_at = now()
  where id = p_invoice_id
  returning * into v_updated;

  delete from public.invoice_items
  where invoice_id = p_invoice_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_item_desc := btrim(v_item->>'description');
    v_item_qty := (v_item->>'quantity')::numeric;
    v_item_price := (v_item->>'unit_price')::numeric;
    v_item_amount := round(v_item_qty * v_item_price, 2);

    insert into public.invoice_items (
      invoice_id,
      description,
      quantity,
      unit_price,
      amount
    ) values (
      p_invoice_id,
      v_item_desc,
      v_item_qty,
      v_item_price,
      v_item_amount
    );
  end loop;

  return v_updated;
end;
$$;

grant execute on function public.update_invoice(uuid, uuid, date, text, numeric, jsonb)
  to authenticated;

-- ------------------------------------------------------------
-- 3. get_public_invoice_by_token public lookup RPC
-- ------------------------------------------------------------
create or replace function public.get_public_invoice_by_token(
  p_share_token uuid
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'id', i.id,
    'invoiceNumber', i.invoice_number,
    'status', i.status,
    'currency', i.currency,
    'subtotal', i.subtotal,
    'taxRate', i.tax_rate,
    'taxAmount', i.tax_amount,
    'total', i.total,
    'dueDate', i.due_date,
    'notes', i.notes,
    'createdAt', i.created_at,
    'shareToken', i.share_token,
    'isShareable', i.is_shareable,
    'organizationName', o.name,
    'contact', case
      when c.id is not null then jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'email', c.email,
        'company', c.company,
        'address', c.address
      )
      else null
    end,
    'items', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', it.id,
            'description', it.description,
            'quantity', it.quantity,
            'unitPrice', it.unit_price,
            'amount', it.amount
          ) order by it.id
        )
        from public.invoice_items it
        where it.invoice_id = i.id
      ),
      '[]'::jsonb
    )
  ) into v_result
  from public.invoices i
  join public.organizations o on o.id = i.organization_id
  left join public.crm_contacts c on c.id = i.contact_id
  where i.share_token = p_share_token
    and i.is_shareable = true;

  return v_result;
end;
$$;

grant execute on function public.get_public_invoice_by_token(uuid)
  to anon, authenticated;

