-- ============================================================
-- SpeciaLevel — 00029 System Notifications & Unified Event Dispatcher
--
-- 1) public.system_notifications — in-app notifications
-- 2) RLS & Indexes for fast querying per user and organization
-- 3) Enhanced book_public_appointment RPC return payload
-- 4) Enhanced submit_public_form RPC return payload
-- ============================================================

-- ------------------------------------------------------------
-- 1. system_notifications table
-- ------------------------------------------------------------
create table if not exists public.system_notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null default 'info',
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  constraint chk_system_notifications_type check (
    type in ('info', 'success', 'warning', 'lead', 'booking', 'invoice')
  )
);

-- ------------------------------------------------------------
-- 2. Indexes
-- ------------------------------------------------------------
create index if not exists idx_system_notifications_org_user_read
  on public.system_notifications (organization_id, user_id, is_read);

create index if not exists idx_system_notifications_user_created
  on public.system_notifications (user_id, created_at desc);

-- ------------------------------------------------------------
-- 3. Row Level Security
-- ------------------------------------------------------------
alter table public.system_notifications enable row level security;

create policy "Users can view their own notifications in their organization"
  on public.system_notifications for select
  using (
    organization_id = public.current_organization_id()
    and user_id = auth.uid()
  );

create policy "Users can update their own notifications"
  on public.system_notifications for update
  using (
    organization_id = public.current_organization_id()
    and user_id = auth.uid()
  )
  with check (
    organization_id = public.current_organization_id()
    and user_id = auth.uid()
  );

-- ------------------------------------------------------------
-- 4. Update book_public_appointment RPC to return org & host IDs
-- ------------------------------------------------------------
create or replace function public.book_public_appointment(
  p_booking_profile_id uuid,
  p_client_name text,
  p_client_email text,
  p_client_phone text default null,
  p_notes text default null,
  p_start_time timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $_$
declare
  v_profile record;
  v_host record;
  v_org record;
  v_end_time timestamptz;
  v_overlap_count int;
  v_contact_id uuid;
  v_deal_id uuid;
  v_appointment_id uuid;
  v_deal_title text;
begin
  -- 1. Validate inputs
  if p_client_name is null or trim(p_client_name) = '' then
    return jsonb_build_object('success', false, 'error', 'Client name is required');
  end if;

  if p_client_email is null or trim(p_client_email) = '' or p_client_email not like '%@%.%' then
    return jsonb_build_object('success', false, 'error', 'Valid client email is required');
  end if;

  if p_start_time is null then
    return jsonb_build_object('success', false, 'error', 'Start time is required');
  end if;

  -- 2. Fetch booking profile
  select * into v_profile
  from public.calendar_booking_profiles
  where id = p_booking_profile_id
    and is_active = true;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Booking profile not found or inactive');
  end if;

  select * into v_host
  from public.profiles
  where id = v_profile.user_id;

  select * into v_org
  from public.organizations
  where id = v_profile.organization_id;

  -- 3. Calculate end time
  v_end_time := p_start_time + (v_profile.duration_minutes || ' minutes')::interval;

  -- 4. Check for overlapping confirmed appointments
  select count(*) into v_overlap_count
  from public.calendar_appointments
  where host_user_id = v_profile.user_id
    and status = 'confirmed'
    and (
      (start_time, end_time) overlaps (p_start_time, v_end_time)
    );

  if v_overlap_count > 0 then
    return jsonb_build_object('success', false, 'error', 'This time slot is no longer available');
  end if;

  -- 5. Upsert CRM contact
  select id into v_contact_id
  from public.crm_contacts
  where organization_id = v_profile.organization_id
    and lower(email) = lower(trim(p_client_email))
  limit 1;

  if v_contact_id is null then
    insert into public.crm_contacts (
      organization_id,
      name,
      email,
      phone,
      tags
    ) values (
      v_profile.organization_id,
      trim(p_client_name),
      lower(trim(p_client_email)),
      nullif(trim(p_client_phone), ''),
      array['appointment_booking', 'scheduled_meeting']
    )
    returning id into v_contact_id;
  else
    update public.crm_contacts
    set
      name = coalesce(nullif(trim(p_client_name), ''), name),
      phone = coalesce(nullif(trim(p_client_phone), ''), phone),
      tags = case
        when tags is null then array['appointment_booking']
        when not (tags @> array['appointment_booking']) then array_append(tags, 'appointment_booking')
        else tags
      end,
      updated_at = now()
    where id = v_contact_id;
  end if;

  -- 6. Create CRM Deal
  v_deal_title := v_profile.title || ' - ' || trim(p_client_name);

  insert into public.crm_deals (
    organization_id,
    contact_id,
    title,
    value,
    currency,
    stage,
    notes,
    assigned_to,
    created_by
  ) values (
    v_profile.organization_id,
    v_contact_id,
    v_deal_title,
    0,
    'USD',
    'lead',
    'Appointment booked via scheduler for ' || to_char(p_start_time, 'YYYY-MM-DD HH24:MI TZ') || '.' || case when p_notes is not null and trim(p_notes) <> '' then E'\nClient notes: ' || trim(p_notes) else '' end,
    v_profile.user_id,
    v_profile.user_id
  )
  returning id into v_deal_id;

  -- 7. Insert appointment
  insert into public.calendar_appointments (
    organization_id,
    booking_profile_id,
    host_user_id,
    client_name,
    client_email,
    client_phone,
    notes,
    start_time,
    end_time,
    status,
    contact_id,
    deal_id
  ) values (
    v_profile.organization_id,
    v_profile.id,
    v_profile.user_id,
    trim(p_client_name),
    lower(trim(p_client_email)),
    nullif(trim(p_client_phone), ''),
    nullif(trim(p_notes), ''),
    p_start_time,
    v_end_time,
    'confirmed',
    v_contact_id,
    v_deal_id
  )
  returning id into v_appointment_id;

  -- 8. Insert corresponding calendar_event for team visibility
  insert into public.calendar_events (
    organization_id,
    user_id,
    assigned_user_id,
    title,
    description,
    starts_at,
    ends_at,
    all_day,
    location
  ) values (
    v_profile.organization_id,
    v_profile.user_id,
-- ------------------------------------------------------------
-- 5. Update submit_public_form RPC to return org & form details
-- ------------------------------------------------------------
create or replace function public.submit_public_form(
  p_form_slug text,
  p_submission_data jsonb,
  p_ip_hash text default 'unknown'
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
    and is_active = true;

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
    'contact_id', v_contact_id,
    'deal_id', v_deal_id,
    'redirect_url', v_form.settings->>'redirect_url',
    'success_message', v_form.settings->>'success_message'
  );
end;
$_$;

grant execute on function public.book_public_appointment(uuid, text, text, text, text, timestamptz) to anon, authenticated, service_role;
grant execute on function public.submit_public_form(text, jsonb, text) to anon, authenticated, service_role;

    v_profile.user_id,
    v_profile.title || ' w/ ' || trim(p_client_name),
    'Client: ' || trim(p_client_name) || ' (' || lower(trim(p_client_email)) || ')' || case when p_client_phone is not null and trim(p_client_phone) <> '' then ' - Phone: ' || trim(p_client_phone) else '' end || case when p_notes is not null and trim(p_notes) <> '' then E'\nNotes: ' || trim(p_notes) else '' end,
    p_start_time,
    v_end_time,
    false,
    'Online Video Call'
  );

  return jsonb_build_object(
    'success', true,
    'appointment_id', v_appointment_id,
    'title', v_profile.title,
    'host_name', coalesce(v_host.full_name, 'Host'),
    'host_email', v_host.email,
    'client_name', trim(p_client_name),
    'client_email', lower(trim(p_client_email)),
    'start_time', p_start_time,
    'end_time', v_end_time,
    'duration_minutes', v_profile.duration_minutes,
    'org_name', v_org.name,
    'organization_id', v_profile.organization_id,
    'host_user_id', v_profile.user_id
  );
end;
$_$;

create policy "Users can delete their own notifications"
  on public.system_notifications for delete
  using (
    organization_id = public.current_organization_id()
    and user_id = auth.uid()
  );

grant select, update, delete on public.system_notifications to authenticated;
grant all on public.system_notifications to service_role;
