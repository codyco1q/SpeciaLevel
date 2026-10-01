-- ============================================================
-- UpLevel — 00040 Tasks Powerhouse, Notion Docs & Whiteboards
-- ============================================================

-- 1. Create task_stages table
create table if not exists public.task_stages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  color text not null default '#3b82f6',
  order_index int not null default 0,
  is_done_stage boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_task_stages_org_order
  on public.task_stages(organization_id, order_index asc);

-- 2. Update tasks table with stage_id
alter table public.tasks
  add column if not exists stage_id uuid references public.task_stages(id) on delete set null;

-- Drop static status check constraint to allow custom stage statuses
alter table public.tasks drop constraint if exists chk_tasks_status;

create index if not exists idx_tasks_stage_id on public.tasks(stage_id);

-- 3. Create workspace_docs table (Notion-style standalone docs)
create table if not exists public.workspace_docs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null default 'Untitled',
  icon text not null default '📄',
  blocks_json jsonb not null default '[]'::jsonb,
  plain_text text not null default '',
  parent_id uuid references public.workspace_docs(id) on delete cascade,
  order_index int not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_workspace_docs_org_order
  on public.workspace_docs(organization_id, order_index asc);

-- 4. Create workspace_whiteboards table
create table if not exists public.workspace_whiteboards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null default 'New Whiteboard',
  elements_json jsonb not null default '[]'::jsonb,
  viewport jsonb not null default '{"x": 0, "y": 0, "zoom": 1}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_workspace_whiteboards_org
  on public.workspace_whiteboards(organization_id, updated_at desc);

-- 5. RLS Policies
alter table public.task_stages enable row level security;
alter table public.workspace_docs enable row level security;
alter table public.workspace_whiteboards enable row level security;

-- Task Stages RLS
drop policy if exists "task_stages_select_policy" on public.task_stages;
create policy "task_stages_select_policy"
  on public.task_stages for select
  using (organization_id = public.current_organization_id());

drop policy if exists "task_stages_insert_policy" on public.task_stages;
create policy "task_stages_insert_policy"
  on public.task_stages for insert
  with check (organization_id = public.current_organization_id());

drop policy if exists "task_stages_update_policy" on public.task_stages;
create policy "task_stages_update_policy"
  on public.task_stages for update
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

drop policy if exists "task_stages_delete_policy" on public.task_stages;
create policy "task_stages_delete_policy"
  on public.task_stages for delete
  using (organization_id = public.current_organization_id());

-- Workspace Docs RLS
drop policy if exists "workspace_docs_select_policy" on public.workspace_docs;
create policy "workspace_docs_select_policy"
  on public.workspace_docs for select
  using (organization_id = public.current_organization_id());

drop policy if exists "workspace_docs_insert_policy" on public.workspace_docs;
create policy "workspace_docs_insert_policy"
  on public.workspace_docs for insert
  with check (organization_id = public.current_organization_id());

drop policy if exists "workspace_docs_update_policy" on public.workspace_docs;
create policy "workspace_docs_update_policy"
  on public.workspace_docs for update
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

drop policy if exists "workspace_docs_delete_policy" on public.workspace_docs;
create policy "workspace_docs_delete_policy"
  on public.workspace_docs for delete
  using (organization_id = public.current_organization_id());

-- Workspace Whiteboards RLS
drop policy if exists "workspace_whiteboards_select_policy" on public.workspace_whiteboards;
create policy "workspace_whiteboards_select_policy"
  on public.workspace_whiteboards for select
  using (organization_id = public.current_organization_id());

drop policy if exists "workspace_whiteboards_insert_policy" on public.workspace_whiteboards;
create policy "workspace_whiteboards_insert_policy"
  on public.workspace_whiteboards for insert
  with check (organization_id = public.current_organization_id());

drop policy if exists "workspace_whiteboards_update_policy" on public.workspace_whiteboards;
create policy "workspace_whiteboards_update_policy"
  on public.workspace_whiteboards for update
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

drop policy if exists "workspace_whiteboards_delete_policy" on public.workspace_whiteboards;
create policy "workspace_whiteboards_delete_policy"
  on public.workspace_whiteboards for delete
  using (organization_id = public.current_organization_id());

grant all on table public.task_stages to authenticated;
grant all on table public.workspace_docs to authenticated;
grant all on table public.workspace_whiteboards to authenticated;

-- 6. Update Triggers for timestamp
drop trigger if exists trigger_set_updated_at_workspace_docs on public.workspace_docs;
create trigger trigger_set_updated_at_workspace_docs
  before update on public.workspace_docs
  for each row execute procedure public.set_updated_at();

drop trigger if exists trigger_set_updated_at_workspace_whiteboards on public.workspace_whiteboards;
create trigger trigger_set_updated_at_workspace_whiteboards
  before update on public.workspace_whiteboards
  for each row execute procedure public.set_updated_at();

create index if not exists idx_workspace_docs_parent
  on public.workspace_docs(parent_id);

-- 7. Seed Default Stages for existing organizations and backfill stage_id
do $$
declare
  org record;
  s_todo uuid;
  s_in_progress uuid;
  s_in_review uuid;
  s_blocked uuid;
  s_done uuid;
begin
  for org in select id from public.organizations loop
    if not exists (select 1 from public.task_stages where organization_id = org.id) then
      insert into public.task_stages (organization_id, name, color, order_index, is_done_stage)
      values (org.id, 'To Do', '#64748b', 0, false)
      returning id into s_todo;

      insert into public.task_stages (organization_id, name, color, order_index, is_done_stage)
      values (org.id, 'In Progress', '#3b82f6', 1, false)
      returning id into s_in_progress;

      insert into public.task_stages (organization_id, name, color, order_index, is_done_stage)
      values (org.id, 'In Review', '#eab308', 2, false)
      returning id into s_in_review;

      insert into public.task_stages (organization_id, name, color, order_index, is_done_stage)
      values (org.id, 'Blocked', '#ef4444', 3, false)
      returning id into s_blocked;

      insert into public.task_stages (organization_id, name, color, order_index, is_done_stage)
      values (org.id, 'Done', '#22c55e', 4, true)
      returning id into s_done;

      -- Map existing tasks for this org to the new stages
      update public.tasks
      set stage_id = s_todo
      where organization_id = org.id and (status = 'todo' or status is null);

      update public.tasks
      set stage_id = s_in_progress
      where organization_id = org.id and status = 'in_progress';

      update public.tasks
      set stage_id = s_in_review
      where organization_id = org.id and status in ('in_review', 'review');

      update public.tasks
      set stage_id = s_blocked
      where organization_id = org.id and status = 'blocked';

      update public.tasks
      set stage_id = s_done
      where organization_id = org.id and status = 'done';

      -- Fallback: any remaining tasks without stage_id
      update public.tasks
      set stage_id = s_todo
      where organization_id = org.id and stage_id is null;
    end if;
  end loop;
end $$;

