-- ============================================================
-- UpLevel — 00020 Contacts Directory & 360° Contact Profile
--
-- 1) Enriches public.crm_contacts with profile fields: title,
--    notes, address, tags, and created_by (the profile who added
--    the contact). Existing rows are backfilled so created_by is
--    never null for tenant-owned contacts when a profile exists.
-- 2) Creates public.crm_contact_notes — internal per-contact
--    notes with an author profile link (cascade-deleted with the
--    contact).
-- 3) RLS:
--      crm_contacts   — SELECT now additionally requires
--                       `crm.view`; INSERT / UPDATE / DELETE
--                       require `crm.manage` (the 00011 policies
--                       were org-scoped only, which let any org
--                       member write contacts). The insert policy
--                       also stamps created_by = auth.uid().
--      crm_contact_notes — tenant-scoped with the same split:
--                       read with crm.view, write with crm.manage.
-- 4) New join indexes on crm_deals(contact_id) and
--    invoices(contact_id) so the contact profile's Deals/Invoices
--    lists stay fast at any volume.
-- ============================================================

-- ------------------------------------------------------------
-- 1. crm_contacts enrichment
-- ------------------------------------------------------------
alter table public.crm_contacts
  add column if not exists title text;

alter table public.crm_contacts
  add column if not exists notes text;

alter table public.crm_contacts
  add column if not exists address text;

alter table public.crm_contacts
  add column if not exists tags text[] not null default '{}';

alter table public.crm_contacts
  add column if not exists created_by uuid;

-- Backfill created_by for contacts created before this migration:
-- attribute each one to the oldest profile in the same organization
-- (deterministic pick; null when the org has no profiles yet).
update public.crm_contacts c
set created_by = sub.first_profile_id
from (
  select p.organization_id, min(p.id::text)::uuid as first_profile_id
  from public.profiles p
  where p.organization_id is not null
  group by p.organization_id
) sub
where c.organization_id = sub.organization_id
  and c.created_by is null;

alter table public.crm_contacts
  add constraint fk_crm_contacts_created_by
  foreign key (created_by) references public.profiles(id) on delete set null;

-- Tags lookup + the two join indexes used by the 360° profile.
create index if not exists idx_crm_contacts_tags
  on public.crm_contacts using gin (tags);

create index if not exists idx_crm_deals_contact_id
  on public.crm_deals(contact_id);

create index if not exists idx_invoices_contact_id
  on public.invoices(contact_id);

-- ------------------------------------------------------------
-- 2. crm_contact_notes
-- ------------------------------------------------------------
create table if not exists public.crm_contact_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  contact_id uuid not null,
  content text not null,
  author_id uuid not null,
  created_at timestamptz not null default now(),
  constraint fk_crm_contact_notes_organization
    foreign key (organization_id) references public.organizations(id) on delete cascade,
  constraint fk_crm_contact_notes_contact
    foreign key (contact_id) references public.crm_contacts(id) on delete cascade,
  constraint fk_crm_contact_notes_author
    foreign key (author_id) references public.profiles(id) on delete cascade,
  constraint chk_crm_contact_notes_content_not_blank
    check (length(btrim(content)) > 0)
);

create index if not exists idx_crm_contact_notes_organization_id
  on public.crm_contact_notes(organization_id);

create index if not exists idx_crm_contact_notes_contact_created
  on public.crm_contact_notes(contact_id, created_at desc);

-- ------------------------------------------------------------
-- 3. RLS
-- ------------------------------------------------------------
-- crm_contacts — read needs crm.view, write needs crm.manage.
-- Replace the org-only policies created in 00011 (the new ones are
-- strictly narrower, so this is safe on already-migrated databases).
drop policy if exists "User can view contacts in their organization"
  on public.crm_contacts;

drop policy if exists "User can create contacts in their organization"
  on public.crm_contacts;

drop policy if exists "User can update contacts in their organization"
  on public.crm_contacts;

drop policy if exists "User can delete contacts in their organization"
  on public.crm_contacts;

create policy "Contacts view requires crm.view"
  on public.crm_contacts for select
  using (
    organization_id = public.current_organization_id()
    and public.user_has_organization_permission(
      public.current_organization_id(), 'crm.view'
    )
  );

create policy "Contacts insert requires crm.manage"
  on public.crm_contacts for insert
  with check (
    organization_id = public.current_organization_id()
    and created_by = auth.uid()
    and public.user_has_organization_permission(
      public.current_organization_id(), 'crm.manage'
    )
  );

create policy "Contacts update requires crm.manage"
  on public.crm_contacts for update
  using (
    organization_id = public.current_organization_id()
    and public.user_has_organization_permission(
      public.current_organization_id(), 'crm.manage'
    )
  )
  with check (
    organization_id = public.current_organization_id()
    and public.user_has_organization_permission(
      public.current_organization_id(), 'crm.manage'
    )
  );

create policy "Contacts delete requires crm.manage"
  on public.crm_contacts for delete
  using (
    organization_id = public.current_organization_id()
    and public.user_has_organization_permission(
      public.current_organization_id(), 'crm.manage'
    )
  );

-- crm_contact_notes — same read/view + write/manage split.
alter table public.crm_contact_notes enable row level security;

create policy "Contact notes view requires crm.view"
  on public.crm_contact_notes for select
  using (
    organization_id = public.current_organization_id()
    and public.user_has_organization_permission(
      public.current_organization_id(), 'crm.view'
    )
  );

create policy "Contact notes insert requires crm.manage"
  on public.crm_contact_notes for insert
  with check (
    organization_id = public.current_organization_id()
    and author_id = auth.uid()
    and public.user_has_organization_permission(
      public.current_organization_id(), 'crm.manage'
    )
  );

create policy "Contact notes update requires crm.manage"
  on public.crm_contact_notes for update
  using (
    organization_id = public.current_organization_id()
    and public.user_has_organization_permission(
      public.current_organization_id(), 'crm.manage'
    )
  )
  with check (
    organization_id = public.current_organization_id()
    and public.user_has_organization_permission(
      public.current_organization_id(), 'crm.manage'
    )
  );

create policy "Contact notes delete requires crm.manage"
  on public.crm_contact_notes for delete
  using (
    organization_id = public.current_organization_id()
    and public.user_has_organization_permission(
      public.current_organization_id(), 'crm.manage'
    )
  );

-- ------------------------------------------------------------
-- 4. Grants
--    00011 granted all on crm_contacts; tables created by later
--    migrations must be granted explicitly. Notes are private org
--    data (no anon grant).
-- ------------------------------------------------------------
grant all on table public.crm_contact_notes to authenticated;