-- ================================================================
-- WhatsApp Capture MVP — Smoke Test
-- Executa inserts/leitura com role autenticada e faz rollback ao final
-- Pre-requisito: supabase/whatsapp_conversations.sql ja executado
-- ================================================================

begin;

create temp table whatsapp_smoke_ctx
on commit drop
as
with chosen_user as (
  select id, role
  from public.profiles
  where role = 'admin'
  order by created_at asc
  limit 1
),
fallback_user as (
  select id, role
  from public.profiles
  order by created_at asc
  limit 1
),
auth_user as (
  select * from chosen_user
  union all
  select * from fallback_user
  where not exists (select 1 from chosen_user)
  limit 1
)
select
  auth_user.id as user_id,
  coalesce(
    (select id from public.companies where owner_id = auth_user.id order by created_at asc limit 1),
    (select id from public.companies order by created_at asc limit 1)
  ) as company_id,
  coalesce(
    (select id from public.contacts where owner_id = auth_user.id order by created_at asc limit 1),
    (select id from public.contacts order by created_at asc limit 1)
  ) as contact_id,
  'smoke:' || replace(gen_random_uuid()::text, '-', '') as chat_key,
  'fp:' || replace(gen_random_uuid()::text, '-', '') as message_fingerprint,
  'media:' || replace(gen_random_uuid()::text, '-', '') as media_fingerprint,
  'smoke/' || replace(gen_random_uuid()::text, '-', '') || '.ogg' as storage_path
from auth_user;

do $$
begin
  if not exists (select 1 from whatsapp_smoke_ctx) then
    raise exception 'Smoke test requer pelo menos 1 profile.';
  end if;

  if exists (select 1 from whatsapp_smoke_ctx where company_id is null) then
    raise exception 'Smoke test requer pelo menos 1 company.';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from whatsapp_smoke_ctx),
  true
);

select auth.uid() as simulated_user_id, auth.role() as simulated_role;

select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'whatsapp-audio';

insert into public.whatsapp_conversations (
  chat_key,
  company_id,
  contact_id,
  source,
  title
)
select
  chat_key,
  company_id,
  contact_id,
  'manual',
  'Smoke Test Chat'
from whatsapp_smoke_ctx
returning id, chat_key, company_id, contact_id, created_at;

insert into public.whatsapp_messages (
  chat_key,
  company_id,
  contact_id,
  direction,
  message_type,
  occurred_at,
  body,
  message_fingerprint
)
select
  chat_key,
  company_id,
  contact_id,
  'inbound',
  'audio',
  now(),
  '',
  message_fingerprint
from whatsapp_smoke_ctx
returning
  id,
  conversation_id,
  chat_key,
  direction,
  message_type,
  transcription_status,
  occurred_at;

insert into public.whatsapp_message_media (
  message_id,
  chat_key,
  company_id,
  contact_id,
  media_kind,
  storage_bucket,
  storage_path,
  file_name,
  mime_type,
  file_size_bytes,
  duration_ms,
  media_fingerprint
)
select
  m.id,
  ctx.chat_key,
  ctx.company_id,
  ctx.contact_id,
  'audio',
  'whatsapp-audio',
  ctx.storage_path,
  'sample.ogg',
  'audio/ogg',
  4096,
  12000,
  ctx.media_fingerprint
from whatsapp_smoke_ctx ctx
join public.whatsapp_messages m on m.chat_key = ctx.chat_key
returning
  id,
  message_id,
  storage_bucket,
  storage_path,
  transcription_required,
  transcription_status;

insert into public.transcription_jobs (
  message_id,
  media_id,
  chat_key,
  company_id,
  contact_id,
  status,
  provider,
  requested_language
)
select
  m.id,
  mm.id,
  ctx.chat_key,
  ctx.company_id,
  ctx.contact_id,
  'queued',
  'smoke_provider',
  'pt-BR'
from whatsapp_smoke_ctx ctx
join public.whatsapp_messages m on m.chat_key = ctx.chat_key
join public.whatsapp_message_media mm on mm.message_id = m.id
returning
  id,
  message_id,
  media_id,
  status,
  provider,
  queued_at;

select
  c.chat_key,
  c.message_count,
  c.last_message_at,
  c.last_message_preview
from public.whatsapp_conversations c
where c.chat_key = (select chat_key from whatsapp_smoke_ctx);

select
  m.chat_key,
  m.direction,
  m.message_type,
  m.transcription_status,
  mm.storage_bucket,
  mm.storage_path,
  tj.status as job_status,
  tj.provider
from public.whatsapp_messages m
left join public.whatsapp_message_media mm on mm.message_id = m.id
left join public.transcription_jobs tj on tj.message_id = m.id
where m.chat_key = (select chat_key from whatsapp_smoke_ctx)
order by m.occurred_at desc;

do $$
begin
  insert into public.whatsapp_messages (
    chat_key,
    company_id,
    contact_id,
    direction,
    message_type,
    occurred_at,
    body,
    message_fingerprint
  )
  select
    chat_key,
    company_id,
    contact_id,
    'inbound',
    'audio',
    now(),
    '',
    message_fingerprint
  from whatsapp_smoke_ctx;

  raise exception 'Falha: duplicata deveria ter sido barrada.';
exception
  when unique_violation then
    raise notice 'OK: duplicata barrada por chat_key + message_fingerprint.';
end;
$$;

rollback;
