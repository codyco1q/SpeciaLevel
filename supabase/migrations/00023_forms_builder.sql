-- ============================================================
-- SpeciaLevel — 00023 Inbound Lead Form Builder
--
-- 1) public.inbound_forms — organization-scoped form definitions
-- 2) public.inbound_form_submissions — captured lead responses
-- 3) submit_public_form() — public RPC to store submissions
-- 4) get_public_form_by_slug() — public RPC for form lookup
-- 5) Permissions: forms.view / forms.manage + seed & backfill
-- ============================================================

-- ------------------------------------------------------------
-- 1. inbound_forms table
-- ------------------------------------------------------------
create table if not exists public.inbound_forms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  slug text not null,
  description text,
  is_published boolean not null default true,
  fields jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  submissions_count int not null default 0,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_inbound_forms_slug unique (slug),
  constraint chk_inbound_forms_slug_format check (slug ~ '^[a-z0-9-_]+$')
);

create index if not exists idx_inbound_forms_organization_id
  on public.inbound_forms(organization_id);

create index if not exists idx_inbound_forms_slug
  on public.inbound_forms(slug);

-- ------------------------------------------------------------
-- 2. inbound_form_submissions table
-- ------------------------------------------------------------
create table if not exists public.inbound_form_submissions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.inbound_forms(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  contact_id uuid references public.crm_contacts(id) on delete set null,
  deal_id uuid references public.crm_deals(id) on delete set null,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index if not exists idx_inbound_form_submissions_form_id
  on public.inbound_form_submissions(form_id);

create index if not exists idx_inbound_form_submissions_organization_id
  on public.inbound_form_submissions(organization_id);

create index if not exists idx_inbound_form_submissions_created_at
  on public.inbound_form_submissions(created_at desc);

-- ------------------------------------------------------------
-- 3. Keep updated_at current on inbound_forms
-- ------------------------------------------------------------
create trigger trigger_set_updated_at_inbound_forms
  before update on public.inbound_forms
  for each row execute procedure public.set_updated_at();

-- ------------------------------------------------------------
-- 4. RLS policies
-- ------------------------------------------------------------
alter table public.inbound_forms enable row level security;
alter table public.inbound_form_submissions enable row level security;

create policy "User can view inbound forms in their organization"
  on public.inbound_forms for select
  using (organization_id = public.current_organization_id());

create policy "User can create inbound forms in their organization"
  on public.inbound_forms for insert
  with check (
    organization_id = public.current_organization_id()
    and created_by = auth.uid()
  );

create policy "User can update inbound forms in their organization"
  on public.inbound_forms for update
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

create policy "User can delete inbound forms in their organization"
  on public.inbound_forms for delete
  using (organization_id = public.current_organization_id());

create policy "User can view form submissions in their organization"
  on public.inbound_form_submissions for select
  using (organization_id = public.current_organization_id());

create policy "User can delete form submissions in their organization"
  on public.inbound_form_submissions for delete
  using (organization_id = public.current_organization_id());

grant all on table public.inbound_forms to authenticated;
grant all on table public.inbound_form_submissions to authenticated;

-- ------------------------------------------------------------
-- 5. Public Form Lookup RPC: get_public_form_by_slug
-- ------------------------------------------------------------
create or replace function public.get_public_form_by_slug(p_slug text)
returns jsonb
language plpgsql
security definer set search_path = public
stable
as $_$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'id', f.id,
    'title', f.title,
    'slug', f.slug,
    'description', f.description,
    'is_published', f.is_published,
    'fields', f.fields,
    'settings', jsonb_build_object(
      'submit_button_text', coalesce(f.settings->>'submit_button_text', 'Submit'),
      'success_message', coalesce(f.settings->>'success_message', 'Thank you! Your submission has been received.'),
      'redirect_url', f.settings->>'redirect_url'
    ),
    'organization_name', o.name
  )
  into v_result
  from public.inbound_forms f
  join public.organizations o on o.id = f.organization_id
  where f.slug = p_slug
    and f.is_published = true;

  return v_result;
end;
$_$;

grant execute on function public.get_public_form_by_slug(text) to anon, authenticated;

-- ------------------------------------------------------------
-- 6. Public Submission RPC: submit_public_form
-- ------------------------------------------------------------
create or replace function public.submit_public_form(
  p_form_slug text,
  p_submission_data jsonb,
  p_ip_hash text default null
)
returns jsonb
language plpgsql
security definer set search_path = public
as $_$
declare
  v_form record;
  v_field jsonb;
  v_email text;
  v_name text;
  v_phone text;
  v_company text;
  v_contact_id uuid;
  v_deal_id uuid;
  v_submission_id uuid;
  v_auto_create_deal boolean;
  v_deal_stage text;
  v_deal_value numeric;
  v_deal_title text;
begin
  select * into v_form
  from public.inbound_forms
  where slug = p_form_slug
    and is_published = true;

  if not found then
    raise exception 'form_not_found';
  end if;

  -- 1. Extract Lead Contact Details
  v_email := p_submission_data->>'email';
  if v_email is null then
    for v_field in select * from jsonb_array_elements(v_form.fields) loop
      if v_field->>'type' = 'email' then
        v_email := coalesce(
          p_submission_data->>(v_field->>'id'),
          p_submission_data->>(v_field->>'label')
        );
        if v_email is not null then exit; end if;
      end if;
    end loop;
  end if;

  v_name := coalesce(
    p_submission_data->>'name',
    p_submission_data->>'full_name',
    p_submission_data->>'fullName'
  );
  if v_name is null then
    for v_field in select * from jsonb_array_elements(v_form.fields) loop
      if lower(v_field->>'label') in ('name', 'full name', 'your name', 'الاسم', 'الاسم الكامل') then
        v_name := coalesce(
          p_submission_data->>(v_field->>'id'),
          p_submission_data->>(v_field->>'label')
        );
        if v_name is not null then exit; end if;
      end if;
    end loop;
  end if;

  v_phone := p_submission_data->>'phone';
  if v_phone is null then
    for v_field in select * from jsonb_array_elements(v_form.fields) loop
      if v_field->>'type' = 'phone' or lower(v_field->>'label') in ('phone', 'phone number', 'mobile', 'الهاتف', 'رقم الهاتف') then
        v_phone := coalesce(
          p_submission_data->>(v_field->>'id'),
          p_submission_data->>(v_field->>'label')
        );
        if v_phone is not null then exit; end if;
      end if;
    end loop;
  end if;

  v_company := p_submission_data->>'company';
  if v_company is null then
    for v_field in select * from jsonb_array_elements(v_form.fields) loop
      if lower(v_field->>'label') in ('company', 'company name', 'organization', 'الشركة', 'المؤسسة') then
        v_company := coalesce(
          p_submission_data->>(v_field->>'id'),
          p_submission_data->>(v_field->>'label')
        );
        if v_company is not null then exit; end if;
      end if;
    end loop;
  end if;

  -- 2. Upsert Contact if email is present
  if v_email is not null and btrim(v_email) <> '' then
    v_email := lower(btrim(v_email));
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
    'redirect_url', v_form.settings->>'redirect_url',
    'success_message', coalesce(v_form.settings->>'success_message', 'Thank you! Your submission has been received.')
  );
end;
$_$;

grant execute on function public.submit_public_form(text, jsonb, text) to anon, authenticated;


-- ------------------------------------------------------------
-- 7. Replace seed_organization() with forms module & permissions
-- ------------------------------------------------------------
create or replace function public.seed_organization()
returns trigger
language plpgsql
security definer set search_path = public
as $_$
begin
  -- Base roles
  insert into public.roles (organization_id, name, key, description, is_system) values
    (new.id, 'Owner', 'owner', 'Full control over the organization.', true),
    (new.id, 'Admin', 'admin', 'Administrative access to most features.', true),
    (new.id, 'Manager', 'manager', 'Manages a team or department.', true),
    (new.id, 'Employee', 'employee', 'Standard employee access.', true),
    (new.id, 'Client', 'client', 'Client portal access with scoped project views.', true);

  -- Default modules
  insert into public.organization_modules (organization_id, module_key, module_name, is_enabled) values
    (new.id, 'dashboard', 'Dashboard', true),
    (new.id, 'calendar', 'Calendar', true),
    (new.id, 'time', 'Time Tracking', true),
    (new.id, 'employees', 'Employees', true),
    (new.id, 'departments', 'Departments', true),
    (new.id, 'roles', 'Roles & Permissions', true),
    (new.id, 'tasks', 'Tasks', true),
    (new.id, 'chat', 'Chat', true),
    (new.id, 'crm', 'CRM', true),
    (new.id, 'invoicing', 'Invoicing & Billing', true),
    (new.id, 'automations', 'Automations', true),
    (new.id, 'analytics', 'Analytics & BI', true),
    (new.id, 'ai', 'AI & Agents', true),
    (new.id, 'marketing', 'Marketing', true),
    (new.id, 'telecommunications', 'Telecommunications', true),
    (new.id, 'forms', 'Lead Forms', true);

  -- Default permissions
  insert into public.permissions (organization_id, key, name, description, module) values
    (new.id, 'dashboard.view', 'View Dashboard', 'View the main dashboard.', 'dashboard'),

    (new.id, 'calendar.view', 'View Calendar', 'View calendar events.', 'calendar'),
    (new.id, 'calendar.create', 'Create Calendar Events', 'Create calendar events.', 'calendar'),
    (new.id, 'calendar.edit', 'Edit Calendar Events', 'Edit calendar events.', 'calendar'),
    (new.id, 'calendar.delete', 'Delete Calendar Events', 'Delete calendar events.', 'calendar'),

    (new.id, 'time.view', 'View Time Entries', 'View time entries.', 'time'),
    (new.id, 'time.clock_in', 'Clock In', 'Start a time entry.', 'time'),
    (new.id, 'time.clock_out', 'Clock Out', 'Stop a time entry.', 'time'),

    (new.id, 'employees.view', 'View Employees', 'View employee profiles.', 'employees'),
    (new.id, 'employees.manage', 'Manage Employees', 'Create, edit, and deactivate employees.', 'employees'),

    (new.id, 'departments.view', 'View Departments', 'View departments.', 'departments'),
    (new.id, 'departments.manage', 'Manage Departments', 'Create, edit, and delete departments.', 'departments'),

    (new.id, 'roles.view', 'View Roles', 'View roles and their permissions.', 'roles'),
    (new.id, 'roles.manage', 'Manage Roles', 'Create, edit, and delete roles.', 'roles'),

    (new.id, 'settings.view', 'View Settings', 'View organization settings.', 'settings'),
    (new.id, 'settings.manage', 'Manage Settings', 'Update organization settings.', 'settings'),

    (new.id, 'tasks.view', 'View Tasks', 'View project tasks.', 'tasks'),
    (new.id, 'tasks.manage', 'Manage Tasks', 'Create, edit, and delete tasks.', 'tasks'),

    (new.id, 'chat.view', 'View Chat', 'View workspace chat channels.', 'chat'),
    (new.id, 'chat.manage', 'Manage Chat', 'Create channels and post messages.', 'chat'),

    (new.id, 'crm.view', 'View CRM', 'View contacts, deals, and pipelines.', 'crm'),
    (new.id, 'crm.manage', 'Manage CRM', 'Create, update, and delete CRM records.', 'crm'),

    (new.id, 'invoicing.view', 'View Invoicing', 'View invoices and billing.', 'invoicing'),
    (new.id, 'invoicing.manage', 'Manage Invoicing', 'Create, edit, and manage invoices.', 'invoicing'),

    (new.id, 'automations.view', 'View Automations', 'View automations and workflows.', 'automations'),
    (new.id, 'automations.manage', 'Manage Automations', 'Create, edit, and trigger workflows.', 'automations'),

    (new.id, 'analytics.view', 'View Analytics', 'View organization analytics and BI.', 'analytics'),
    (new.id, 'analytics.manage', 'Manage Analytics', 'Export and configure analytics.', 'analytics'),

    (new.id, 'ai.view', 'View AI', 'Run AI prompts and view execution history.', 'ai'),
    (new.id, 'ai.manage', 'Manage AI', 'Create, edit, and delete AI prompt templates.', 'ai'),

    (new.id, 'marketing.view', 'View Marketing', 'View marketing campaigns and assets.', 'marketing'),
    (new.id, 'marketing.manage', 'Manage Marketing', 'Create, edit, and delete marketing campaigns.', 'marketing'),

    (new.id, 'telecom.view', 'View Telecom', 'View call logs and SMS history.', 'telecom'),
    (new.id, 'telecom.manage', 'Manage Telecom', 'Log calls and send SMS messages.', 'telecom'),

    (new.id, 'forms.view', 'View Forms', 'View lead capture forms and submissions.', 'forms'),
    (new.id, 'forms.manage', 'Manage Forms', 'Create, edit, publish, and delete lead forms.', 'forms'),

    (new.id, 'portal.client', 'Client Portal', 'Access the client portal with scoped project views.', 'portal');


  -- Role matrix
  insert into public.role_permissions (role_id, permission_id, organization_id)
  select r.id, p.id, new.id
  from public.roles r
  cross join public.permissions p
  where r.organization_id = new.id and p.organization_id = new.id
    and (
      (r.key = 'owner')
      or (r.key = 'admin' and p.key not in ('roles.manage', 'settings.manage'))
      or (r.key = 'manager' and p.key in (
        'dashboard.view',
        'calendar.view', 'calendar.create',
        'time.view', 'time.clock_in', 'time.clock_out',
        'employees.view', 'employees.manage',
        'departments.view',
        'tasks.view', 'tasks.manage',
        'chat.view', 'chat.manage',
        'crm.view', 'crm.manage',
        'invoicing.view', 'invoicing.manage',
        'automations.view', 'automations.manage',
        'analytics.view',
        'ai.view', 'ai.manage',
        'marketing.view', 'marketing.manage',
        'telecom.view', 'telecom.manage',
        'forms.view', 'forms.manage'
      ))
      or (r.key = 'employee' and p.key in (
        'dashboard.view',
        'calendar.view',
        'time.view', 'time.clock_in', 'time.clock_out',
        'tasks.view',
        'chat.view',
        'crm.view',
        'invoicing.view',
        'automations.view',
        'analytics.view',
        'ai.view',
        'marketing.view',
        'telecom.view',
        'forms.view'
      ))
      or (r.key = 'client' and p.key in (
        'portal.client',
        'tasks.view',
        'chat.view',
        'invoicing.view'
      ))
    );

  -- Default global chat channels
  insert into public.chat_channels (organization_id, name, description, created_by) values
    (new.id, 'general', 'Company-wide announcements and general discussion.', new.id),
    (new.id, 'project-xyz', 'Collaboration channel for Project XYZ.', new.id);

  return new;
end;
$_$;

-- ------------------------------------------------------------
-- 8. Backfill EXISTING organizations
-- ------------------------------------------------------------

-- Permissions
insert into public.permissions (organization_id, key, name, description, module)
select o.id, 'forms.view', 'View Forms', 'View lead capture forms and submissions.', 'forms'
from public.organizations o
where not exists (
  select 1 from public.permissions p
  where p.organization_id = o.id and p.key = 'forms.view'
);

insert into public.permissions (organization_id, key, name, description, module)
select o.id, 'forms.manage', 'Manage Forms', 'Create, edit, publish, and delete lead forms.', 'forms'
from public.organizations o
where not exists (
  select 1 from public.permissions p
  where p.organization_id = o.id and p.key = 'forms.manage'
);

-- Module
insert into public.organization_modules (organization_id, module_key, module_name, is_enabled)
select o.id, 'forms', 'Lead Forms', true
from public.organizations o
on conflict (organization_id, module_key)
do update set module_name = excluded.module_name, is_enabled = true;

-- Role permissions
insert into public.role_permissions (role_id, permission_id, organization_id)
select r.id, p.id, r.organization_id
from public.roles r
join public.permissions p on p.organization_id = r.organization_id
where r.key in ('owner', 'admin', 'manager')
  and p.key in ('forms.view', 'forms.manage')
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id, organization_id)
select r.id, p.id, r.organization_id
from public.roles r
join public.permissions p on p.organization_id = r.organization_id
where r.key = 'employee'
  and p.key = 'forms.view'
on conflict (role_id, permission_id) do nothing;

