-- ============================================================
-- Migration 00034: Telephony Voice Tokens, Enhanced Call Logs & Recordings
-- ============================================================

-- ------------------------------------------------------------
-- 1. Enhance telecom_calls table
-- ------------------------------------------------------------

-- Update check constraint on telecom_calls.status to support all softphone lifecycle states
alter table public.telecom_calls
  drop constraint if exists chk_telecom_calls_status;

alter table public.telecom_calls
  add constraint chk_telecom_calls_status
  check (status in ('queued', 'ringing', 'in-progress', 'completed', 'missed', 'busy', 'failed', 'no-answer', 'voicemail'));

-- Add caller_phone_number_id referencing phone_numbers
alter table public.telecom_calls
  add column if not exists caller_phone_number_id uuid references public.phone_numbers(id) on delete set null;

-- Add notes and outcome columns for post-call summaries
alter table public.telecom_calls
  add column if not exists notes text,
  add column if not exists outcome text;

create index if not exists idx_telecom_calls_caller_phone_number
  on public.telecom_calls(caller_phone_number_id);

-- ------------------------------------------------------------
-- 2. Call Recordings Table
-- ------------------------------------------------------------
create table if not exists public.call_recordings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  call_id uuid references public.telecom_calls(id) on delete cascade,
  recording_url text not null,
  duration_seconds integer not null default 0,
  file_size_bytes bigint,
  mime_type text not null default 'audio/mp3',
  created_at timestamptz not null default now(),
  constraint chk_call_recordings_duration_non_negative check (duration_seconds >= 0)
);

create index if not exists idx_call_recordings_org on public.call_recordings(organization_id);
create index if not exists idx_call_recordings_call on public.call_recordings(call_id);

alter table public.call_recordings enable row level security;

drop policy if exists "call_recordings_select_policy" on public.call_recordings;
create policy "call_recordings_select_policy"
  on public.call_recordings
  for select
  using (organization_id = public.current_organization_id());

drop policy if exists "call_recordings_insert_policy" on public.call_recordings;
create policy "call_recordings_insert_policy"
  on public.call_recordings
  for insert
  with check (organization_id = public.current_organization_id());

drop policy if exists "call_recordings_update_policy" on public.call_recordings;
create policy "call_recordings_update_policy"
  on public.call_recordings
  for update
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

drop policy if exists "call_recordings_delete_policy" on public.call_recordings;
create policy "call_recordings_delete_policy"
  on public.call_recordings
  for delete
  using (organization_id = public.current_organization_id());

grant all on table public.call_recordings to authenticated;

-- ------------------------------------------------------------
-- 3. Telephony Voice Client Token RPC
-- ------------------------------------------------------------
create or replace function public.generate_telephony_client_token(p_identity text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_user_id uuid;
  v_identity text;
  v_carrier record;
  v_has_permission boolean;
begin
  v_org_id := public.current_organization_id();
  v_user_id := auth.uid();

  if v_org_id is null or v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  -- Verify permissions (telecom.manage or telecom.view)
  v_has_permission := public.user_has_organization_permission(v_org_id, 'telecom.manage')
                   or public.user_has_organization_permission(v_org_id, 'telecom.view');

  if not v_has_permission then
    raise exception 'forbidden: insufficient telephony permissions';
  end if;

  v_identity := coalesce(p_identity, v_user_id::text);

  -- Fetch active carrier credentials for the organization
  select provider, account_sid, api_key_sid, twiml_app_sid, is_active
  into v_carrier
  from public.phone_carrier_settings
  where organization_id = v_org_id
  limit 1;

  if not found or not coalesce(v_carrier.is_active, false) then
    return jsonb_build_object(
      'identity', v_identity,
      'organization_id', v_org_id,
      'has_active_carrier', false,
      'message', 'No active carrier configured for this organization'
    );
  end if;

  return jsonb_build_object(
    'identity', v_identity,
    'organization_id', v_org_id,
    'provider', v_carrier.provider,
    'account_sid', v_carrier.account_sid,
    'api_key_sid', v_carrier.api_key_sid,
    'twiml_app_sid', v_carrier.twiml_app_sid,
    'has_active_carrier', true
  );
end;
$$;

grant execute on function public.generate_telephony_client_token(text) to authenticated;
