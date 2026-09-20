-- ============================================================
-- Update book_public_appointment RPC function
-- ============================================================
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
    'org_name', v_org.name
  );
end;
$_$;
