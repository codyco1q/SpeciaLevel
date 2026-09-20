-- Fix slug regex character range for calendar_booking_profiles
alter table public.calendar_booking_profiles
  drop constraint if exists chk_calendar_booking_profiles_slug_format;

alter table public.calendar_booking_profiles
  add constraint chk_calendar_booking_profiles_slug_format check (slug ~ '^[a-z0-9_-]+$');
