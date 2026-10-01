-- ============================================================
-- SpeciaLevel — 00041 CRM Pipeline & Stage Customization Enhancements
--
-- 1) public.crm_pipeline_stages — add color, stage_type (open/won/lost)
-- 2) public.crm_pipelines — add color, description, target_amount
-- 3) Backfill sensible colors and stage_type for existing stages
-- ============================================================

-- 1. Enhance crm_pipeline_stages
alter table public.crm_pipeline_stages
  add column if not exists color text not null default '#3b82f6',
  add column if not exists stage_type text not null default 'open' check (stage_type in ('open', 'won', 'lost'));

create index if not exists idx_crm_pipeline_stages_type
  on public.crm_pipeline_stages(pipeline_id, stage_type);

-- 2. Enhance crm_pipelines
alter table public.crm_pipelines
  add column if not exists color text not null default '#6366f1',
  add column if not exists description text,
  add column if not exists target_amount numeric(14, 2);

-- 3. Backfill existing stages with vibrant semantic colors and types
update public.crm_pipeline_stages
set
  color = case
    when lower(name) like '%won%' or lower(name) like '%closed won%' or lower(name) like '%signed%' then '#10b981'
    when lower(name) like '%lost%' or lower(name) like '%closed lost%' or lower(name) like '%churn%' then '#ef4444'
    when lower(name) like '%negotiat%' or lower(name) like '%contract%' or lower(name) like '%review%' then '#f59e0b'
    when lower(name) like '%proposal%' or lower(name) like '%demo%' or lower(name) like '%pitch%' then '#8b5cf6'
    when lower(name) like '%contact%' or lower(name) like '%qualif%' or lower(name) like '%discover%' then '#0ea5e9'
    when lower(name) like '%lead%' or lower(name) like '%inbound%' then '#6366f1'
    else coalesce(color, '#3b82f6')
  end,
  stage_type = case
    when lower(name) like '%won%' or lower(name) like '%closed won%' or lower(name) like '%signed%' or probability = 100 then 'won'
    when lower(name) like '%lost%' or lower(name) like '%closed lost%' or lower(name) like '%churn%' or probability = 0 then 'lost'
    else 'open'
  end
where color = '#3b82f6' or stage_type = 'open';
