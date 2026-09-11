-- ============================================================
-- UpLevel — 00006 Calendar: add assigned_user_id
-- Adds the ability to assign calendar events to a specific
-- employee (optional). Existing events remain unassigned.
-- ============================================================

alter table public.calendar_events
  add column if not exists assigned_user_id uuid
    references public.profiles(id) on delete set null;

create index if not exists idx_calendar_events_assigned_user_id
  on public.calendar_events(assigned_user_id);
