-- ============================================================
-- SpeciaLevel — 00030 Invoice Payment Processor & Stripe Integration
--
-- 1) Extends public.invoices with payment processor tracking:
--    - payment_provider ('manual', 'stripe', 'bank_transfer')
--    - payment_intent_id (nullable text for Stripe PaymentIntent ID)
--    - paid_at (nullable timestamptz)
-- 2) Adds indexes on payment_intent_id and share_token
-- 3) mark_invoice_as_paid_by_provider RPC (atomic status & payment metadata update)
-- 4) Updates get_public_invoice_by_token RPC to include payment processor details
-- ============================================================

-- ------------------------------------------------------------
-- 1. Table alterations
-- ------------------------------------------------------------
alter table public.invoices
  add column if not exists payment_provider text not null default 'manual'
    check (payment_provider in ('manual', 'stripe', 'bank_transfer')),
  add column if not exists payment_intent_id text,
  add column if not exists paid_at timestamptz;

-- ------------------------------------------------------------
-- 2. Indexes
-- ------------------------------------------------------------
create index if not exists idx_invoices_payment_intent_id
  on public.invoices (payment_intent_id)
  where payment_intent_id is not null;

create index if not exists idx_invoices_share_token
  on public.invoices (share_token)
  where share_token is not null;

-- ------------------------------------------------------------
-- 3. mark_invoice_as_paid_by_provider RPC
-- ------------------------------------------------------------
create or replace function public.mark_invoice_as_paid_by_provider(
  p_invoice_id uuid,
  p_provider text default 'stripe',
  p_intent_id text default null
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_invoice record;
begin
  if p_provider not in ('manual', 'stripe', 'bank_transfer') then
    raise exception 'invalid payment provider: %', p_provider;
  end if;

  update public.invoices
  set
    status = 'paid',
    paid_at = coalesce(paid_at, now()),
    payment_provider = p_provider,
    payment_intent_id = coalesce(p_intent_id, payment_intent_id),
    updated_at = now()
  where id = p_invoice_id
  returning id, invoice_number, organization_id, total, currency, status, payment_provider, payment_intent_id, paid_at
  into v_invoice;

  if v_invoice.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_invoice.id,
    'invoiceNumber', v_invoice.invoice_number,
    'organizationId', v_invoice.organization_id,
    'total', v_invoice.total,
    'currency', v_invoice.currency,
    'status', v_invoice.status,
    'paymentProvider', v_invoice.payment_provider,
    'paymentIntentId', v_invoice.payment_intent_id,
    'paidAt', v_invoice.paid_at
  );
end;
$$;

grant execute on function public.mark_invoice_as_paid_by_provider(uuid, text, text)
  to anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 4. Update get_public_invoice_by_token RPC
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
    'organizationId', i.organization_id,
    'invoiceNumber', i.invoice_number,
    'status', i.status,
    'currency', i.currency,
    'subtotal', i.subtotal,
    'taxRate', i.tax_rate,
    'taxAmount', i.tax_amount,
    'total', i.total,
    'dueDate', i.due_date,
    'notes', i.notes,
    'paymentProvider', i.payment_provider,
    'paymentIntentId', i.payment_intent_id,
    'paidAt', i.paid_at,
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
  to anon, authenticated, service_role;
