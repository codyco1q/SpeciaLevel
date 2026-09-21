-- ============================================================
-- SpeciaLevel — 00028 Contacts Tags, Custom Fields & Bulk Import
--
-- 1) crm_contacts table additions:
--    - tags (text[] not null default '{}')
--    - custom_fields (jsonb not null default '{}'::jsonb)
-- 2) GIN index on tags for fast array queries
-- 3) bulk_import_contacts atomic upsert RPC (SECURITY DEFINER)
--    - Scoped strictly to current_organization_id()
--    - Verifies caller has crm.manage permission
--    - Strategies: 'update', 'skip', 'create'
--    - Merges tags and custom_fields on 'update'
--    - Returns jsonb { inserted_count, updated_count, skipped_count, errors }
-- 4) Enable Contacts module in organization_modules
-- ============================================================

-- ------------------------------------------------------------
-- 1. crm_contacts additions
-- ------------------------------------------------------------
alter table public.crm_contacts
  add column if not exists tags text[] not null default '{}';

alter table public.crm_contacts
  add column if not exists custom_fields jsonb not null default '{}'::jsonb;

-- ------------------------------------------------------------
-- 2. Indexes
-- ------------------------------------------------------------
create index if not exists idx_crm_contacts_tags
  on public.crm_contacts using gin (tags);

create index if not exists idx_crm_contacts_org_email
  on public.crm_contacts (organization_id, lower(email));

create index if not exists idx_crm_contacts_org_phone
  on public.crm_contacts (organization_id, phone);

-- ------------------------------------------------------------
-- 3. bulk_import_contacts RPC
-- ------------------------------------------------------------
create or replace function public.bulk_import_contacts(
  p_contacts jsonb,
  p_duplicate_strategy text default 'update',
  p_batch_tags text[] default '{}'
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_organization_id uuid;
  v_caller_id uuid;
  v_strategy text;
  v_inserted_count int := 0;
  v_updated_count int := 0;
  v_skipped_count int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_item jsonb;
  v_index int := 0;

  v_name text;
  v_email text;
  v_phone text;
  v_company text;
  v_title text;
  v_address text;
  v_notes text;
  v_incoming_tags text[];
  v_incoming_custom_fields jsonb;

  v_existing_id uuid;
  v_existing_tags text[];
  v_existing_custom_fields jsonb;
  v_merged_tags text[];
  v_merged_custom_fields jsonb;
  v_final_tags text[];
begin
  v_caller_id := auth.uid();
  if v_caller_id is null then
    raise exception 'not_authenticated';
  end if;

  v_organization_id := public.current_organization_id();
  if v_organization_id is null then
    raise exception 'no_organization';
  end if;

  if not public.user_has_organization_permission(v_organization_id, 'crm.manage') then
    raise exception 'permission_denied';
  end if;

  v_strategy := lower(coalesce(nullif(btrim(p_duplicate_strategy), ''), 'update'));
  if v_strategy not in ('update', 'skip', 'create') then
    v_strategy := 'update';
  end if;

  if p_contacts is null or jsonb_typeof(p_contacts) <> 'array' then
    return jsonb_build_object(
      'inserted_count', 0,
      'updated_count', 0,
      'skipped_count', 0,
      'errors', jsonb_build_array(jsonb_build_object('error', 'invalid_payload_array'))
    );
  end if;

  for v_item in select * from jsonb_array_elements(p_contacts) loop
    v_index := v_index + 1;
    begin
      v_name := btrim(coalesce(v_item->>'name', ''));
      v_email := nullif(lower(btrim(coalesce(v_item->>'email', ''))), '');
      v_phone := nullif(btrim(coalesce(v_item->>'phone', '')), '');
      v_company := nullif(btrim(coalesce(v_item->>'company', '')), '');
      v_title := nullif(btrim(coalesce(v_item->>'title', '')), '');
      v_address := nullif(btrim(coalesce(v_item->>'address', '')), '');
      v_notes := nullif(btrim(coalesce(v_item->>'notes', '')), '');

      -- Name is required (minimum 2 chars)
      if length(v_name) < 2 then
        v_errors := v_errors || jsonb_build_object(
          'row_index', v_index,
          'error', 'Name is required (at least 2 characters)'
        );
        continue;
      end if;

      -- Parse tags from JSON array if provided
      v_incoming_tags := array(
        select distinct trim(elem::text, '"')
        from jsonb_array_elements_text(
          case
            when jsonb_typeof(v_item->'tags') = 'array' then v_item->'tags'
            else '[]'::jsonb
          end
        ) as elem
        where btrim(elem) <> ''
      );

      if v_item ? 'custom_fields' and jsonb_typeof(v_item->'custom_fields') = 'object' then
        v_incoming_custom_fields := v_item->'custom_fields';
      else
        v_incoming_custom_fields := '{}'::jsonb;
      end if;

      v_existing_id := null;

      -- Check for duplicate if strategy is 'update' or 'skip'
      if v_strategy in ('update', 'skip') and (v_email is not null or v_phone is not null) then
        select id, tags, coalesce(custom_fields, '{}'::jsonb)
        into v_existing_id, v_existing_tags, v_existing_custom_fields
        from public.crm_contacts
        where organization_id = v_organization_id
          and (
            (v_email is not null and lower(email) = v_email)
            or (v_phone is not null and phone = v_phone)
          )
        order by created_at asc
        limit 1;
      end if;

      if v_existing_id is not null then
        if v_strategy = 'skip' then
          v_skipped_count := v_skipped_count + 1;
        elsif v_strategy = 'update' then
          -- Merge tags: existing + incoming + batch tags
          v_merged_tags := array(
            select distinct t
            from unnest(
              coalesce(v_existing_tags, '{}'::text[])
              || coalesce(v_incoming_tags, '{}'::text[])
              || coalesce(p_batch_tags, '{}'::text[])
            ) as t
            where t is not null and btrim(t) <> ''
          );

          -- Merge custom_fields
          v_merged_custom_fields := coalesce(v_existing_custom_fields, '{}'::jsonb) || v_incoming_custom_fields;

          update public.crm_contacts
          set
            name = case when v_name <> '' then v_name else name end,
            email = coalesce(v_email, email),
            company = coalesce(v_company, company),
            phone = coalesce(v_phone, phone),
            title = coalesce(v_title, title),
            address = coalesce(v_address, address),
            notes = case
              when v_notes is not null and notes is not null and notes <> ''
                then notes || E'\n\n' || v_notes
              when v_notes is not null
                then v_notes
              else notes
            end,
            tags = coalesce(v_merged_tags, '{}'::text[]),
            custom_fields = coalesce(v_merged_custom_fields, '{}'::jsonb),
            updated_at = now()
          where id = v_existing_id;

          v_updated_count := v_updated_count + 1;
        end if;
      else
        -- Insert new record
        v_final_tags := array(
          select distinct t
          from unnest(
            coalesce(v_incoming_tags, '{}'::text[])
            || coalesce(p_batch_tags, '{}'::text[])
          ) as t
          where t is not null and btrim(t) <> ''
        );

        insert into public.crm_contacts (
          organization_id,
          name,
          email,
          company,
          phone,
          title,
          address,
          notes,
          tags,
          custom_fields,
          created_by,
          created_at,
          updated_at
        ) values (
          v_organization_id,
          v_name,
          coalesce(v_email, ''),
          v_company,
          v_phone,
          v_title,
          v_address,
          v_notes,
          coalesce(v_final_tags, '{}'::text[]),
          coalesce(v_incoming_custom_fields, '{}'::jsonb),
          v_caller_id,
          now(),
          now()
        );

        v_inserted_count := v_inserted_count + 1;
      end if;

    exception when others then
      v_errors := v_errors || jsonb_build_object(
        'row_index', v_index,
        'error', SQLERRM
      );
    end;
  end loop;

  return jsonb_build_object(
    'inserted_count', v_inserted_count,
    'updated_count', v_updated_count,
    'skipped_count', v_skipped_count,
    'errors', v_errors
  );
end;
$$;

grant execute on function public.bulk_import_contacts(jsonb, text, text[]) to authenticated;

-- ------------------------------------------------------------
-- 4. Enable the Contacts module for existing organizations
-- ------------------------------------------------------------
insert into public.organization_modules (organization_id, module_key, module_name, is_enabled)
select o.id, 'contacts', 'Contacts', true
from public.organizations o
where not exists (
  select 1 from public.organization_modules m
  where m.organization_id = o.id and m.module_key = 'contacts'
);

update public.organization_modules m
set is_enabled = true
where m.module_key = 'contacts';
