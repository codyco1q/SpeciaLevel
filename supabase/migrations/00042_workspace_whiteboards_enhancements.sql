-- ============================================================
-- UpLevel — 00042 Workspace Whiteboards Enhancements & Task Attachments
-- ============================================================

-- 1. Create workspace_whiteboard_folders table
create table if not exists public.workspace_whiteboard_folders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  color text not null default '#64748b',
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_whiteboard_folders_org
  on public.workspace_whiteboard_folders(organization_id, order_index asc);

-- 2. Add folder_id and task_id to workspace_whiteboards
alter table public.workspace_whiteboards
  add column if not exists folder_id uuid references public.workspace_whiteboard_folders(id) on delete set null;

alter table public.workspace_whiteboards
  add column if not exists task_id uuid references public.tasks(id) on delete set null;

create index if not exists idx_workspace_whiteboards_folder
  on public.workspace_whiteboards(folder_id);

create index if not exists idx_workspace_whiteboards_task
  on public.workspace_whiteboards(task_id);

-- 3. Create task_whiteboards junction table (multi-task attachment)
create table if not exists public.task_whiteboards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  whiteboard_id uuid not null references public.workspace_whiteboards(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(task_id, whiteboard_id)
);

create index if not exists idx_task_whiteboards_task
  on public.task_whiteboards(task_id);

create index if not exists idx_task_whiteboards_wb
  on public.task_whiteboards(whiteboard_id);

-- 4. Enable RLS
alter table public.workspace_whiteboard_folders enable row level security;
alter table public.task_whiteboards enable row level security;

-- Folders RLS
drop policy if exists "workspace_whiteboard_folders_select" on public.workspace_whiteboard_folders;
create policy "workspace_whiteboard_folders_select"
  on public.workspace_whiteboard_folders for select
  using (organization_id = public.current_organization_id());

drop policy if exists "workspace_whiteboard_folders_insert" on public.workspace_whiteboard_folders;
create policy "workspace_whiteboard_folders_insert"
  on public.workspace_whiteboard_folders for insert
  with check (organization_id = public.current_organization_id());

drop policy if exists "workspace_whiteboard_folders_update" on public.workspace_whiteboard_folders;
create policy "workspace_whiteboard_folders_update"
  on public.workspace_whiteboard_folders for update
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

drop policy if exists "workspace_whiteboard_folders_delete" on public.workspace_whiteboard_folders;
create policy "workspace_whiteboard_folders_delete"
  on public.workspace_whiteboard_folders for delete
  using (organization_id = public.current_organization_id());

-- Task Whiteboards RLS
drop policy if exists "task_whiteboards_select" on public.task_whiteboards;
create policy "task_whiteboards_select"
  on public.task_whiteboards for select
  using (organization_id = public.current_organization_id());

drop policy if exists "task_whiteboards_insert" on public.task_whiteboards;
create policy "task_whiteboards_insert"
  on public.task_whiteboards for insert
  with check (organization_id = public.current_organization_id());

drop policy if exists "task_whiteboards_delete" on public.task_whiteboards;
create policy "task_whiteboards_delete"
  on public.task_whiteboards for delete
  using (organization_id = public.current_organization_id());

grant all on table public.workspace_whiteboard_folders to authenticated;
grant all on table public.task_whiteboards to authenticated;
