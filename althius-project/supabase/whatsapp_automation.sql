-- ═══════════════════════════════════════════════════════
-- PIPA-008 — WhatsApp Automation + Market Signals
-- Rodar no Supabase SQL Editor após crm.sql / dados.sql / abm_migrations.sql
-- ═══════════════════════════════════════════════════════

-- ── Account signals: enriquecer estrutura e fontes ──────────────────────────
alter table public.account_signals
  add column if not exists confidence numeric(4,3) not null default 0.85
    check (confidence >= 0 and confidence <= 1),
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.account_signals
  drop constraint if exists account_signals_source_check;

alter table public.account_signals
  add constraint account_signals_source_check check (source in (
    'manual',
    'apollo',
    'linkedin',
    'news',
    'phase0',
    'n8n',
    'whatsapp',
    'whatsapp_auto',
    'search_api',
    'market_signal'
  ));

-- ── Log de automações/eventos brutos ─────────────────────────────────────────
create table if not exists public.automation_events (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid references public.integrations(id) on delete set null,
  event_type text not null check (event_type in ('whatsapp_message', 'market_signal')),
  source text not null,
  external_event_id text,
  payload jsonb not null default '{}'::jsonb,
  processing_status text not null default 'received'
    check (processing_status in ('received', 'processed', 'ignored', 'error')),
  company_id uuid references public.companies(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  interaction_id uuid references public.interactions(id) on delete set null,
  signal_id uuid references public.account_signals(id) on delete set null,
  task_id uuid references public.daily_tasks(id) on delete set null,
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (source, external_event_id)
);

create index if not exists automation_events_created_idx
  on public.automation_events(created_at desc);
create index if not exists automation_events_company_idx
  on public.automation_events(company_id, created_at desc);
create index if not exists automation_events_status_idx
  on public.automation_events(processing_status, created_at desc);

alter table public.automation_events enable row level security;

do $$ begin
  if not exists (
    select 1
    from pg_policies
    where tablename = 'automation_events' and policyname = 'auth_read_automation_events'
  ) then
    create policy "auth_read_automation_events"
      on public.automation_events
      for select
      to authenticated
      using (true);
  end if;
end $$;

-- ── Helpers de matching ─────────────────────────────────────────────────────
create or replace function public.normalize_phone(p_value text)
returns text
language sql
immutable
as $$
  select regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g')
$$;

create or replace function public.normalize_domain(p_value text)
returns text
language sql
immutable
as $$
  select nullif(
    regexp_replace(
      split_part(
        regexp_replace(lower(trim(coalesce(p_value, ''))), '^https?://', '', 'i'),
        '/',
        1
      ),
      '^www\.',
      '',
      'i'
    ),
    ''
  )
$$;

create or replace function public.find_contact_by_whatsapp(p_phone text)
returns table (
  id uuid,
  company_id uuid,
  owner_id uuid,
  name text,
  role text,
  whatsapp text,
  email text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.company_id,
    c.owner_id,
    c.name,
    c.role,
    c.whatsapp,
    c.email
  from public.contacts c
  where public.normalize_phone(c.whatsapp) = public.normalize_phone(p_phone)
  order by c.created_at asc
  limit 1
$$;

create or replace function public.match_company_entity(
  p_company_name text default null,
  p_domain text default null,
  p_cnpj text default null
)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_domain text := public.normalize_domain(p_domain);
  v_cnpj text := regexp_replace(coalesce(p_cnpj, ''), '[^0-9]', '', 'g');
begin
  if v_cnpj <> '' then
    select c.id
      into v_company_id
    from public.companies c
    where regexp_replace(coalesce(c.cnpj, ''), '[^0-9]', '', 'g') = v_cnpj
    limit 1;

    if found then
      return v_company_id;
    end if;
  end if;

  if coalesce(v_domain, '') <> '' then
    select c.id
      into v_company_id
    from public.companies c
    where public.normalize_domain(c.domain) = v_domain
       or public.normalize_domain(c.website) = v_domain
       or public.normalize_domain(coalesce(c.domain, c.website)) = v_domain
    order by case when public.normalize_domain(c.domain) = v_domain then 0 else 1 end
    limit 1;

    if found then
      return v_company_id;
    end if;
  end if;

  if coalesce(trim(p_company_name), '') <> '' then
    select c.id
      into v_company_id
    from public.companies c
    where lower(c.name) = lower(trim(p_company_name))
       or lower(c.name) like lower(trim(p_company_name)) || '%'
       or lower(trim(p_company_name)) like lower(c.name) || '%'
    order by char_length(c.name) asc
    limit 1;

    if found then
      return v_company_id;
    end if;
  end if;

  return null;
end;
$$;

-- ── Score ponderado por sinal ───────────────────────────────────────────────
create or replace function public.recalculate_buying_signal(p_company_id uuid)
returns void
language plpgsql
as $$
declare
  v_score integer := 0;
  v_signal text;
begin
  select coalesce(
    round(
      sum(
        (case signal_type
          when 'new_launch' then 30
          when 'running_ads' then 22
          when 'vgv_pressure' then 22
          when 'funding' then 20
          when 'slow_response' then 18
          when 'no_followup' then 18
          when 'hiring_sales' then 16
          when 'hiring_marketing' then 14
          when 'competitor_change' then 12
          else 8
        end) * greatest(least(confidence, 1), 0.35)
      )
    ),
    0
  )::integer
    into v_score
  from public.account_signals
  where company_id = p_company_id;

  v_score := least(100, greatest(0, v_score));

  if v_score >= 60 then
    v_signal := 'hot';
  elsif v_score >= 30 then
    v_signal := 'warm';
  else
    v_signal := 'cold';
  end if;

  update public.companies
  set icp_score = v_score,
      buying_signal = v_signal
  where id = p_company_id;
end;
$$;
