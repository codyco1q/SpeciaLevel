-- ============================================================
-- SpeciaLevel — 00031 Organization Branding, Settings & Storage
-- ============================================================

-- 1. Add branding, contact, address, localization, security, and billing columns to public.organizations
alter table public.organizations
  add column if not exists logo_url text,
  add column if not exists legal_name text,
  add column if not exists tax_id text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists website text,
  add column if not exists address jsonb not null default '{"street": "", "city": "", "state": "", "country": "", "postal_code": ""}'::jsonb,
  add column if not exists default_currency text not null default 'USD',
  add column if not exists timezone text not null default 'Africa/Cairo',
  add column if not exists date_format text not null default 'YYYY-MM-DD',
  add column if not exists security_settings jsonb not null default '{"allowed_domains": [], "session_timeout_minutes": 0, "prevent_member_deletion": false}'::jsonb,
  add column if not exists billing_defaults jsonb not null default '{"payment_terms": "net_30", "default_tax_rate": 0, "bank_name": "", "iban": "", "swift": "", "instructions": ""}'::jsonb;

-- 2. Create organization-assets storage bucket for tenant logos and assets
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'organization-assets',
  'organization-assets',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public = true,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp', 'image/gif'];

-- 3. Storage RLS Policies for organization-assets
-- Allow public / authenticated reads for tenant logos
create policy "Organization assets are publicly readable"
  on storage.objects for select
  using (bucket_id = 'organization-assets');

-- Allow organization managers/admins/owners to upload/insert logo files under their org directory
create policy "Organization admins can upload organization assets"
  on storage.objects for insert
  with check (
    bucket_id = 'organization-assets'
    and (storage.foldername(name))[1] = public.current_organization_id()::text
    and not public.user_has_organization_role(public.current_organization_id(), 'client')
  );

-- Allow organization managers/admins/owners to update logo files under their org directory
create policy "Organization admins can update organization assets"
  on storage.objects for update
  using (
    bucket_id = 'organization-assets'
    and (storage.foldername(name))[1] = public.current_organization_id()::text
    and not public.user_has_organization_role(public.current_organization_id(), 'client')
  );

-- Allow organization managers/admins/owners to delete logo files under their org directory
create policy "Organization admins can delete organization assets"
  on storage.objects for delete
  using (
    bucket_id = 'organization-assets'
    and (storage.foldername(name))[1] = public.current_organization_id()::text
    and not public.user_has_organization_role(public.current_organization_id(), 'client')
  );
