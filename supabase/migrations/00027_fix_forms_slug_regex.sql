-- Fix slug regex character range for inbound_forms
alter table public.inbound_forms
  drop constraint if exists chk_inbound_forms_slug_format;

alter table public.inbound_forms
  add constraint chk_inbound_forms_slug_format check (slug ~ '^[a-z0-9_-]+$');
