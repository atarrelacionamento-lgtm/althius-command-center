-- ================================================================
-- WhatsApp Capture MVP - schema idempotente e tolerante a base legada
-- Rodar no Supabase SQL Editor. Pode ser executado varias vezes.
-- Ordem: (1) tabelas -> (2) backfill + dedup -> (3) constraints/triggers
--        -> (4) RLS/storage -> (5) checks de sanidade
-- ================================================================

-- ================================================================
-- BLOCO 1 - Extensoes, helpers e tabelas base (sem NOT NULL agressivo)
-- ================================================================

create extension if not exists pgcrypto;

create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Tabela 1: whatsapp_conversations (rollup da conversa)
create table if not exists public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  chat_key text,
  company_id uuid references public.companies(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  source text default 'extension',
  provider text,
  title text,
  last_message_at timestamptz,
  last_message_preview text,
  message_count integer default 0,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.whatsapp_conversations add column if not exists chat_key text;
alter table public.whatsapp_conversations add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table public.whatsapp_conversations add column if not exists contact_id uuid references public.contacts(id) on delete set null;
alter table public.whatsapp_conversations add column if not exists source text default 'extension';
alter table public.whatsapp_conversations add column if not exists provider text;
alter table public.whatsapp_conversations add column if not exists title text;
alter table public.whatsapp_conversations add column if not exists last_message_at timestamptz;
alter table public.whatsapp_conversations add column if not exists last_message_preview text;
alter table public.whatsapp_conversations add column if not exists message_count integer default 0;
alter table public.whatsapp_conversations add column if not exists created_by uuid references public.profiles(id) on delete set null default auth.uid();
alter table public.whatsapp_conversations add column if not exists created_at timestamptz default now();
alter table public.whatsapp_conversations add column if not exists updated_at timestamptz default now();

-- Tabela 2: whatsapp_messages
create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.whatsapp_conversations(id) on delete set null,
  chat_key text,
  company_id uuid references public.companies(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  direction text,
  message_type text default 'text',
  occurred_at timestamptz default now(),
  body text default '',
  message_fingerprint text,
  provider_message_id text,
  provider_status text,
  transcription_status text default 'not_required',
  transcript_text text,
  transcription_provider text,
  transcription_completed_at timestamptz,
  metadata jsonb default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.whatsapp_messages add column if not exists conversation_id uuid references public.whatsapp_conversations(id) on delete set null;
alter table public.whatsapp_messages add column if not exists chat_key text;
alter table public.whatsapp_messages add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table public.whatsapp_messages add column if not exists contact_id uuid references public.contacts(id) on delete set null;
alter table public.whatsapp_messages add column if not exists direction text;
alter table public.whatsapp_messages add column if not exists message_type text default 'text';
alter table public.whatsapp_messages add column if not exists occurred_at timestamptz default now();
alter table public.whatsapp_messages add column if not exists body text default '';
alter table public.whatsapp_messages add column if not exists message_fingerprint text;
alter table public.whatsapp_messages add column if not exists provider_message_id text;
alter table public.whatsapp_messages add column if not exists wa_message_id text;
alter table public.whatsapp_messages add column if not exists provider_status text;
alter table public.whatsapp_messages add column if not exists transcription_status text default 'not_required';
alter table public.whatsapp_messages add column if not exists transcript_text text;
alter table public.whatsapp_messages add column if not exists transcription_provider text;
alter table public.whatsapp_messages add column if not exists transcription_completed_at timestamptz;
alter table public.whatsapp_messages add column if not exists metadata jsonb default '{}'::jsonb;
alter table public.whatsapp_messages add column if not exists created_by uuid references public.profiles(id) on delete set null default auth.uid();
alter table public.whatsapp_messages add column if not exists created_at timestamptz default now();
alter table public.whatsapp_messages add column if not exists sent_at timestamptz;
alter table public.whatsapp_messages add column if not exists updated_at timestamptz default now();

-- Tabela 3: whatsapp_message_media
create table if not exists public.whatsapp_message_media (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references public.whatsapp_messages(id) on delete cascade,
  chat_key text,
  company_id uuid references public.companies(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  media_kind text default 'audio',
  storage_bucket text default 'whatsapp-audio',
  storage_path text,
  file_name text,
  mime_type text,
  file_size_bytes bigint,
  duration_ms integer,
  sha256 text,
  media_fingerprint text,
  provider_media_id text,
  transcription_required boolean default false,
  transcription_status text default 'not_required',
  transcript_text text,
  transcription_provider text,
  transcription_completed_at timestamptz,
  metadata jsonb default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.whatsapp_message_media add column if not exists message_id uuid references public.whatsapp_messages(id) on delete cascade;
alter table public.whatsapp_message_media add column if not exists chat_key text;
alter table public.whatsapp_message_media add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table public.whatsapp_message_media add column if not exists contact_id uuid references public.contacts(id) on delete set null;
alter table public.whatsapp_message_media add column if not exists media_kind text default 'audio';
alter table public.whatsapp_message_media add column if not exists storage_bucket text default 'whatsapp-audio';
alter table public.whatsapp_message_media add column if not exists storage_path text;
alter table public.whatsapp_message_media add column if not exists file_name text;
alter table public.whatsapp_message_media add column if not exists mime_type text;
alter table public.whatsapp_message_media add column if not exists file_size_bytes bigint;
alter table public.whatsapp_message_media add column if not exists duration_ms integer;
alter table public.whatsapp_message_media add column if not exists sha256 text;
alter table public.whatsapp_message_media add column if not exists media_fingerprint text;
alter table public.whatsapp_message_media add column if not exists provider_media_id text;
alter table public.whatsapp_message_media add column if not exists transcription_required boolean default false;
alter table public.whatsapp_message_media add column if not exists transcription_status text default 'not_required';
alter table public.whatsapp_message_media add column if not exists transcript_text text;
alter table public.whatsapp_message_media add column if not exists transcription_provider text;
alter table public.whatsapp_message_media add column if not exists transcription_completed_at timestamptz;
alter table public.whatsapp_message_media add column if not exists metadata jsonb default '{}'::jsonb;
alter table public.whatsapp_message_media add column if not exists created_by uuid references public.profiles(id) on delete set null default auth.uid();
alter table public.whatsapp_message_media add column if not exists created_at timestamptz default now();
alter table public.whatsapp_message_media add column if not exists updated_at timestamptz default now();

-- Tabela 4: transcription_jobs
create table if not exists public.transcription_jobs (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references public.whatsapp_messages(id) on delete cascade,
  media_id uuid references public.whatsapp_message_media(id) on delete cascade,
  chat_key text,
  company_id uuid references public.companies(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  status text default 'queued',
  provider text,
  provider_job_id text,
  requested_language text,
  detected_language text,
  transcript_text text,
  transcript_segments jsonb default '[]'::jsonb,
  metadata jsonb default '{}'::jsonb,
  error_code text,
  error_message text,
  attempt_count integer default 0,
  queued_at timestamptz default now(),
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.transcription_jobs add column if not exists message_id uuid references public.whatsapp_messages(id) on delete cascade;
alter table public.transcription_jobs add column if not exists media_id uuid references public.whatsapp_message_media(id) on delete cascade;
alter table public.transcription_jobs add column if not exists chat_key text;
alter table public.transcription_jobs add column if not exists company_id uuid references public.companies(id) on delete set null;
alter table public.transcription_jobs add column if not exists contact_id uuid references public.contacts(id) on delete set null;
alter table public.transcription_jobs add column if not exists status text default 'queued';
alter table public.transcription_jobs add column if not exists provider text;
alter table public.transcription_jobs add column if not exists provider_job_id text;
alter table public.transcription_jobs add column if not exists requested_language text;
alter table public.transcription_jobs add column if not exists detected_language text;
alter table public.transcription_jobs add column if not exists transcript_text text;
alter table public.transcription_jobs add column if not exists transcript_segments jsonb default '[]'::jsonb;
alter table public.transcription_jobs add column if not exists metadata jsonb default '{}'::jsonb;
alter table public.transcription_jobs add column if not exists error_code text;
alter table public.transcription_jobs add column if not exists error_message text;
alter table public.transcription_jobs add column if not exists attempt_count integer default 0;
alter table public.transcription_jobs add column if not exists queued_at timestamptz default now();
alter table public.transcription_jobs add column if not exists started_at timestamptz;
alter table public.transcription_jobs add column if not exists completed_at timestamptz;
alter table public.transcription_jobs add column if not exists failed_at timestamptz;
alter table public.transcription_jobs add column if not exists created_by uuid references public.profiles(id) on delete set null default auth.uid();
alter table public.transcription_jobs add column if not exists created_at timestamptz default now();
alter table public.transcription_jobs add column if not exists updated_at timestamptz default now();

-- ================================================================
-- BLOCO 2 - Drop NOT NULL, backfill e de-duplicacao
-- Ordem critica para nao quebrar em base legada:
--   (a) drop NOT NULL em colunas-chave
--   (b) preenche valores faltantes
--   (c) de-duplica antes dos unique indexes
-- ================================================================

-- (a) Drop NOT NULL tolerante a esquema antigo
alter table public.whatsapp_conversations alter column chat_key drop not null;
alter table public.whatsapp_conversations alter column source drop not null;
alter table public.whatsapp_conversations alter column message_count drop not null;
alter table public.whatsapp_conversations alter column created_at drop not null;
alter table public.whatsapp_conversations alter column updated_at drop not null;

alter table public.whatsapp_messages alter column conversation_id drop not null;
alter table public.whatsapp_messages alter column chat_key drop not null;
alter table public.whatsapp_messages alter column direction drop not null;
alter table public.whatsapp_messages alter column message_type drop not null;
alter table public.whatsapp_messages alter column occurred_at drop not null;
alter table public.whatsapp_messages alter column body drop not null;
alter table public.whatsapp_messages alter column message_fingerprint drop not null;
alter table public.whatsapp_messages alter column transcription_status drop not null;
alter table public.whatsapp_messages alter column metadata drop not null;
alter table public.whatsapp_messages alter column created_at drop not null;
alter table public.whatsapp_messages alter column updated_at drop not null;

alter table public.whatsapp_message_media alter column message_id drop not null;
alter table public.whatsapp_message_media alter column chat_key drop not null;
alter table public.whatsapp_message_media alter column media_kind drop not null;
alter table public.whatsapp_message_media alter column storage_bucket drop not null;
alter table public.whatsapp_message_media alter column storage_path drop not null;
alter table public.whatsapp_message_media alter column mime_type drop not null;
alter table public.whatsapp_message_media alter column transcription_required drop not null;
alter table public.whatsapp_message_media alter column transcription_status drop not null;
alter table public.whatsapp_message_media alter column metadata drop not null;
alter table public.whatsapp_message_media alter column created_at drop not null;
alter table public.whatsapp_message_media alter column updated_at drop not null;

alter table public.transcription_jobs alter column message_id drop not null;
alter table public.transcription_jobs alter column media_id drop not null;
alter table public.transcription_jobs alter column chat_key drop not null;
alter table public.transcription_jobs alter column status drop not null;
alter table public.transcription_jobs alter column transcript_segments drop not null;
alter table public.transcription_jobs alter column metadata drop not null;
alter table public.transcription_jobs alter column attempt_count drop not null;
alter table public.transcription_jobs alter column queued_at drop not null;
alter table public.transcription_jobs alter column created_at drop not null;
alter table public.transcription_jobs alter column updated_at drop not null;

-- (b) Backfill - conversations
update public.whatsapp_conversations
set chat_key = 'legacy:' || coalesce(id::text, gen_random_uuid()::text)
where chat_key is null or btrim(chat_key) = '';

update public.whatsapp_conversations
set source = 'extension' where source is null or btrim(source) = '';

update public.whatsapp_conversations
set message_count = 0 where message_count is null;

update public.whatsapp_conversations
set created_at = coalesce(created_at, now()) where created_at is null;

update public.whatsapp_conversations
set updated_at = coalesce(updated_at, created_at, now()) where updated_at is null;

-- (b) Backfill - messages
update public.whatsapp_messages
set provider_message_id = wa_message_id
where provider_message_id is null and wa_message_id is not null;

update public.whatsapp_messages wm
set
  chat_key = coalesce(nullif(btrim(wm.chat_key), ''), wc.chat_key),
  company_id = coalesce(wm.company_id, wc.company_id),
  contact_id = coalesce(wm.contact_id, wc.contact_id)
from public.whatsapp_conversations wc
where wm.conversation_id = wc.id
  and (wm.chat_key is null or btrim(wm.chat_key) = ''
       or wm.company_id is null or wm.contact_id is null);

update public.whatsapp_messages
set chat_key = 'legacy:' || coalesce(conversation_id::text, id::text)
where chat_key is null or btrim(chat_key) = '';

update public.whatsapp_messages
set occurred_at = coalesce(occurred_at, sent_at, created_at, now())
where occurred_at is null;

update public.whatsapp_messages set body = '' where body is null;
update public.whatsapp_messages set message_type = 'text' where message_type is null or btrim(message_type) = '';
update public.whatsapp_messages set metadata = '{}'::jsonb where metadata is null;
update public.whatsapp_messages set created_at = coalesce(created_at, now()) where created_at is null;
update public.whatsapp_messages set updated_at = coalesce(updated_at, created_at, now()) where updated_at is null;

update public.whatsapp_messages
set transcription_status = case when message_type = 'audio' then 'queued' else 'not_required' end
where transcription_status is null or btrim(transcription_status) = '';

update public.whatsapp_messages
set message_fingerprint = md5(
  coalesce(chat_key, '') || '|' ||
  coalesce(provider_message_id, '') || '|' ||
  coalesce(direction, '') || '|' ||
  coalesce(message_type, '') || '|' ||
  coalesce(body, '') || '|' ||
  coalesce(occurred_at::text, '')
)
where message_fingerprint is null or btrim(message_fingerprint) = '';

-- (b) Backfill - media
update public.whatsapp_message_media mm
set
  chat_key = coalesce(nullif(btrim(mm.chat_key), ''), wm.chat_key),
  company_id = coalesce(mm.company_id, wm.company_id),
  contact_id = coalesce(mm.contact_id, wm.contact_id)
from public.whatsapp_messages wm
where mm.message_id = wm.id
  and (mm.chat_key is null or btrim(mm.chat_key) = ''
       or mm.company_id is null or mm.contact_id is null);

update public.whatsapp_message_media set chat_key = 'legacy:media:' || id::text where chat_key is null or btrim(chat_key) = '';
update public.whatsapp_message_media set media_kind = 'audio' where media_kind is null or btrim(media_kind) = '';
update public.whatsapp_message_media set storage_bucket = 'whatsapp-audio' where storage_bucket is null or btrim(storage_bucket) = '';
update public.whatsapp_message_media set mime_type = 'audio/ogg' where mime_type is null or btrim(mime_type) = '';
update public.whatsapp_message_media set storage_path = 'legacy/' || id::text where storage_path is null or btrim(storage_path) = '';
update public.whatsapp_message_media set metadata = '{}'::jsonb where metadata is null;
update public.whatsapp_message_media set transcription_required = true where media_kind = 'audio' and coalesce(transcription_required, false) = false;
update public.whatsapp_message_media
set transcription_status = case when coalesce(transcription_required, false) then 'queued' else 'not_required' end
where transcription_status is null or btrim(transcription_status) = '';
update public.whatsapp_message_media
set media_fingerprint = md5(
  coalesce(chat_key, '') || '|' ||
  coalesce(storage_bucket, '') || '|' ||
  coalesce(storage_path, '') || '|' ||
  coalesce(provider_media_id, '') || '|' ||
  coalesce(sha256, '')
)
where media_fingerprint is null or btrim(media_fingerprint) = '';
update public.whatsapp_message_media set created_at = coalesce(created_at, now()) where created_at is null;
update public.whatsapp_message_media set updated_at = coalesce(updated_at, created_at, now()) where updated_at is null;

-- (b) Backfill - transcription_jobs
update public.transcription_jobs tj
set
  chat_key = coalesce(tj.chat_key, mm.chat_key, wm.chat_key),
  company_id = coalesce(tj.company_id, mm.company_id, wm.company_id),
  contact_id = coalesce(tj.contact_id, mm.contact_id, wm.contact_id)
from public.whatsapp_message_media mm
join public.whatsapp_messages wm on wm.id = mm.message_id
where tj.media_id = mm.id
  and (tj.chat_key is null or btrim(tj.chat_key) = ''
       or tj.company_id is null or tj.contact_id is null);

update public.transcription_jobs set chat_key = 'legacy:job:' || id::text where chat_key is null or btrim(chat_key) = '';
update public.transcription_jobs set status = 'queued' where status is null or btrim(status) = '';
update public.transcription_jobs set transcript_segments = '[]'::jsonb where transcript_segments is null;
update public.transcription_jobs set metadata = '{}'::jsonb where metadata is null;
update public.transcription_jobs set attempt_count = 0 where attempt_count is null;
update public.transcription_jobs set queued_at = coalesce(queued_at, created_at, now()) where queued_at is null;
update public.transcription_jobs set created_at = coalesce(created_at, now()) where created_at is null;
update public.transcription_jobs set updated_at = coalesce(updated_at, created_at, now()) where updated_at is null;

-- (c) De-duplicacao antes de criar unique indexes
-- conversations: mantem a linha mais recente por chat_key
delete from public.whatsapp_conversations c
using (
  select id,
    row_number() over (
      partition by chat_key
      order by coalesce(updated_at, created_at, now()) desc, id desc
    ) as rn
  from public.whatsapp_conversations
  where chat_key is not null
) d
where c.id = d.id and d.rn > 1;

-- messages: dedup por (chat_key, provider_message_id) quando provider_message_id existe
delete from public.whatsapp_messages m
using (
  select id,
    row_number() over (
      partition by chat_key, provider_message_id
      order by coalesce(updated_at, created_at, now()) desc, id desc
    ) as rn
  from public.whatsapp_messages
  where chat_key is not null
    and provider_message_id is not null
    and btrim(provider_message_id) <> ''
) d
where m.id = d.id and d.rn > 1;

-- messages: dedup por (chat_key, message_fingerprint)
delete from public.whatsapp_messages m
using (
  select id,
    row_number() over (
      partition by chat_key, message_fingerprint
      order by coalesce(updated_at, created_at, now()) desc, id desc
    ) as rn
  from public.whatsapp_messages
  where chat_key is not null and message_fingerprint is not null
) d
where m.id = d.id and d.rn > 1;

-- media: dedup por (storage_bucket, storage_path)
delete from public.whatsapp_message_media mm
using (
  select id,
    row_number() over (
      partition by storage_bucket, storage_path
      order by coalesce(updated_at, created_at, now()) desc, id desc
    ) as rn
  from public.whatsapp_message_media
  where storage_bucket is not null and storage_path is not null
) d
where mm.id = d.id and d.rn > 1;

-- media: dedup por (message_id, media_fingerprint)
delete from public.whatsapp_message_media mm
using (
  select id,
    row_number() over (
      partition by message_id, media_fingerprint
      order by coalesce(updated_at, created_at, now()) desc, id desc
    ) as rn
  from public.whatsapp_message_media
  where message_id is not null and media_fingerprint is not null
) d
where mm.id = d.id and d.rn > 1;

-- ================================================================
-- BLOCO 3 - Defaults, CHECKs (NOT VALID), indices e triggers
-- ================================================================

-- Defaults (aplicam-se a dados novos; nao forcam NOT NULL)
alter table public.whatsapp_conversations alter column source set default 'extension';
alter table public.whatsapp_conversations alter column message_count set default 0;
alter table public.whatsapp_conversations alter column created_at set default now();
alter table public.whatsapp_conversations alter column updated_at set default now();

alter table public.whatsapp_messages alter column message_type set default 'text';
alter table public.whatsapp_messages alter column occurred_at set default now();
alter table public.whatsapp_messages alter column body set default '';
alter table public.whatsapp_messages alter column transcription_status set default 'not_required';
alter table public.whatsapp_messages alter column metadata set default '{}'::jsonb;
alter table public.whatsapp_messages alter column created_at set default now();
alter table public.whatsapp_messages alter column updated_at set default now();

alter table public.whatsapp_message_media alter column media_kind set default 'audio';
alter table public.whatsapp_message_media alter column storage_bucket set default 'whatsapp-audio';
alter table public.whatsapp_message_media alter column transcription_required set default false;
alter table public.whatsapp_message_media alter column transcription_status set default 'not_required';
alter table public.whatsapp_message_media alter column metadata set default '{}'::jsonb;
alter table public.whatsapp_message_media alter column created_at set default now();
alter table public.whatsapp_message_media alter column updated_at set default now();

alter table public.transcription_jobs alter column status set default 'queued';
alter table public.transcription_jobs alter column transcript_segments set default '[]'::jsonb;
alter table public.transcription_jobs alter column metadata set default '{}'::jsonb;
alter table public.transcription_jobs alter column attempt_count set default 0;
alter table public.transcription_jobs alter column queued_at set default now();
alter table public.transcription_jobs alter column created_at set default now();
alter table public.transcription_jobs alter column updated_at set default now();

-- CHECKs NOT VALID (so valida dados novos; nao reprova legado)
alter table public.whatsapp_conversations drop constraint if exists whatsapp_conversations_source_check;
alter table public.whatsapp_conversations
  add constraint whatsapp_conversations_source_check
  check (source in ('manual','extension','api','import','n8n','webhook','backfill')) not valid;

alter table public.whatsapp_conversations drop constraint if exists whatsapp_conversations_message_count_check;
alter table public.whatsapp_conversations
  add constraint whatsapp_conversations_message_count_check
  check (message_count >= 0) not valid;

alter table public.whatsapp_messages drop constraint if exists whatsapp_messages_direction_check;
alter table public.whatsapp_messages
  add constraint whatsapp_messages_direction_check
  check (direction in ('inbound','outbound')) not valid;

alter table public.whatsapp_messages drop constraint if exists whatsapp_messages_message_type_check;
alter table public.whatsapp_messages
  add constraint whatsapp_messages_message_type_check
  check (message_type in ('text','audio','image','video','document','sticker','location','contact_card','system','unknown')) not valid;

alter table public.whatsapp_messages drop constraint if exists whatsapp_messages_transcription_status_check;
alter table public.whatsapp_messages
  add constraint whatsapp_messages_transcription_status_check
  check (transcription_status in ('not_required','queued','processing','completed','failed')) not valid;

alter table public.whatsapp_message_media drop constraint if exists whatsapp_message_media_media_kind_check;
alter table public.whatsapp_message_media
  add constraint whatsapp_message_media_media_kind_check
  check (media_kind in ('audio','image','video','document','sticker','other')) not valid;

alter table public.whatsapp_message_media drop constraint if exists whatsapp_message_media_transcription_status_check;
alter table public.whatsapp_message_media
  add constraint whatsapp_message_media_transcription_status_check
  check (transcription_status in ('not_required','queued','processing','completed','failed')) not valid;

alter table public.transcription_jobs drop constraint if exists transcription_jobs_status_check;
alter table public.transcription_jobs
  add constraint transcription_jobs_status_check
  check (status in ('queued','processing','completed','failed','cancelled')) not valid;

alter table public.transcription_jobs drop constraint if exists transcription_jobs_attempt_count_check;
alter table public.transcription_jobs
  add constraint transcription_jobs_attempt_count_check
  check (attempt_count >= 0) not valid;

-- Remove unique key legada de wa_message_id, se existir
alter table public.whatsapp_messages drop constraint if exists whatsapp_messages_wa_message_id_key;
drop index if exists public.whatsapp_messages_wa_message_id_key;

-- Unique CONSTRAINT em chat_key (nao parcial) - necessaria para ON CONFLICT no trigger.
-- chat_key em conversations sempre tem valor (backfill preenche, trigger exige).
drop index if exists public.idx_whatsapp_conversations_chat_key_unique;
alter table public.whatsapp_conversations
  drop constraint if exists whatsapp_conversations_chat_key_key;
alter table public.whatsapp_conversations
  add constraint whatsapp_conversations_chat_key_key unique (chat_key);

create unique index if not exists idx_whatsapp_messages_chat_provider_message_unique
  on public.whatsapp_messages(chat_key, provider_message_id)
  where chat_key is not null and provider_message_id is not null;

create unique index if not exists idx_whatsapp_messages_chat_fingerprint_unique
  on public.whatsapp_messages(chat_key, message_fingerprint)
  where chat_key is not null and message_fingerprint is not null;

create unique index if not exists idx_whatsapp_message_media_storage_unique
  on public.whatsapp_message_media(storage_bucket, storage_path)
  where storage_bucket is not null and storage_path is not null;

create unique index if not exists idx_whatsapp_message_media_fingerprint_unique
  on public.whatsapp_message_media(message_id, media_fingerprint)
  where message_id is not null and media_fingerprint is not null;

create unique index if not exists idx_transcription_jobs_active_media_unique
  on public.transcription_jobs(media_id)
  where media_id is not null and status in ('queued','processing');

create unique index if not exists idx_transcription_jobs_provider_job_unique
  on public.transcription_jobs(provider, provider_job_id)
  where provider is not null and provider_job_id is not null;

-- Indices comuns de consulta
create index if not exists idx_whatsapp_conversations_company on public.whatsapp_conversations(company_id, created_at desc);
create index if not exists idx_whatsapp_conversations_contact on public.whatsapp_conversations(contact_id, created_at desc);
create index if not exists idx_whatsapp_conversations_last_message_at on public.whatsapp_conversations(last_message_at desc nulls last);

create index if not exists idx_whatsapp_messages_conversation on public.whatsapp_messages(conversation_id, occurred_at desc);
create index if not exists idx_whatsapp_messages_company on public.whatsapp_messages(company_id, occurred_at desc);
create index if not exists idx_whatsapp_messages_contact on public.whatsapp_messages(contact_id, occurred_at desc);
create index if not exists idx_whatsapp_messages_chat_occurred_at on public.whatsapp_messages(chat_key, occurred_at desc);
create index if not exists idx_whatsapp_messages_transcription_status on public.whatsapp_messages(transcription_status, occurred_at desc);

create index if not exists idx_whatsapp_message_media_message on public.whatsapp_message_media(message_id, created_at desc);
create index if not exists idx_whatsapp_message_media_chat on public.whatsapp_message_media(chat_key, created_at desc);
create index if not exists idx_whatsapp_message_media_transcription_status on public.whatsapp_message_media(transcription_status, created_at desc);

create index if not exists idx_transcription_jobs_message on public.transcription_jobs(message_id, queued_at desc);
create index if not exists idx_transcription_jobs_chat on public.transcription_jobs(chat_key, queued_at desc);
create index if not exists idx_transcription_jobs_status on public.transcription_jobs(status, queued_at desc);

-- ── Funcoes de rollup e triggers ────────────────────────────────

create or replace function public.refresh_whatsapp_conversation_rollup_by_chat_key(p_chat_key text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_message_count integer;
  v_last_message_at timestamptz;
  v_last_message_preview text;
  v_company_id uuid;
  v_contact_id uuid;
begin
  if p_chat_key is null or btrim(p_chat_key) = '' then
    return;
  end if;

  select
    count(*)::integer,
    max(occurred_at),
    (array_agg(
      case
        when coalesce(nullif(transcript_text,''), nullif(body,'')) is not null
          then left(coalesce(nullif(transcript_text,''), nullif(body,'')), 280)
        else '[' || coalesce(message_type,'unknown') || ']'
      end
      order by occurred_at desc, created_at desc
    ))[1],
    (array_remove(array_agg(company_id order by occurred_at desc, created_at desc), null))[1],
    (array_remove(array_agg(contact_id order by occurred_at desc, created_at desc), null))[1]
  into v_message_count, v_last_message_at, v_last_message_preview, v_company_id, v_contact_id
  from public.whatsapp_messages
  where chat_key = p_chat_key;

  if coalesce(v_message_count, 0) = 0 then
    update public.whatsapp_conversations
    set message_count = 0, last_message_at = null, last_message_preview = null, updated_at = now()
    where chat_key = p_chat_key;
    return;
  end if;

  update public.whatsapp_conversations
  set
    message_count = v_message_count,
    last_message_at = v_last_message_at,
    last_message_preview = v_last_message_preview,
    company_id = coalesce(v_company_id, whatsapp_conversations.company_id),
    contact_id = coalesce(v_contact_id, whatsapp_conversations.contact_id),
    updated_at = now()
  where chat_key = p_chat_key;
end;
$$;

create or replace function public.ensure_whatsapp_conversation_for_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_conversation_id uuid;
begin
  if new.chat_key is null or btrim(new.chat_key) = '' then
    raise exception 'chat_key is required for whatsapp_messages insert/update';
  end if;

  new.occurred_at := coalesce(new.occurred_at, now());
  new.body := coalesce(new.body, '');
  new.message_type := coalesce(nullif(btrim(new.message_type), ''), 'text');
  new.metadata := coalesce(new.metadata, '{}'::jsonb);
  new.created_by := coalesce(new.created_by, auth.uid());
  new.transcription_status := coalesce(nullif(btrim(new.transcription_status), ''), 'not_required');

  if new.message_type = 'audio' and new.transcription_status = 'not_required' then
    new.transcription_status := 'queued';
  end if;

  insert into public.whatsapp_conversations (
    chat_key, company_id, contact_id, source, last_message_at, last_message_preview, created_by
  )
  values (
    new.chat_key, new.company_id, new.contact_id, 'extension', new.occurred_at,
    case
      when coalesce(nullif(new.body,''), nullif(new.transcript_text,'')) is not null
        then left(coalesce(nullif(new.transcript_text,''), nullif(new.body,'')), 280)
      else '[' || new.message_type || ']'
    end,
    coalesce(new.created_by, auth.uid())
  )
  on conflict (chat_key) do update
  set
    company_id = coalesce(excluded.company_id, public.whatsapp_conversations.company_id),
    contact_id = coalesce(excluded.contact_id, public.whatsapp_conversations.contact_id),
    last_message_at = greatest(
      coalesce(public.whatsapp_conversations.last_message_at, '-infinity'::timestamptz),
      excluded.last_message_at
    ),
    last_message_preview = case
      when public.whatsapp_conversations.last_message_at is null
        or excluded.last_message_at >= public.whatsapp_conversations.last_message_at
        then excluded.last_message_preview
      else public.whatsapp_conversations.last_message_preview
    end,
    updated_at = now()
  returning id into v_conversation_id;

  if new.conversation_id is null then
    new.conversation_id := v_conversation_id;
  end if;

  if new.message_fingerprint is null or btrim(new.message_fingerprint) = '' then
    new.message_fingerprint := md5(
      coalesce(new.chat_key,'') || '|' ||
      coalesce(new.provider_message_id,'') || '|' ||
      coalesce(new.direction,'') || '|' ||
      coalesce(new.message_type,'') || '|' ||
      coalesce(new.body,'') || '|' ||
      coalesce(new.occurred_at::text,'')
    );
  end if;

  return new;
end;
$$;

create or replace function public.after_whatsapp_message_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_whatsapp_conversation_rollup_by_chat_key(old.chat_key);
    return null;
  end if;

  if tg_op = 'UPDATE' and old.chat_key is distinct from new.chat_key then
    perform public.refresh_whatsapp_conversation_rollup_by_chat_key(old.chat_key);
  end if;

  perform public.refresh_whatsapp_conversation_rollup_by_chat_key(new.chat_key);
  return null;
end;
$$;

create or replace function public.ensure_whatsapp_media_defaults()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_message record;
begin
  if new.message_id is not null then
    select id, chat_key, company_id, contact_id into v_message
    from public.whatsapp_messages where id = new.message_id;

    if found then
      new.chat_key := coalesce(nullif(btrim(new.chat_key),''), v_message.chat_key);
      new.company_id := coalesce(new.company_id, v_message.company_id);
      new.contact_id := coalesce(new.contact_id, v_message.contact_id);
    end if;
  end if;

  new.media_kind := coalesce(nullif(btrim(new.media_kind),''), 'audio');
  new.storage_bucket := coalesce(nullif(btrim(new.storage_bucket),''), 'whatsapp-audio');
  new.mime_type := coalesce(nullif(btrim(new.mime_type),''), 'audio/ogg');
  new.metadata := coalesce(new.metadata, '{}'::jsonb);
  new.created_by := coalesce(new.created_by, auth.uid());

  if new.media_kind = 'audio' and coalesce(new.transcription_required, false) = false then
    new.transcription_required := true;
  end if;

  if coalesce(new.transcription_required, false)
     and coalesce(nullif(btrim(new.transcription_status),''), 'not_required') = 'not_required' then
    new.transcription_status := 'queued';
  else
    new.transcription_status := coalesce(nullif(btrim(new.transcription_status),''), 'not_required');
  end if;

  if new.media_fingerprint is null or btrim(new.media_fingerprint) = '' then
    new.media_fingerprint := md5(
      coalesce(new.chat_key,'') || '|' ||
      coalesce(new.storage_bucket,'') || '|' ||
      coalesce(new.storage_path,'') || '|' ||
      coalesce(new.provider_media_id,'') || '|' ||
      coalesce(new.sha256,'')
    );
  end if;

  return new;
end;
$$;

create or replace function public.ensure_transcription_job_defaults()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_media record;
begin
  if new.media_id is not null then
    select mm.id, mm.message_id, mm.chat_key, mm.company_id, mm.contact_id into v_media
    from public.whatsapp_message_media mm where mm.id = new.media_id;

    if found then
      new.message_id := coalesce(new.message_id, v_media.message_id);
      new.chat_key := coalesce(nullif(btrim(new.chat_key),''), v_media.chat_key);
      new.company_id := coalesce(new.company_id, v_media.company_id);
      new.contact_id := coalesce(new.contact_id, v_media.contact_id);
    end if;
  end if;

  new.status := coalesce(nullif(btrim(new.status),''), 'queued');
  new.transcript_segments := coalesce(new.transcript_segments, '[]'::jsonb);
  new.metadata := coalesce(new.metadata, '{}'::jsonb);
  new.attempt_count := coalesce(new.attempt_count, 0);
  new.created_by := coalesce(new.created_by, auth.uid());
  new.queued_at := coalesce(new.queued_at, now());

  return new;
end;
$$;

create or replace function public.apply_transcription_job_result()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.message_id is not null then
    update public.whatsapp_messages
    set
      transcription_status = case when new.status = 'cancelled' then 'failed' else new.status end,
      transcript_text = case
        when new.status = 'completed' and nullif(new.transcript_text,'') is not null
          then new.transcript_text
        else whatsapp_messages.transcript_text
      end,
      transcription_provider = coalesce(new.provider, whatsapp_messages.transcription_provider),
      transcription_completed_at = case
        when new.status = 'completed' then coalesce(new.completed_at, now())
        else whatsapp_messages.transcription_completed_at
      end,
      updated_at = now()
    where id = new.message_id;
  end if;

  if new.media_id is not null then
    update public.whatsapp_message_media
    set
      transcription_status = case when new.status = 'cancelled' then 'failed' else new.status end,
      transcript_text = case
        when new.status = 'completed' and nullif(new.transcript_text,'') is not null
          then new.transcript_text
        else whatsapp_message_media.transcript_text
      end,
      transcription_provider = coalesce(new.provider, whatsapp_message_media.transcription_provider),
      transcription_completed_at = case
        when new.status = 'completed' then coalesce(new.completed_at, now())
        else whatsapp_message_media.transcription_completed_at
      end,
      updated_at = now()
    where id = new.media_id;
  end if;

  if new.chat_key is not null and btrim(new.chat_key) <> '' then
    perform public.refresh_whatsapp_conversation_rollup_by_chat_key(new.chat_key);
  end if;
  return null;
end;
$$;

-- Triggers (drop + create = idempotente)
drop trigger if exists trg_whatsapp_conversations_set_updated_at on public.whatsapp_conversations;
create trigger trg_whatsapp_conversations_set_updated_at
before update on public.whatsapp_conversations
for each row execute function public.set_row_updated_at();

drop trigger if exists trg_whatsapp_messages_set_updated_at on public.whatsapp_messages;
create trigger trg_whatsapp_messages_set_updated_at
before update on public.whatsapp_messages
for each row execute function public.set_row_updated_at();

drop trigger if exists trg_whatsapp_messages_before_write on public.whatsapp_messages;
create trigger trg_whatsapp_messages_before_write
before insert or update on public.whatsapp_messages
for each row execute function public.ensure_whatsapp_conversation_for_message();

drop trigger if exists trg_whatsapp_messages_after_change on public.whatsapp_messages;
create trigger trg_whatsapp_messages_after_change
after insert or update or delete on public.whatsapp_messages
for each row execute function public.after_whatsapp_message_change();

drop trigger if exists trg_whatsapp_message_media_set_updated_at on public.whatsapp_message_media;
create trigger trg_whatsapp_message_media_set_updated_at
before update on public.whatsapp_message_media
for each row execute function public.set_row_updated_at();

drop trigger if exists trg_whatsapp_message_media_before_write on public.whatsapp_message_media;
create trigger trg_whatsapp_message_media_before_write
before insert or update on public.whatsapp_message_media
for each row execute function public.ensure_whatsapp_media_defaults();

drop trigger if exists trg_transcription_jobs_set_updated_at on public.transcription_jobs;
create trigger trg_transcription_jobs_set_updated_at
before update on public.transcription_jobs
for each row execute function public.set_row_updated_at();

drop trigger if exists trg_transcription_jobs_before_write on public.transcription_jobs;
create trigger trg_transcription_jobs_before_write
before insert or update on public.transcription_jobs
for each row execute function public.ensure_transcription_job_defaults();

drop trigger if exists trg_transcription_jobs_after_write on public.transcription_jobs;
create trigger trg_transcription_jobs_after_write
after insert or update on public.transcription_jobs
for each row execute function public.apply_transcription_job_result();

-- Rollup inicial para conversas ja existentes
do $$
declare v_chat_key text;
begin
  for v_chat_key in
    select distinct chat_key from public.whatsapp_conversations
    where chat_key is not null and btrim(chat_key) <> ''
  loop
    perform public.refresh_whatsapp_conversation_rollup_by_chat_key(v_chat_key);
  end loop;
end;
$$;

-- ================================================================
-- BLOCO 4 - Grants, RLS, policies e storage bucket
-- ================================================================

grant select, insert, update on public.whatsapp_conversations to authenticated, service_role;
grant select, insert, update on public.whatsapp_messages to authenticated, service_role;
grant select, insert, update on public.whatsapp_message_media to authenticated, service_role;
grant select, insert, update on public.transcription_jobs to authenticated, service_role;

alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.whatsapp_message_media enable row level security;
alter table public.transcription_jobs enable row level security;

drop policy if exists "whatsapp_conversations_authenticated_select" on public.whatsapp_conversations;
drop policy if exists "whatsapp_conversations_authenticated_insert" on public.whatsapp_conversations;
drop policy if exists "whatsapp_conversations_authenticated_update" on public.whatsapp_conversations;
create policy "whatsapp_conversations_authenticated_select" on public.whatsapp_conversations for select to authenticated using (auth.role() = 'authenticated');
create policy "whatsapp_conversations_authenticated_insert" on public.whatsapp_conversations for insert to authenticated with check (auth.role() = 'authenticated');
create policy "whatsapp_conversations_authenticated_update" on public.whatsapp_conversations for update to authenticated using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "whatsapp_messages_authenticated_select" on public.whatsapp_messages;
drop policy if exists "whatsapp_messages_authenticated_insert" on public.whatsapp_messages;
drop policy if exists "whatsapp_messages_authenticated_update" on public.whatsapp_messages;
create policy "whatsapp_messages_authenticated_select" on public.whatsapp_messages for select to authenticated using (auth.role() = 'authenticated');
create policy "whatsapp_messages_authenticated_insert" on public.whatsapp_messages for insert to authenticated with check (auth.role() = 'authenticated');
create policy "whatsapp_messages_authenticated_update" on public.whatsapp_messages for update to authenticated using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "whatsapp_message_media_authenticated_select" on public.whatsapp_message_media;
drop policy if exists "whatsapp_message_media_authenticated_insert" on public.whatsapp_message_media;
drop policy if exists "whatsapp_message_media_authenticated_update" on public.whatsapp_message_media;
create policy "whatsapp_message_media_authenticated_select" on public.whatsapp_message_media for select to authenticated using (auth.role() = 'authenticated');
create policy "whatsapp_message_media_authenticated_insert" on public.whatsapp_message_media for insert to authenticated with check (auth.role() = 'authenticated');
create policy "whatsapp_message_media_authenticated_update" on public.whatsapp_message_media for update to authenticated using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "transcription_jobs_authenticated_select" on public.transcription_jobs;
drop policy if exists "transcription_jobs_authenticated_insert" on public.transcription_jobs;
drop policy if exists "transcription_jobs_authenticated_update" on public.transcription_jobs;
create policy "transcription_jobs_authenticated_select" on public.transcription_jobs for select to authenticated using (auth.role() = 'authenticated');
create policy "transcription_jobs_authenticated_insert" on public.transcription_jobs for insert to authenticated with check (auth.role() = 'authenticated');
create policy "transcription_jobs_authenticated_update" on public.transcription_jobs for update to authenticated using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Storage bucket de audio
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'whatsapp-audio','whatsapp-audio', false, 52428800,
  array['audio/aac','audio/amr','audio/mpeg','audio/mp4','audio/ogg','audio/opus','audio/wav','audio/webm','application/octet-stream']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "whatsapp_audio_authenticated_read" on storage.objects;
drop policy if exists "whatsapp_audio_authenticated_insert" on storage.objects;
drop policy if exists "whatsapp_audio_authenticated_update" on storage.objects;
create policy "whatsapp_audio_authenticated_read"   on storage.objects for select to authenticated using (bucket_id = 'whatsapp-audio');
create policy "whatsapp_audio_authenticated_insert" on storage.objects for insert to authenticated with check (bucket_id = 'whatsapp-audio');
create policy "whatsapp_audio_authenticated_update" on storage.objects for update to authenticated using (bucket_id = 'whatsapp-audio') with check (bucket_id = 'whatsapp-audio');

-- ================================================================
-- BLOCO 5 - Sanity checks (apenas leitura; seguro rodar)
-- Rode estes SELECTs depois do bloco principal pra validar.
-- ================================================================

-- 1. Nenhuma conversa sem chat_key (esperado: 0)
-- select 'conversations_sem_chat_key' as check, count(*) as rows
-- from public.whatsapp_conversations where chat_key is null or btrim(chat_key) = '';

-- 2. Nenhuma mensagem sem chat_key (esperado: 0)
-- select 'messages_sem_chat_key' as check, count(*) as rows
-- from public.whatsapp_messages where chat_key is null or btrim(chat_key) = '';

-- 3. Duplicatas em chat_key (esperado: 0 linhas)
-- select chat_key, count(*) as dup
-- from public.whatsapp_conversations
-- where chat_key is not null
-- group by chat_key having count(*) > 1;

-- 4. Indices e triggers criados
-- select indexname from pg_indexes
-- where schemaname = 'public'
--   and tablename in ('whatsapp_conversations','whatsapp_messages','whatsapp_message_media','transcription_jobs')
-- order by tablename, indexname;

-- 5. Bucket criado
-- select id, public, file_size_limit from storage.buckets where id = 'whatsapp-audio';
