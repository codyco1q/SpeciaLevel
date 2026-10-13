-- UpLevel / SpeciaLevel — 00049 Chat replies and emoji reactions
-- Adds reply_to_id and reactions columns to public.chat_messages

alter table public.chat_messages
  add column if not exists reply_to_id uuid references public.chat_messages(id) on delete set null,
  add column if not exists reactions jsonb not null default '{}'::jsonb;

create index if not exists idx_chat_messages_reply_to_id
  on public.chat_messages(reply_to_id);
