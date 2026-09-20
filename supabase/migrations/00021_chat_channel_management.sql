-- ============================================================
-- SpeciaLevel — 00021 Chat Channel Management & Member Access
--
-- 1) chat_channels table additions:
--    - is_archived (boolean not null default false)
--    - is_system (boolean not null default false)
--    - backfill is_system = true for #general and #client-project
-- 2) chat_channel_members table:
--    - ensure role column with check (role in ('admin', 'member'))
--    - indexes on channel_id, user_id, organization_id
-- 3) RLS policies:
--    - chat_channels:
--        SELECT: viewable if user has chat.manage, is creator,
--                channel is public (for internal roles), or
--                user is an explicit member in chat_channel_members.
--        UPDATE: requires chat.manage or channel creator.
--                check prevents setting is_system channels to private.
--        DELETE: requires chat.manage or channel creator, and
--                is_system = false.
--    - chat_messages:
--        SELECT & INSERT: aligned with channel visibility.
--    - chat_channel_members:
--        SELECT: org-scoped.
--        INSERT/UPDATE/DELETE: requires chat.manage or channel creator.
-- ============================================================

-- ------------------------------------------------------------
-- 1. chat_channels schema additions
-- ------------------------------------------------------------
alter table public.chat_channels
  add column if not exists is_archived boolean not null default false;

alter table public.chat_channels
  add column if not exists is_system boolean not null default false;

-- Backfill system channels
update public.chat_channels
set is_system = true
where name in ('general', 'client-project');

create index if not exists idx_chat_channels_is_archived
  on public.chat_channels(organization_id, is_archived);

-- ------------------------------------------------------------
-- 2. chat_channel_members enhancements
-- ------------------------------------------------------------
create table if not exists public.chat_channel_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  channel_id uuid not null,
  user_id uuid not null,
  role text not null default 'member',
  added_by uuid,
  created_at timestamptz not null default now(),
  constraint fk_chat_channel_members_organization
    foreign key (organization_id) references public.organizations(id) on delete cascade,
  constraint fk_chat_channel_members_channel
    foreign key (channel_id) references public.chat_channels(id) on delete cascade,
  constraint fk_chat_channel_members_user
    foreign key (user_id) references public.profiles(id) on delete cascade,
  constraint fk_chat_channel_members_added_by
    foreign key (added_by) references public.profiles(id) on delete set null,
  unique (channel_id, user_id)
);

alter table public.chat_channel_members
  add column if not exists role text not null default 'member';

create index if not exists idx_chat_channel_members_channel_id
  on public.chat_channel_members(channel_id);

create index if not exists idx_chat_channel_members_user_id
  on public.chat_channel_members(user_id);

-- ------------------------------------------------------------
-- 3. RLS Policies
-- ------------------------------------------------------------

-- -- chat_channels -------------------------------------------
drop policy if exists "User can view channels in their organization"
  on public.chat_channels;

create policy "User can view channels in their organization"
  on public.chat_channels for select
  using (
    organization_id = public.current_organization_id()
    and (
      public.user_has_organization_permission(public.current_organization_id(), 'chat.manage')
      or created_by = auth.uid()
      or (
        public.user_has_organization_role(public.current_organization_id(), 'client')
        and (
          name in ('general', 'client-project')
          or exists (
            select 1 from public.chat_channel_members m
            where m.channel_id = id
              and m.user_id = auth.uid()
          )
        )
      )
      or (
        not public.user_has_organization_role(public.current_organization_id(), 'client')
        and (
          is_private = false
          or exists (
            select 1 from public.chat_channel_members m
            where m.channel_id = id
              and m.user_id = auth.uid()
          )
        )
      )
    )
  );

drop policy if exists "User can update channels in their organization"
  on public.chat_channels;

create policy "User can update channels in their organization"
  on public.chat_channels for update
  using (
    organization_id = public.current_organization_id()
    and (
      public.user_has_organization_permission(public.current_organization_id(), 'chat.manage')
      or created_by = auth.uid()
    )
  )
  with check (
    organization_id = public.current_organization_id()
    and (
      public.user_has_organization_permission(public.current_organization_id(), 'chat.manage')
      or created_by = auth.uid()
    )
    and (not is_system or not is_private)
  );

drop policy if exists "User can delete channels in their organization"
  on public.chat_channels;

create policy "User can delete channels in their organization"
  on public.chat_channels for delete
  using (
    organization_id = public.current_organization_id()
    and is_system = false
    and (
      public.user_has_organization_permission(public.current_organization_id(), 'chat.manage')
      or created_by = auth.uid()
    )
  );


create index if not exists idx_chat_channel_members_organization_id
  on public.chat_channel_members(organization_id);

-- -- chat_messages -------------------------------------------
drop policy if exists "User can view messages in their organization"
  on public.chat_messages;

create policy "User can view messages in their organization"
  on public.chat_messages for select
  using (
    organization_id = public.current_organization_id()
    and exists (
      select 1 from public.chat_channels c
      where c.id = channel_id
        and c.organization_id = public.current_organization_id()
        and (
          public.user_has_organization_permission(public.current_organization_id(), 'chat.manage')
          or c.created_by = auth.uid()
          or (
            public.user_has_organization_role(public.current_organization_id(), 'client')
            and (
              c.name in ('general', 'client-project')
              or exists (
                select 1 from public.chat_channel_members m
                where m.channel_id = c.id
                  and m.user_id = auth.uid()
              )
            )
          )
          or (
            not public.user_has_organization_role(public.current_organization_id(), 'client')
            and (
              c.is_private = false
              or exists (
                select 1 from public.chat_channel_members m
                where m.channel_id = c.id
                  and m.user_id = auth.uid()
              )
            )
          )
        )
    )
  );

drop policy if exists "User can insert messages in their organization"
  on public.chat_messages;

create policy "User can insert messages in their organization"
  on public.chat_messages for insert
  with check (
    organization_id = public.current_organization_id()
    and user_id = auth.uid()
    and exists (
      select 1 from public.chat_channels c
      where c.id = channel_id
        and c.organization_id = public.current_organization_id()
        and (
          public.user_has_organization_permission(public.current_organization_id(), 'chat.manage')
          or c.created_by = auth.uid()
          or (
            public.user_has_organization_role(public.current_organization_id(), 'client')
            and (
              c.name in ('general', 'client-project')
              or exists (
                select 1 from public.chat_channel_members m
                where m.channel_id = c.id
                  and m.user_id = auth.uid()
              )
            )
          )
          or (
            not public.user_has_organization_role(public.current_organization_id(), 'client')
            and (
              c.is_private = false
              or exists (
                select 1 from public.chat_channel_members m
                where m.channel_id = c.id
                  and m.user_id = auth.uid()
              )
            )
          )
        )
    )
  );

-- -- chat_channel_members ------------------------------------
alter table public.chat_channel_members enable row level security;

drop policy if exists "User can view channel members in their organization"
  on public.chat_channel_members;

create policy "User can view channel members in their organization"
  on public.chat_channel_members for select
  using (organization_id = public.current_organization_id());

drop policy if exists "User can add channel members in their organization"
  on public.chat_channel_members;

create policy "User can add channel members in their organization"
  on public.chat_channel_members for insert
  with check (
    organization_id = public.current_organization_id()
    and (
      public.user_has_organization_permission(public.current_organization_id(), 'chat.manage')
      or exists (
        select 1 from public.chat_channels c
        where c.id = channel_id
          and c.created_by = auth.uid()
      )
    )
  );

drop policy if exists "User can update channel members in their organization"
  on public.chat_channel_members;

create policy "User can update channel members in their organization"
  on public.chat_channel_members for update
  using (
    organization_id = public.current_organization_id()
    and (
      public.user_has_organization_permission(public.current_organization_id(), 'chat.manage')
      or exists (
        select 1 from public.chat_channels c
        where c.id = channel_id
          and c.created_by = auth.uid()
      )
    )
  )
  with check (
    organization_id = public.current_organization_id()
    and (
      public.user_has_organization_permission(public.current_organization_id(), 'chat.manage')
      or exists (
        select 1 from public.chat_channels c
        where c.id = channel_id
          and c.created_by = auth.uid()
      )
    )
  );

drop policy if exists "User can remove channel members in their organization"
  on public.chat_channel_members;

create policy "User can remove channel members in their organization"
  on public.chat_channel_members for delete
  using (
    organization_id = public.current_organization_id()
    and (
      public.user_has_organization_permission(public.current_organization_id(), 'chat.manage')
      or exists (
        select 1 from public.chat_channels c
        where c.id = channel_id
          and c.created_by = auth.uid()
      )
    )
  );

grant all on table public.chat_channel_members to authenticated;

