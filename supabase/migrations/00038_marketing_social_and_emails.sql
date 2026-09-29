-- ============================================================
-- Migration 00038: Marketing Social Planner & Email Template Studio
-- ============================================================

-- ------------------------------------------------------------
-- 1. Add Social Planner Subscription flag to organizations
-- ------------------------------------------------------------
alter table public.organizations
  add column if not exists has_social_planner_addon boolean not null default false,
  add column if not exists social_planner_subscribed_at timestamptz;

-- ------------------------------------------------------------
-- 2. Create marketing_social_posts table
-- ------------------------------------------------------------
create table if not exists public.marketing_social_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  content text not null,
  media_urls jsonb not null default '[]'::jsonb,
  platforms jsonb not null default '["twitter", "linkedin"]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published', 'failed')),
  scheduled_for timestamptz,
  published_at timestamptz,
  error_message text,
  created_by uuid constraint marketing_social_posts_created_by_fkey references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_marketing_social_posts_org
  on public.marketing_social_posts(organization_id);

create index if not exists idx_marketing_social_posts_status
  on public.marketing_social_posts(organization_id, status);

create index if not exists idx_marketing_social_posts_scheduled
  on public.marketing_social_posts(organization_id, scheduled_for)
  where status = 'scheduled';

-- ------------------------------------------------------------
-- 3. Create marketing_email_templates table
-- ------------------------------------------------------------
create table if not exists public.marketing_email_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  subject text not null,
  preview_text text,
  body_json jsonb not null default '[]'::jsonb,
  body_html text not null default '',
  created_by uuid constraint marketing_email_templates_created_by_fkey references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_marketing_email_templates_created
  on public.marketing_email_templates(organization_id, created_at desc);

-- ------------------------------------------------------------
-- 4. Row Level Security Policies
-- ------------------------------------------------------------
alter table public.marketing_social_posts enable row level security;
alter table public.marketing_email_templates enable row level security;

-- marketing_social_posts policies
drop policy if exists "marketing_social_posts_select_policy" on public.marketing_social_posts;
create policy "marketing_social_posts_select_policy"
  on public.marketing_social_posts for select
  using (organization_id = public.current_organization_id());

drop policy if exists "marketing_social_posts_insert_policy" on public.marketing_social_posts;
create policy "marketing_social_posts_insert_policy"
  on public.marketing_social_posts for insert
  with check (organization_id = public.current_organization_id());

drop policy if exists "marketing_social_posts_update_policy" on public.marketing_social_posts;
create policy "marketing_social_posts_update_policy"
  on public.marketing_social_posts for update
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

drop policy if exists "marketing_social_posts_delete_policy" on public.marketing_social_posts;
create policy "marketing_social_posts_delete_policy"
  on public.marketing_social_posts for delete
  using (organization_id = public.current_organization_id());

-- marketing_email_templates policies
drop policy if exists "marketing_email_templates_select_policy" on public.marketing_email_templates;
create policy "marketing_email_templates_select_policy"
  on public.marketing_email_templates for select
  using (organization_id = public.current_organization_id());

drop policy if exists "marketing_email_templates_insert_policy" on public.marketing_email_templates;
create policy "marketing_email_templates_insert_policy"
  on public.marketing_email_templates for insert
  with check (organization_id = public.current_organization_id());

drop policy if exists "marketing_email_templates_update_policy" on public.marketing_email_templates;
create policy "marketing_email_templates_update_policy"
  on public.marketing_email_templates for update
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

drop policy if exists "marketing_email_templates_delete_policy" on public.marketing_email_templates;
create policy "marketing_email_templates_delete_policy"
  on public.marketing_email_templates for delete
  using (organization_id = public.current_organization_id());

-- ------------------------------------------------------------
-- 5. Automatic updated_at Triggers
-- ------------------------------------------------------------
drop trigger if exists trigger_set_updated_at_marketing_social_posts on public.marketing_social_posts;
create trigger trigger_set_updated_at_marketing_social_posts
  before update on public.marketing_social_posts
  for each row execute procedure public.set_updated_at();

drop trigger if exists trigger_set_updated_at_marketing_email_templates on public.marketing_email_templates;
create trigger trigger_set_updated_at_marketing_email_templates
  before update on public.marketing_email_templates
  for each row execute procedure public.set_updated_at();

