alter table public.companies
  add column if not exists objective text;

alter table public.whatsapp_messages
  add column if not exists media jsonb default '[]'::jsonb;

create unique index if not exists whatsapp_messages_chat_fingerprint_uidx
  on public.whatsapp_messages (chat_key, message_fingerprint);

create table if not exists public.auto_reply_queue (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,
  chat_key text not null,
  triggered_by_message_id uuid references public.whatsapp_messages(id),
  trigger_at timestamptz not null,
  status text not null default 'waiting' check (status in ('waiting','cancelled','generating','sent','failed')),
  generated_message text,
  message_sent text,
  error text,
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists auto_reply_queue_trigger_idx
  on public.auto_reply_queue (status, trigger_at);

alter table public.auto_reply_queue enable row level security;

drop policy if exists auto_reply_queue_all on public.auto_reply_queue;
create policy auto_reply_queue_all on public.auto_reply_queue
  for all to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());
