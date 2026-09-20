-- ============================================================
-- SpeciaLevel — 00024 Team Calendar & Appointment Scheduler
--
-- 1) public.calendar_booking_profiles — host availability & booking config
-- 2) public.calendar_appointments — scheduled client appointments
-- 3) get_public_booking_profile() — public RPC for scheduler lookup
-- 4) book_public_appointment() — public RPC for scheduling & CRM sync
-- 5) Permissions: calendar.manage + seed & backfill
-- ============================================================

-- ------------------------------------------------------------
-- 1. calendar_booking_profiles table
-- ------------------------------------------------------------
create table if not exists public.calendar_booking_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  slug text not null,
  title text not null default '30 Min Consultation',
  description text,
  duration_minutes int not null default 30,
  buffer_before_minutes int not null default 0,
  buffer_after_minutes int not null default 10,
  is_active boolean not null default true,
  weekly_availability jsonb not null default '{
    "monday": [{"start": "09:00", "end": "17:00"}],
    "tuesday": [{"start": "09:00", "end": "17:00"}],
    "wednesday": [{"start": "09:00", "end": "17:00"}],
    "thursday": [{"start": "09:00", "end": "17:00"}],
    "friday": [{"start": "09:00", "end": "17:00"}],
    "saturday": [],
    "sunday": []
  }'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_calendar_booking_profiles_org_user unique (organization_id, user_id),
  constraint uq_calendar_booking_profiles_org_slug unique (organization_id, slug),
  constraint chk_calendar_booking_profiles_slug_format check (slug ~ '^[a-z0-9_-]+$'),
  constraint chk_calendar_booking_profiles_duration check (duration_minutes > 0 and duration_minutes <= 480)
);

create index if not exists idx_calendar_booking_profiles_org_id
  on public.calendar_booking_profiles(organization_id);

create index if not exists idx_calendar_booking_profiles_slug
  on public.calendar_booking_profiles(slug);

create index if not exists idx_calendar_booking_profiles_user_id
  on public.calendar_booking_profiles(user_id);

-- ------------------------------------------------------------
-- 2. calendar_appointments table
-- ------------------------------------------------------------
create table if not exists public.calendar_appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  booking_profile_id uuid not null references public.calendar_booking_profiles(id) on delete cascade,
  host_user_id uuid not null references public.profiles(id) on delete cascade,
  client_name text not null,
  client_email text not null,
  client_phone text,
  notes text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text not null default 'confirmed',
  contact_id uuid references public.crm_contacts(id) on delete set null,
  deal_id uuid references public.crm_deals(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_calendar_appointments_status check (status in ('confirmed', 'cancelled', 'completed')),
  constraint chk_calendar_appointments_time_range check (end_time > start_time)
);

create index if not exists idx_calendar_appointments_org_id
  on public.calendar_appointments(organization_id);

create index if not exists idx_calendar_appointments_booking_profile_id
  on public.calendar_appointments(booking_profile_id);

create index if not exists idx_calendar_appointments_host_user_id
  on public.calendar_appointments(host_user_id);


-- ------------------------------------------------------------
-- 3. Triggers for updated_at
-- ------------------------------------------------------------
create trigger trigger_set_updated_at_calendar_booking_profiles
  before update on public.calendar_booking_profiles
  for each row execute procedure public.set_updated_at();

create trigger trigger_set_updated_at_calendar_appointments
  before update on public.calendar_appointments
  for each row execute procedure public.set_updated_at();

-- ------------------------------------------------------------
-- 4. RLS policies
-- ------------------------------------------------------------
alter table public.calendar_booking_profiles enable row level security;
alter table public.calendar_appointments enable row level security;

create policy "User can view calendar booking profiles in their organization"
  on public.calendar_booking_profiles for select
  using (organization_id = public.current_organization_id());

create policy "User can insert calendar booking profiles in their organization"
  on public.calendar_booking_profiles for insert
  with check (organization_id = public.current_organization_id());

create policy "User can update calendar booking profiles in their organization"
  on public.calendar_booking_profiles for update
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

create policy "User can delete calendar booking profiles in their organization"
  on public.calendar_booking_profiles for delete
  using (organization_id = public.current_organization_id());

create policy "User can view calendar appointments in their organization"
  on public.calendar_appointments for select
  using (organization_id = public.current_organization_id());

create policy "User can insert calendar appointments in their organization"
  on public.calendar_appointments for insert
  with check (organization_id = public.current_organization_id());

create policy "User can update calendar appointments in their organization"
  on public.calendar_appointments for update
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

create policy "User can delete calendar appointments in their organization"
  on public.calendar_appointments for delete
  using (organization_id = public.current_organization_id());

-- ------------------------------------------------------------
-- 5. Public RPC: get_public_booking_profile
-- ------------------------------------------------------------
create or replace function public.get_public_booking_profile(
  p_profile_slug text,
  p_org_slug text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $_$
declare
  v_profile record;
  v_existing_appointments jsonb;
begin
  if p_org_slug is not null and p_org_slug <> '' then
    select
      cbp.id,
      cbp.organization_id,
      cbp.user_id,
      cbp.slug,
      cbp.title,
      cbp.description,
      cbp.duration_minutes,
      cbp.buffer_before_minutes,
      cbp.buffer_after_minutes,
      cbp.is_active,
      cbp.weekly_availability,
      p.full_name as host_name,
      p.avatar_url as host_avatar,
      p.email as host_email,
      o.name as org_name,
      o.slug as org_slug
    into v_profile
    from public.calendar_booking_profiles cbp
    join public.profiles p on p.id = cbp.user_id
    join public.organizations o on o.id = cbp.organization_id
    where cbp.slug = p_profile_slug
      and o.slug = p_org_slug
      and cbp.is_active = true;
  else
    select
      cbp.id,
      cbp.organization_id,
      cbp.user_id,
      cbp.slug,
      cbp.title,
      cbp.description,
      cbp.duration_minutes,
      cbp.buffer_before_minutes,
      cbp.buffer_after_minutes,
      cbp.is_active,
      cbp.weekly_availability,
      p.full_name as host_name,
      p.avatar_url as host_avatar,
      p.email as host_email,
      o.name as org_name,
      o.slug as org_slug
    into v_profile
    from public.calendar_booking_profiles cbp
    join public.profiles p on p.id = cbp.user_id
    join public.organizations o on o.id = cbp.organization_id
    where cbp.slug = p_profile_slug
      and cbp.is_active = true
    limit 1;
  end if;

  if not found then
    return null;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'start_time', ca.start_time,
        'end_time', ca.end_time
      )
    ),
    '[]'::jsonb
  )
  into v_existing_appointments
  from public.calendar_appointments ca
  where ca.host_user_id = v_profile.user_id
    and ca.status = 'confirmed'
    and ca.start_time >= now() - interval '1 day'
    and ca.start_time <= now() + interval '60 days';

  return jsonb_build_object(
    'id', v_profile.id,
    'slug', v_profile.slug,
    'title', v_profile.title,
    'description', v_profile.description,
    'duration_minutes', v_profile.duration_minutes,
    'buffer_before_minutes', v_profile.buffer_before_minutes,
    'buffer_after_minutes', v_profile.buffer_after_minutes,
    'weekly_availability', v_profile.weekly_availability,
    'host_name', coalesce(v_profile.host_name, 'Team Member'),
    'host_avatar', v_profile.host_avatar,
    'host_email', v_profile.host_email,
    'org_name', v_profile.org_name,
    'org_slug', v_profile.org_slug,
    'existing_appointments', v_existing_appointments
  );
end;
$_$;

create index if not exists idx_calendar_appointments_start_time
  on public.calendar_appointments(start_time);

create index if not exists idx_calendar_appointments_status
  on public.calendar_appointments(status);

-- ------------------------------------------------------------
-- 6. Public RPC: book_public_appointment
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


-- ------------------------------------------------------------
-- 7. Permissions & Grants
-- ------------------------------------------------------------
grant execute on function public.get_public_booking_profile(text, text) to anon, authenticated, service_role;
grant execute on function public.book_public_appointment(uuid, text, text, text, text, timestamptz) to anon, authenticated, service_role;

grant select, insert, update, delete on public.calendar_booking_profiles to authenticated;
grant select, insert, update, delete on public.calendar_appointments to authenticated;

-- ------------------------------------------------------------
-- 8. Backfill permissions for calendar.manage
-- ------------------------------------------------------------
insert into public.permissions (organization_id, key, name, description, module)
select o.id, 'calendar.manage', 'Manage Calendar & Appointments', 'Manage team appointments, booking profiles, and scheduling availability.', 'calendar'
from public.organizations o
where not exists (
  select 1 from public.permissions p
  where p.organization_id = o.id and p.key = 'calendar.manage'
);

-- Module entry for calendar if missing
insert into public.organization_modules (organization_id, module_key, module_name, is_enabled)
select o.id, 'calendar', 'Calendar & Appointments', true
from public.organizations o
on conflict (organization_id, module_key)
do update set module_name = excluded.module_name, is_enabled = true;

-- Assign calendar.manage to owner, admin, manager
insert into public.role_permissions (role_id, permission_id, organization_id)
select r.id, p.id, r.organization_id
from public.roles r
join public.permissions p on p.organization_id = r.organization_id
where r.key in ('owner', 'admin', 'manager')
  and p.key in ('calendar.view', 'calendar.create', 'calendar.edit', 'calendar.delete', 'calendar.manage')
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id, organization_id)
select r.id, p.id, r.organization_id
from public.roles r
join public.permissions p on p.organization_id = r.organization_id
where r.key = 'employee'
  and p.key in ('calendar.view', 'calendar.create')
on conflict (role_id, permission_id) do nothing;

