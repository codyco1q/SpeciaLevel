-- ============================================================
-- UpLevel — 00039 Advanced Tasks & Docs (ClickUp + Notion Hybrid)
-- ============================================================

-- 1. Update public.tasks table schema
alter table public.tasks
  add column if not exists parent_id uuid references public.tasks(id) on delete cascade,
  add column if not exists description_json jsonb not null default '[]'::jsonb,
  add column if not exists description_text text not null default '',
  add column if not exists start_date timestamptz,
  add column if not exists estimated_hours numeric(5,2),
  add column if not exists tags jsonb not null default '[]'::jsonb,
  add column if not exists is_doc boolean not null default false,
  add column if not exists order_index int not null default 0;

-- Backfill description_text from existing description column if present
do $$
begin
  if exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'tasks' and column_name = 'description'
  ) then
    update public.tasks
    set description_text = coalesce(description, '')
    where description_text = '' and description is not null;
  end if;
end $$;

-- Update existing status 'review' to 'in_review'
update public.tasks
set status = 'in_review'
where status = 'review';

-- Update check constraints for status and priority
alter table public.tasks drop constraint if exists chk_tasks_status;
alter table public.tasks add constraint chk_tasks_status
  check (status in ('todo', 'in_progress', 'in_review', 'blocked', 'done'));

alter table public.tasks drop constraint if exists chk_tasks_priority;
alter table public.tasks add constraint chk_tasks_priority
  check (priority in ('urgent', 'high', 'medium', 'low', 'none'));

-- Modify created_by to allow null on delete
alter table public.tasks drop constraint if exists fk_tasks_created_by;
alter table public.tasks add constraint fk_tasks_created_by
  foreign key (created_by) references public.profiles(id) on delete set null;

-- Indexes for high-performance querying
create index if not exists idx_tasks_parent_id on public.tasks(parent_id);
create index if not exists idx_tasks_is_doc on public.tasks(organization_id, is_doc);
create index if not exists idx_tasks_order_index on public.tasks(organization_id, order_index);
create index if not exists idx_tasks_due_date on public.tasks(organization_id, due_date);
create index if not exists idx_tasks_start_date on public.tasks(organization_id, start_date);

-- 2. Create public.task_comments table
create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_task_comments_task_id
  on public.task_comments(task_id, created_at asc);

create index if not exists idx_task_comments_org_id
  on public.task_comments(organization_id);

-- 3. Row Level Security Policies for task_comments
alter table public.tasks enable row level security;
alter table public.task_comments enable row level security;

drop policy if exists "task_comments_select_policy" on public.task_comments;
create policy "task_comments_select_policy"
  on public.task_comments for select
  using (organization_id = public.current_organization_id());

drop policy if exists "task_comments_insert_policy" on public.task_comments;
create policy "task_comments_insert_policy"
  on public.task_comments for insert
  with check (
    organization_id = public.current_organization_id()
    and user_id = auth.uid()
  );

drop policy if exists "task_comments_update_policy" on public.task_comments;
create policy "task_comments_update_policy"
  on public.task_comments for update
  using (
    organization_id = public.current_organization_id()
    and user_id = auth.uid()
  )
  with check (
    organization_id = public.current_organization_id()
    and user_id = auth.uid()
  );

drop policy if exists "task_comments_delete_policy" on public.task_comments;
create policy "task_comments_delete_policy"
  on public.task_comments for delete
  using (organization_id = public.current_organization_id());

grant all on table public.tasks to authenticated;
grant all on table public.task_comments to authenticated;

-- 4. Automatic updated_at trigger for tasks
drop trigger if exists trigger_set_updated_at_tasks on public.tasks;
create trigger trigger_set_updated_at_tasks
  before update on public.tasks
  for each row execute procedure public.set_updated_at();
