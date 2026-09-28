-- ============================================================
-- SpeciaLevel — 00032 CRM Multi-Pipeline Architecture & Custom Stages
--
-- 1) public.crm_pipelines — organization-scoped pipelines
-- 2) public.crm_pipeline_stages — customizable stages per pipeline
-- 3) public.crm_deals — enhanced with pipeline_id, stage_id, lost_reason, won_reason, closed_at
-- 4) RLS for crm_pipelines and crm_pipeline_stages
-- 5) Trigger & Backfill for existing organizations and deals
-- ============================================================

-- ------------------------------------------------------------
-- 1. crm_pipelines
-- ------------------------------------------------------------
create table if not exists public.crm_pipelines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_crm_pipelines_organization_id
  on public.crm_pipelines(organization_id);

create index if not exists idx_crm_pipelines_org_order
  on public.crm_pipelines(organization_id, order_index asc);

-- ------------------------------------------------------------
-- 2. crm_pipeline_stages
-- ------------------------------------------------------------
create table if not exists public.crm_pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.crm_pipelines(id) on delete cascade,
  name text not null,
  order_index int not null default 0,
  probability int not null default 100 check (probability >= 0 and probability <= 100),
  stale_days int not null default 14 check (stale_days >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_crm_pipeline_stages_pipeline_id
  on public.crm_pipeline_stages(pipeline_id);

create index if not exists idx_crm_pipeline_stages_order
  on public.crm_pipeline_stages(pipeline_id, order_index asc);

-- ------------------------------------------------------------
-- 3. crm_deals enhancements
-- ------------------------------------------------------------
alter table public.crm_deals
  add column if not exists pipeline_id uuid references public.crm_pipelines(id) on delete set null,
  add column if not exists stage_id uuid references public.crm_pipeline_stages(id) on delete set null,
  add column if not exists lost_reason text,
  add column if not exists won_reason text,
  add column if not exists closed_at timestamptz;

-- Drop previous restrictive static stage check constraint if present
alter table public.crm_deals
  drop constraint if exists chk_crm_deals_stage;

create index if not exists idx_crm_deals_pipeline_id
  on public.crm_deals(pipeline_id);

create index if not exists idx_crm_deals_stage_id
  on public.crm_deals(stage_id);

-- ------------------------------------------------------------
-- 4. Row Level Security
-- ------------------------------------------------------------
alter table public.crm_pipelines enable row level security;
alter table public.crm_pipeline_stages enable row level security;

-- crm_pipelines RLS
create policy "User can view pipelines in their organization"
  on public.crm_pipelines for select
  using (organization_id = public.current_organization_id());

create policy "User can create pipelines in their organization"
  on public.crm_pipelines for insert
  with check (
    organization_id = public.current_organization_id()
    and public.user_has_organization_permission(public.current_organization_id(), 'crm.manage')
  );

create policy "User can update pipelines in their organization"
  on public.crm_pipelines for update
  using (
    organization_id = public.current_organization_id()
    and public.user_has_organization_permission(public.current_organization_id(), 'crm.manage')
  )
  with check (
    organization_id = public.current_organization_id()
    and public.user_has_organization_permission(public.current_organization_id(), 'crm.manage')
  );

create policy "User can delete pipelines in their organization"
  on public.crm_pipelines for delete
  using (
    organization_id = public.current_organization_id()
    and public.user_has_organization_permission(public.current_organization_id(), 'crm.manage')
  );

-- crm_pipeline_stages RLS
create policy "User can view pipeline stages in their organization"
  on public.crm_pipeline_stages for select
  using (
    exists (
      select 1 from public.crm_pipelines p
      where p.id = crm_pipeline_stages.pipeline_id
        and p.organization_id = public.current_organization_id()
    )
  );

create policy "User can create pipeline stages in their organization"
  on public.crm_pipeline_stages for insert
  with check (
    exists (
      select 1 from public.crm_pipelines p
      where p.id = crm_pipeline_stages.pipeline_id
        and p.organization_id = public.current_organization_id()
        and public.user_has_organization_permission(public.current_organization_id(), 'crm.manage')
    )
  );

create policy "User can update pipeline stages in their organization"
  on public.crm_pipeline_stages for update
  using (
    exists (
      select 1 from public.crm_pipelines p
      where p.id = crm_pipeline_stages.pipeline_id
        and p.organization_id = public.current_organization_id()
        and public.user_has_organization_permission(public.current_organization_id(), 'crm.manage')
    )
  )
  with check (
    exists (
      select 1 from public.crm_pipelines p
      where p.id = crm_pipeline_stages.pipeline_id
        and p.organization_id = public.current_organization_id()
        and public.user_has_organization_permission(public.current_organization_id(), 'crm.manage')
    )
  );

create policy "User can delete pipeline stages in their organization"
  on public.crm_pipeline_stages for delete
  using (
    exists (
      select 1 from public.crm_pipelines p
      where p.id = crm_pipeline_stages.pipeline_id
        and p.organization_id = public.current_organization_id()
        and public.user_has_organization_permission(public.current_organization_id(), 'crm.manage')
    )
  );

-- ------------------------------------------------------------
-- 5. Organization Seed Trigger for CRM Pipelines
-- ------------------------------------------------------------
create or replace function public.seed_organization_crm_pipeline()
returns trigger
language plpgsql
security definer set search_path = public
as $fn$
declare
  v_pipeline_id uuid;
begin
  insert into public.crm_pipelines (
    organization_id,
    name,
    is_default,
    order_index
  ) values (
    new.id,
    'Sales Pipeline',
    true,
    0
  ) returning id into v_pipeline_id;

  insert into public.crm_pipeline_stages (pipeline_id, name, order_index, probability, stale_days) values
    (v_pipeline_id, 'Lead', 0, 10, 14),
    (v_pipeline_id, 'Qualified', 1, 30, 14),
    (v_pipeline_id, 'Proposal', 2, 60, 14),
    (v_pipeline_id, 'Negotiation', 3, 80, 14),
    (v_pipeline_id, 'Won', 4, 100, 30),
    (v_pipeline_id, 'Lost', 5, 0, 30);

  return new;
end;
$fn$;

drop trigger if exists trigger_seed_organization_crm_pipeline on public.organizations;
create trigger trigger_seed_organization_crm_pipeline
  after insert on public.organizations
  for each row execute procedure public.seed_organization_crm_pipeline();

-- ------------------------------------------------------------
-- 6. Backfill existing organizations & deals
-- ------------------------------------------------------------
do $migration$
declare
  org_rec record;
  v_pipeline_id uuid;
  v_lead_stage_id uuid;
  v_contacted_stage_id uuid;
  v_proposal_stage_id uuid;
  v_negotiation_stage_id uuid;
  v_won_stage_id uuid;
  v_lost_stage_id uuid;
begin
  for org_rec in select id from public.organizations loop
    select id into v_pipeline_id
    from public.crm_pipelines
    where organization_id = org_rec.id
    order by is_default desc, order_index asc
    limit 1;

    if v_pipeline_id is null then
      insert into public.crm_pipelines (
        organization_id,
        name,
        is_default,
        order_index
      ) values (
        org_rec.id,
        'Sales Pipeline',
        true,
        0
      ) returning id into v_pipeline_id;

      insert into public.crm_pipeline_stages (pipeline_id, name, order_index, probability, stale_days)
      values (v_pipeline_id, 'Lead', 0, 10, 14)
      returning id into v_lead_stage_id;

      insert into public.crm_pipeline_stages (pipeline_id, name, order_index, probability, stale_days)
      values (v_pipeline_id, 'Qualified', 1, 30, 14)
      returning id into v_contacted_stage_id;

      insert into public.crm_pipeline_stages (pipeline_id, name, order_index, probability, stale_days)
      values (v_pipeline_id, 'Proposal', 2, 60, 14)
      returning id into v_proposal_stage_id;

      insert into public.crm_pipeline_stages (pipeline_id, name, order_index, probability, stale_days)
      values (v_pipeline_id, 'Negotiation', 3, 80, 14)
      returning id into v_negotiation_stage_id;

      insert into public.crm_pipeline_stages (pipeline_id, name, order_index, probability, stale_days)
      values (v_pipeline_id, 'Won', 4, 100, 30)
      returning id into v_won_stage_id;

      insert into public.crm_pipeline_stages (pipeline_id, name, order_index, probability, stale_days)
      values (v_pipeline_id, 'Lost', 5, 0, 30)
      returning id into v_lost_stage_id;
    else
      select id into v_lead_stage_id from public.crm_pipeline_stages where pipeline_id = v_pipeline_id and lower(name) in ('lead') limit 1;
      select id into v_contacted_stage_id from public.crm_pipeline_stages where pipeline_id = v_pipeline_id and lower(name) in ('contacted', 'qualified') limit 1;
      select id into v_proposal_stage_id from public.crm_pipeline_stages where pipeline_id = v_pipeline_id and lower(name) in ('proposal') limit 1;
      select id into v_negotiation_stage_id from public.crm_pipeline_stages where pipeline_id = v_pipeline_id and lower(name) in ('negotiation') limit 1;
      select id into v_won_stage_id from public.crm_pipeline_stages where pipeline_id = v_pipeline_id and lower(name) in ('won') limit 1;
      select id into v_lost_stage_id from public.crm_pipeline_stages where pipeline_id = v_pipeline_id and lower(name) in ('lost') limit 1;
    end if;

    -- Backfill deals for this org
    update public.crm_deals
    set
      pipeline_id = v_pipeline_id,
      stage_id = case
        when lower(stage) = 'lead' then coalesce(v_lead_stage_id, v_contacted_stage_id)
        when lower(stage) = 'contacted' then coalesce(v_contacted_stage_id, v_lead_stage_id)
        when lower(stage) = 'proposal' then coalesce(v_proposal_stage_id, v_lead_stage_id)
        when lower(stage) = 'negotiation' then coalesce(v_negotiation_stage_id, v_proposal_stage_id)
        when lower(stage) = 'won' then coalesce(v_won_stage_id, v_lead_stage_id)
        when lower(stage) = 'lost' then coalesce(v_lost_stage_id, v_lead_stage_id)
        else coalesce(v_lead_stage_id, v_contacted_stage_id)
      end,
      closed_at = case
        when lower(stage) in ('won', 'lost') and closed_at is null then updated_at
        else closed_at
      end
    where organization_id = org_rec.id
      and (pipeline_id is null or stage_id is null);
  end loop;
end;
$migration$;

