-- UpLevel — 00046 Fix Organization Onboarding Seed
-- Fixes foreign key constraint violation on chat_channels.created_by during organization creation

alter table public.chat_channels
  alter column created_by drop not null;

create or replace function public.seed_organization()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creator_id uuid;
begin
  -- Find creator profile if one already exists for this org
  select id into v_creator_id
  from public.profiles
  where organization_id = new.id
  order by created_at asc
  limit 1;

  -- Default global chat channels (created_by can be null or creator)
  insert into public.chat_channels (organization_id, name, description, created_by) values
    (new.id, 'general', 'Company-wide announcements and general discussion.', v_creator_id),
    (new.id, 'project-xyz', 'Collaboration channel for Project XYZ.', v_creator_id)
  on conflict (organization_id, name) do nothing;

  -- Default CRM pipeline
  insert into public.crm_pipelines (organization_id, name, is_default)
  values (new.id, 'Standard Sales Pipeline', true)
  on conflict do nothing;

  return new;
end;
$$;
