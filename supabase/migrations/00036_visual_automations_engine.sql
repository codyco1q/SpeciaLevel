-- ============================================================
-- SpeciaLevel — 00036 Visual Automation Workflow Engine
--
-- Adds multi-step visual workflows with trigger configs,
-- multi-action execution nodes, and detailed execution audit logs.
--
--   automation_workflows        — Workflow definitions with visual steps
--   automation_execution_logs   — Execution trace history and step results
-- ============================================================

-- ------------------------------------------------------------
-- 1. automation_workflows
-- ------------------------------------------------------------
create table if not exists public.automation_workflows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default false,
  trigger_type text not null,
  trigger_config jsonb not null default '{}'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_automation_workflows_name_not_blank
    check (btrim(name) <> ''),
  constraint chk_automation_workflows_trigger_type
    check (
      trigger_type in (
        'form_submitted',
        'appointment_booked',
        'deal_stage_changed',
        'contact_tag_added',
        'inbound_sms',
        'invoice_paid'
      )
    )
);

create index if not exists idx_automation_workflows_org
  on public.automation_workflows(organization_id);

create index if not exists idx_automation_workflows_active_lookup
  on public.automation_workflows(organization_id, trigger_type)
  where is_active = true;

-- ------------------------------------------------------------
-- 2. automation_execution_logs
-- ------------------------------------------------------------
create table if not exists public.automation_execution_logs (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.automation_workflows(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  status text not null check (status in ('running', 'completed', 'failed')),
  trigger_payload jsonb not null default '{}'::jsonb,
  steps_executed jsonb not null default '[]'::jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_automation_exec_logs_wf
  on public.automation_execution_logs(workflow_id, started_at desc);

create index if not exists idx_automation_exec_logs_org
  on public.automation_execution_logs(organization_id, started_at desc);

-- ------------------------------------------------------------
-- 3. Row Level Security
-- ------------------------------------------------------------
alter table public.automation_workflows enable row level security;
alter table public.automation_execution_logs enable row level security;

-- automation_workflows policies
create policy "Users can view automation workflows in their org"
  on public.automation_workflows for select
  using (organization_id = public.current_organization_id());

create policy "Users can insert automation workflows in their org"
  on public.automation_workflows for insert
  with check (organization_id = public.current_organization_id());

create policy "Users can update automation workflows in their org"
  on public.automation_workflows for update
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

create policy "Users can delete automation workflows in their org"
  on public.automation_workflows for delete
  using (organization_id = public.current_organization_id());

-- automation_execution_logs policies
create policy "Users can view automation logs in their org"
  on public.automation_execution_logs for select
  using (organization_id = public.current_organization_id());

create policy "Users can insert automation logs in their org"
  on public.automation_execution_logs for insert
  with check (organization_id = public.current_organization_id());

create policy "Users can update automation logs in their org"
  on public.automation_execution_logs for update
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

create policy "Users can delete automation logs in their org"
  on public.automation_execution_logs for delete
  using (organization_id = public.current_organization_id());

-- ------------------------------------------------------------
-- 4. Grants
-- ------------------------------------------------------------
grant all on table public.automation_workflows to authenticated;
grant all on table public.automation_workflows to service_role;
grant all on table public.automation_execution_logs to authenticated;
grant all on table public.automation_execution_logs to service_role;

-- ------------------------------------------------------------
-- 5. Trigger for updated_at
-- ------------------------------------------------------------
create trigger trigger_set_updated_at_automation_workflows
  before update on public.automation_workflows
  for each row execute procedure public.set_updated_at();
