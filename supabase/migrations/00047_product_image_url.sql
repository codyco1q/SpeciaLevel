-- UpLevel — 00047 Product Image URL & Catalog Enhancements
-- Milestone 2: Product image upload and catalog enhancement

alter table public.products
  add column if not exists image_url text;

notify pgrst, 'reload schema';

