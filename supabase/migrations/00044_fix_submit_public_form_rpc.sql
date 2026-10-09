-- SpeciaLevel — 00044 Fix submit_public_form RPC column reference
--
-- Replaces is_active = true with is_published = true for inbound_forms table

create or replace function public.submit_public_form(
  p_form_slug text,
  p_submission_data jsonb,
  p_ip_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $_$
declare
  v_form record;
  v_contact_id uuid;
  v_deal_id uuid;
  v_submission_id uuid;
  v_auto_create_contact boolean;
  v_auto_create_deal boolean;
  v_deal_stage text;
  v_deal_value numeric;
  v_deal_title text;
  v_email text;
  v_name text;
  v_phone text;
  v_company text;
begin
  -- 1. Fetch form
  select * into v_form
  from public.inbound_forms
  where slug = p_form_slug
    and is_published = true;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Form not found or inactive');
  end if;

  -- Extract common lead fields if present
  v_email := lower(btrim(coalesce(
    p_submission_data->>'email',
    p_submission_data->>'work_email',
    p_submission_data->>'client_email',
    ''
  )));

  v_name := coalesce(
    p_submission_data->>'name',
    p_submission_data->>'full_name',
    p_submission_data->>'client_name',
    ''
  );

  v_phone := coalesce(
    p_submission_data->>'phone',
    p_submission_data->>'phone_number',
    p_submission_data->>'mobile',
    ''
  );

  v_company := coalesce(
    p_submission_data->>'company',
    p_submission_data->>'company_name',
    p_submission_data->>'organization',
    ''
  );

  -- 2. Auto-create Contact if configured and email is provided
  v_auto_create_contact := coalesce((v_form.settings->>'auto_create_contact')::boolean, true);
  if v_auto_create_contact and v_email <> '' then
    select id into v_contact_id
    from public.crm_contacts
    where organization_id = v_form.organization_id
      and lower(email) = v_email
    limit 1;

    if v_contact_id is not null then
      update public.crm_contacts
      set
        name = coalesce(nullif(btrim(v_name), ''), name),
        phone = coalesce(nullif(btrim(v_phone), ''), phone),
        company = coalesce(nullif(btrim(v_company), ''), company),
        updated_at = now()
      where id = v_contact_id;
    else
      insert into public.crm_contacts (
        organization_id,
        name,
        email,
        company,
        phone
      )
      values (
        v_form.organization_id,
        coalesce(nullif(btrim(v_name), ''), 'New Lead'),
        v_email,
        nullif(btrim(v_company), ''),
        nullif(btrim(v_phone), '')
      )
      returning id into v_contact_id;
    end if;
  end if;

  -- 3. Auto-create Deal if configured
  v_auto_create_deal := coalesce((v_form.settings->>'auto_create_deal')::boolean, false);
  if v_auto_create_deal then
    v_deal_stage := coalesce(v_form.settings->>'default_deal_stage', 'lead');
    if v_deal_stage not in ('lead', 'contacted', 'proposal', 'won', 'lost') then
      v_deal_stage := 'lead';
    end if;

    v_deal_value := coalesce((v_form.settings->>'default_deal_value')::numeric, 0);
    if v_deal_value < 0 then
      v_deal_value := 0;
    end if;

    v_deal_title := coalesce(
      nullif(btrim(v_name), ''),
      nullif(btrim(v_company), ''),
      'New Lead'
    ) || ' - ' || v_form.title;

    insert into public.crm_deals (
      organization_id,
      contact_id,
      title,
      value,
      currency,
      stage,
      notes,
      created_by
    )
    values (
      v_form.organization_id,
      v_contact_id,
      v_deal_title,
      v_deal_value,
      'USD',
      v_deal_stage,
      'Captured via public inbound form: ' || v_form.title,
      v_form.created_by
    )
    returning id into v_deal_id;
  end if;

  -- 4. Insert Submission record
  insert into public.inbound_form_submissions (
    form_id,
    organization_id,
    data,
    contact_id,
    deal_id,
    ip_hash
  )
  values (
    v_form.id,
    v_form.organization_id,
    p_submission_data,
    v_contact_id,
    v_deal_id,
    p_ip_hash
  )
  returning id into v_submission_id;

  -- 5. Increment counter
  update public.inbound_forms
  set submissions_count = submissions_count + 1,
      updated_at = now()
  where id = v_form.id;

  return jsonb_build_object(
    'success', true,
    'submission_id', v_submission_id,
    'form_id', v_form.id,
    'form_title', v_form.title,
    'organization_id', v_form.organization_id,
    'created_by', v_form.created_by,
    'lead_name', coalesce(nullif(btrim(v_name), ''), 'New Lead'),
    'lead_email', nullif(btrim(v_email), ''),
    'lead_phone', nullif(btrim(v_phone), ''),
    'contact_id', v_contact_id,
    'deal_id', v_deal_id,
    'redirect_url', v_form.settings->>'redirect_url',
    'success_message', v_form.settings->>'success_message'
  );
end;
$_$;

grant execute on function public.submit_public_form(text, jsonb, text) to anon, authenticated, service_role;
