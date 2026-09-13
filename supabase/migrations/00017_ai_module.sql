-- ============================================================
-- UpLevel — 00017 AI & Intelligent Agents module
--
-- Adds the AI app: reusable prompt templates (ai_prompts) that are
-- rendered with per-run input and executed through a server-side
-- provider gateway (OpenAI-compatible chat completions), with every
-- run recorded in ai_executions for the execution-history drawer.
--
--   ai_prompts      — saved prompt templates + model configuration
--   ai_executions   — audit log of every provider call (input, output)
--
-- Security mirrors the rest of the platform: tenant-scoped RLS,
-- the "ai.view" / "ai.manage" catalog permissions, and role grants
-- (Owner/Admin/Manager = both, Employee = view, Client = none).
-- Provider credentials never reach the browser — code reads
-- process.env.AI_API_KEY behind the /api/ai/execute endpoint and
-- the executeAiTask server action.
-- ============================================================

-- ------------------------------------------------------------
-- 1. ai_prompts
-- ------------------------------------------------------------
create table if not exists public.ai_prompts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  name text not null,
  description text,
  model_provider text not null default 'openai',
  model_name text not null default 'gpt-4o-mini',
  system_prompt text not null default '',
  user_template text not null,
  temperature numeric not null default 0.7,
  max_tokens integer,
  is_active boolean not null default true,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_ai_prompts_organization
    foreign key (organization_id) references public.organizations(id) on delete cascade,
  constraint fk_ai_prompts_created_by
    foreign key (created_by) references public.profiles(id),
  constraint chk_ai_prompts_name_not_blank
    check (btrim(name) <> ''),
  constraint chk_ai_prompts_template_not_blank
    check (btrim(user_template) <> ''),
  constraint chk_ai_prompts_model_provider
    check (model_provider in ('openai', 'openrouter', 'custom')),
  constraint chk_ai_prompts_temperature
    check (temperature >= 0 and temperature <= 2)
);

create index if not exists idx_ai_prompts_organization
  on public.ai_prompts(organization_id);

-- Fast lookup for the execution engine: active prompts in an org.
create index if not exists idx_ai_prompts_active_lookup
  on public.ai_prompts(organization_id, is_active);

-- ------------------------------------------------------------
-- 2. ai_executions
-- ------------------------------------------------------------
create table if not exists public.ai_executions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  -- NULL for one-off playground runs and built-in quick tools.
  prompt_id uuid,
  -- Which built-in quick tool ran (summarize/classify/extract/rewrite),
  -- NULL for stored prompts and the raw playground.
  tool_key text,
  status text not null,
  -- Snapshot of "provider/model" actually called (audit-friendly).
  model_used text,
  input_data jsonb not null default '{}'::jsonb,
  output_text text,
  error_message text,
  duration_ms integer,
  executed_by uuid not null,
  executed_at timestamptz not null default now(),
  constraint fk_ai_executions_organization
    foreign key (organization_id) references public.organizations(id) on delete cascade,
  constraint fk_ai_executions_prompt
    foreign key (prompt_id) references public.ai_prompts(id) on delete set null,
  constraint fk_ai_executions_executed_by
    foreign key (executed_by) references public.profiles(id),
  constraint chk_ai_executions_status
    check (status in ('success', 'failed', 'running')),
  constraint chk_ai_executions_tool_key
    check (tool_key is null or tool_key in ('summarize', 'classify', 'extract', 'rewrite'))
);

create index if not exists idx_ai_executions_organization
  on public.ai_executions(organization_id, executed_at desc);

create index if not exists idx_ai_executions_prompt_id
  on public.ai_executions(prompt_id, executed_at desc);

-- ------------------------------------------------------------
-- 3. RLS - tenant-scoped CRUD exactly like every other module.
--    created_by / executed_by are pinned to the caller and the
--    organization is always resolved from the session (never from
--    the payload), mirroring the invoicing/chat security model.
--    The ai.view / ai.manage catalog permissions are enforced in
--    the server actions + /api/ai/execute endpoint.
-- ------------------------------------------------------------
alter table public.ai_prompts enable row level security;
alter table public.ai_executions enable row level security;

-- ai_prompts - tenant-scoped CRUD.
create policy "Users can view prompts in their organization"
  on public.ai_prompts for select
  using (organization_id = public.current_organization_id());

create policy "Users can create prompts in their organization"
  on public.ai_prompts for insert
  with check (
    organization_id = public.current_organization_id()
    and created_by = auth.uid()
  );

create policy "Users can update prompts in their organization"
  on public.ai_prompts for update
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

create policy "Users can delete prompts in their organization"
  on public.ai_prompts for delete
  using (organization_id = public.current_organization_id());

-- ai_executions - tenant-scoped. Every insert comes from the
-- server-side runner (executeAiTask / /api/ai/execute), which also
-- enforces the ai.view permission.
create policy "Users can view executions in their organization"
  on public.ai_executions for select
  using (organization_id = public.current_organization_id());

create policy "Users can create executions in their organization"
  on public.ai_executions for insert
  with check (
    organization_id = public.current_organization_id()
    and executed_by = auth.uid()
  );

create policy "Users can update executions in their organization"
  on public.ai_executions for update
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

create policy "Users can delete executions in their organization"
  on public.ai_executions for delete
  using (organization_id = public.current_organization_id());

-- ------------------------------------------------------------
-- 4. Grants
--    00001 granted privileges on tables that existed at the time;
--    tables created by later migrations must be granted
--    explicitly. AI data is private org data (no anon grant).
-- ------------------------------------------------------------
grant all on table public.ai_prompts to authenticated;
grant all on table public.ai_executions to authenticated;

-- ------------------------------------------------------------
-- 5. Keep updated_at current on ai_prompts
-- ------------------------------------------------------------
create trigger trigger_set_updated_at_ai_prompts
  before update on public.ai_prompts
  for each row execute procedure public.set_updated_at();
-- ------------------------------------------------------------
-- 6. Replace seed_organization() so NEW organizations get the
--    AI module, its permissions, and role grants on creation.
--    (Full superset of the 00016 version + the ai.view /
--    ai.manage additions.)
-- ------------------------------------------------------------
create or replace function public.seed_organization()
returns trigger
language plpgsql
security definer set search_path = public
as $$
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
    (new.id, 'ai', 'AI & Agents', true);

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

    (new.id, 'crm.view', 'View CRM', 'View leads, contacts, and deals.', 'crm'),
    (new.id, 'crm.manage', 'Manage CRM', 'Create, edit, and delete CRM records.', 'crm'),

    (new.id, 'invoicing.view', 'View Invoices', 'View invoices and payments.', 'invoicing'),
    (new.id, 'invoicing.manage', 'Manage Invoices', 'Create, edit, and delete invoices.', 'invoicing'),

    (new.id, 'automations.view', 'View Automations', 'View automation workflows and logs.', 'automations'),
    (new.id, 'automations.manage', 'Manage Automations', 'Create, edit, and delete automations.', 'automations'),

    (new.id, 'analytics.view', 'View Analytics', 'View dashboards and reports.', 'analytics'),
    (new.id, 'analytics.manage', 'Manage Analytics', 'Export and configure analytics dashboards.', 'analytics'),

    (new.id, 'ai.view', 'View AI', 'Run AI prompts and view execution history.', 'ai'),
    (new.id, 'ai.manage', 'Manage AI', 'Create, edit, and delete AI prompt templates.', 'ai'),

    (new.id, 'portal.client', 'Client Portal', 'Access the client portal with scoped project views.', 'portal');
-- Grayed-out permissions reference only rows that exist — by insert
  -- they are all present above, so a strict materialized lookup is safe.
  -- Role matrix: Owner gets everything latest, Admin misses only
  -- roles.manage / settings.manage, Manager covers tactical ops
  -- (incl. AI template management), Employee covers daily work
  -- (incl. AI runs + history view), Client stays portal-scoped.
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
        'ai.view', 'ai.manage'
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
        'ai.view'
      ))
      or (r.key = 'client' and p.key in (
        'portal.client',
        'tasks.view',
        'chat.view',
        'invoicing.view'
      ))
    );

  -- Default global chat channels.
  insert into public.chat_channels (organization_id, name, description, created_by) values
    (new.id, 'general', 'Company-wide announcements and general discussion.', new.id),
    (new.id, 'project-xyz', 'Collaboration channel for Project XYZ.', new.id);

  return new;
end;
$$;
-- ------------------------------------------------------------
-- 7. Backfill EXISTING organizations. Idempotent — each block is
--    keyed on natural keys (permission key, module key, role_permissions
--    pair), so re-running this migration never duplicates rows.
-- ------------------------------------------------------------

-- 7a. ai.view / ai.manage for every organization.
insert into public.permissions (organization_id, key, name, description, module)
select o.id, 'ai.view', 'View AI', 'Run AI prompts and view execution history.', 'ai'
from public.organizations o
where not exists (
  select 1 from public.permissions p
  where p.organization_id = o.id and p.key = 'ai.view'
);

insert into public.permissions (organization_id, key, name, description, module)
select o.id, 'ai.manage', 'Manage AI', 'Create, edit, and delete AI prompt templates.', 'ai'
from public.organizations o
where not exists (
  select 1 from public.permissions p
  where p.organization_id = o.id and p.key = 'ai.manage'
);

-- 7b. Enable the AI module for every existing organization.
insert into public.organization_modules (organization_id, module_key, module_name, is_enabled)
select o.id, 'ai', 'AI & Agents', true
from public.organizations o
where not exists (
  select 1 from public.organization_modules m
  where m.organization_id = o.id and m.module_key = 'ai'
);

update public.organization_modules m
set is_enabled = true
from public.organizations o
where o.id = m.organization_id and m.module_key = 'ai' and not m.is_enabled;

-- 7c. Grant matrix: Owner and Admin get both AI permissions (the
--     owner/"everything" & admin "all-but-two" grants are maintained
--     declaratively for new orgs; here we materialize the same caps),
--     Manager gets ai.view + ai.manage, Employee gets ai.view only.
insert into public.role_permissions (role_id, permission_id, organization_id)
select r.id, p.id, r.organization_id
from public.roles r
inner join public.permissions p
  on p.organization_id = r.organization_id
 and p.key in ('ai.view', 'ai.manage')
where r.key in ('owner', 'admin', 'manager')
  and not exists (
    select 1 from public.role_permissions rp
    where rp.role_id = r.id and rp.permission_id = p.id
  );

insert into public.role_permissions (role_id, permission_id, organization_id)
select r.id, p.id, r.organization_id
from public.roles r
inner join public.permissions p
  on p.organization_id = r.organization_id and p.key = 'ai.view'
where r.key = 'employee'
  and not exists (
    select 1 from public.role_permissions rp
    where rp.role_id = r.id and rp.permission_id = p.id
  );