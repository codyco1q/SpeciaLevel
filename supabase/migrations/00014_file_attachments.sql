-- ============================================================
-- SpeciaLevel — 00014 File Attachments & Deliverables Hub
--
-- 1) storage.buckets.project_assets — a PRIVATE project asset
--    bucket (public access disabled) with a 25MB per-file limit.
-- 2) public.file_attachments — organization-scoped metadata for
--    every stored object. Each row links to exactly ONE parent:
--    a task (deliverable) OR a chat message (inline file).
-- 3) RLS: internal roles (any non-Client member) get full
--    SELECT/INSERT/DELETE within the org. A Client caller can only
--    SELECT rows that are is_client_visible AND whose parent is
--    reachable by them (client-visible task / their contact's task
--    / a channel they can read).
-- 4) Storage object RLS on project_assets: paths are scoped as
--    {organization_id}/tasks/{task_id}/{file_id}-{filename} and
--    {organization_id}/chat/{channel_id}/{file_id}-{filename}.
--    Writes are internal-only and bounded to the caller's org
--    segment; reads additionally require a matching
--    file_attachments row visible under the caller's own RLS.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Private project_assets bucket (25 MB per file)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('project_assets', 'project_assets', false, 26214400)
on conflict (id) do update
  set public = false,
      file_size_limit = 26214400;

-- ------------------------------------------------------------
-- 2. file_attachments
-- ------------------------------------------------------------
create table if not exists public.file_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  task_id uuid,
  message_id uuid,
  file_name text not null,
  file_size bigint not null,
  file_type text not null,
  storage_path text not null,
  is_client_visible boolean not null default false,
  uploaded_by uuid not null,
  created_at timestamptz not null default now(),
  constraint fk_file_attachments_organization
    foreign key (organization_id) references public.organizations(id) on delete cascade,
  constraint fk_file_attachments_task
    foreign key (task_id) references public.tasks(id) on delete cascade,
  constraint fk_file_attachments_message
    foreign key (message_id) references public.chat_messages(id) on delete cascade,
  constraint fk_file_attachments_uploaded_by
    foreign key (uploaded_by) references public.profiles(id) on delete cascade,
  -- Every attachment belongs to exactly one parent: a task deliverable
  -- OR a chat message (never both, never neither).
  constraint chk_attachment_parent
    check ((task_id is not null and message_id is null) or (task_id is null and message_id is not null))
);

create index if not exists idx_file_attachments_organization_id
  on public.file_attachments(organization_id);

create index if not exists idx_file_attachments_task_id
  on public.file_attachments(task_id);

create index if not exists idx_file_attachments_message_id
  on public.file_attachments(message_id);

create index if not exists idx_file_attachments_storage_path
  on public.file_attachments(storage_path);

-- ------------------------------------------------------------
-- 3. RLS — file_attachments
-- ------------------------------------------------------------
alter table public.file_attachments enable row level security;

-- Internal roles (anything except Client): organization-wide access.
create policy "Staff can view attachments in their organization"
  on public.file_attachments for select
  using (
    organization_id = public.current_organization_id()
    and not public.user_has_organization_role(
      public.current_organization_id(), 'client'
    )
  );
-- Client role: ONLY client-visible files whose parent is something the
-- client can already see — a task flagged client-visible or linked to
-- their CRM contact, or a message in a channel they can read
-- (#general / #client-project / explicit membership).
create policy "Clients can view attachments on accessible tasks or channels"
  on public.file_attachments for select
  using (
    organization_id = public.current_organization_id()
    and public.user_has_organization_role(
      public.current_organization_id(), 'client'
    )
    and is_client_visible
    and (
      exists (
        select 1
        from public.tasks tk
        where tk.id = file_attachments.task_id
          and tk.organization_id = file_attachments.organization_id
          and (
            tk.is_client_visible
            or tk.contact_id = (
              select p.contact_id
              from public.profiles p
              where p.id = auth.uid()
            )
          )
      )
      or exists (
        select 1
        from public.chat_messages m
        join public.chat_channels c on c.id = m.channel_id
        where m.id = file_attachments.message_id
          and c.organization_id = file_attachments.organization_id
          and (
            c.name in ('general', 'client-project')
            or exists (
              select 1 from public.chat_channel_members cm
              where cm.channel_id = c.id
                and cm.user_id = auth.uid()
            )
          )
      )
    )
  );

-- Only internal members attach files (clients are strictly download-only).
create policy "Staff can add attachments in their organization"
  on public.file_attachments for insert
  with check (
    organization_id = public.current_organization_id()
    and not public.user_has_organization_role(
      public.current_organization_id(), 'client'
    )
  );

-- ------------------------------------------------------------
-- 4. Storage object RLS — project_assets
--    Path convention: {organization_id}/tasks/{task_id}/{file_id}-{filename}
--    or {organization_id}/chat/{channel_id}/{file_id}-{filename}.
-- ------------------------------------------------------------

-- Reads: authorized only when a file_attachments row exists at the exact
-- path. The nested EXISTS runs under the caller's own RLS on
-- file_attachments, so a Client caller can only reach objects whose
-- metadata row their SELECT policy exposes (client-visible + accessible
-- parent), while internal members can read everything in their org.
create policy "Project assets are readable within your organization"
  on storage.objects for select
  using (
    bucket_id = 'project_assets'
    and (storage.foldername(name))[1] = public.current_organization_id()::text
    and exists (
      select 1
      from public.file_attachments fa
      where fa.storage_path = name
        and fa.organization_id = public.current_organization_id()
    )
  );

-- Writes: internal members only, always inside their own org segment.
create policy "Project assets are uploaded by internal members"
  on storage.objects for insert
  with check (
    bucket_id = 'project_assets'
    and (storage.foldername(name))[1] = public.current_organization_id()::text
    and not public.user_has_organization_role(
      public.current_organization_id(), 'client'
    )
  );

create policy "Project assets are updated by internal members"
  on storage.objects for update
  using (
    bucket_id = 'project_assets'
    and (storage.foldername(name))[1] = public.current_organization_id()::text
    and not public.user_has_organization_role(
      public.current_organization_id(), 'client'
    )
  )
  with check (
    bucket_id = 'project_assets'
    and (storage.foldername(name))[1] = public.current_organization_id()::text
    and not public.user_has_organization_role(
      public.current_organization_id(), 'client'
    )
  );

create policy "Project assets are deleted by internal members"
  on storage.objects for delete
  using (
    bucket_id = 'project_assets'
    and (storage.foldername(name))[1] = public.current_organization_id()::text
    and not public.user_has_organization_role(
      public.current_organization_id(), 'client'
    )
  );

create policy "Staff can delete attachments in their organization"
  on public.file_attachments for delete
  using (
    organization_id = public.current_organization_id()
    and not public.user_has_organization_role(
      public.current_organization_id(), 'client'
    )
  );

-- 00001 granted privileges on tables that existed at the time; tables
-- created by later migrations must be granted explicitly.
-- No anon grant: attachments are private organization data.
grant all on table public.file_attachments to authenticated;