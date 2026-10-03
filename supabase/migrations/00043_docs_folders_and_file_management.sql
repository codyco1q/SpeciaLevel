-- ============================================================
-- UpLevel — 00043 Docs & Notes Folders and File Management
-- ============================================================

-- 1. Add doc_type and color to workspace_docs
alter table public.workspace_docs
  add column if not exists doc_type text not null default 'doc',
  add column if not exists color text default null;

-- Add check constraint for doc_type
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'workspace_docs_doc_type_check'
  ) then
    alter table public.workspace_docs
      add constraint workspace_docs_doc_type_check
      check (doc_type in ('doc', 'folder'));
  end if;
end $$;

-- 2. Add index for faster folder and hierarchy querying
create index if not exists idx_workspace_docs_type
  on public.workspace_docs(organization_id, doc_type);

create index if not exists idx_workspace_docs_parent_type
  on public.workspace_docs(parent_id, doc_type);
