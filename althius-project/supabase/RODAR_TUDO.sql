-- ================================================================
-- PIPA DRIVEN CRM — SQL COMPLETO
-- Cole TUDO no Supabase SQL Editor e clique em "Run"
-- Idempotente: pode rodar quantas vezes quiser
-- ================================================================


-- ================================================================
-- 1. PROFILES
-- ================================================================

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        text not null default 'user' check (role in ('admin', 'user')),
  name        text,
  created_at  timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language plpgsql stable
security definer set search_path = public
as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
end;
$$;

alter table public.profiles enable row level security;

drop policy if exists "profiles: user reads own"   on public.profiles;
drop policy if exists "profiles: admin reads all"  on public.profiles;
drop policy if exists "profiles: user updates own" on public.profiles;
drop policy if exists "profiles: admin updates all" on public.profiles;

create policy "profiles: user reads own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: admin reads all"
  on public.profiles for select
  using (public.is_admin());

create policy "profiles: user updates own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles: admin updates all"
  on public.profiles for update
  using (public.is_admin());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, name)
  values (
    new.id,
    'user',
    coalesce(new.raw_user_meta_data ->> 'name', null)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ================================================================
-- 2. FUNNELS
-- ================================================================

create table if not exists public.funnels (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table public.funnels enable row level security;

drop policy if exists "funnels: authenticated can read" on public.funnels;
drop policy if exists "funnels: admin can write"        on public.funnels;

create policy "funnels: authenticated can read"
  on public.funnels for select
  using (auth.role() = 'authenticated');

create policy "funnels: admin can write"
  on public.funnels for all
  using (public.is_admin());


-- ================================================================
-- 3. STAGES
-- ================================================================

create table if not exists public.stages (
  id          uuid primary key default gen_random_uuid(),
  funnel_id   uuid not null references public.funnels(id) on delete cascade,
  name        text not null,
  "order"     integer not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.stages enable row level security;

drop policy if exists "stages: authenticated can read" on public.stages;
drop policy if exists "stages: admin can write"        on public.stages;

create policy "stages: authenticated can read"
  on public.stages for select
  using (auth.role() = 'authenticated');

create policy "stages: admin can write"
  on public.stages for all
  using (public.is_admin());

create index if not exists stages_funnel_order_idx on public.stages(funnel_id, "order");


-- ================================================================
-- 4. COMPANIES
-- ================================================================

create table if not exists public.companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  cnpj        text,
  city        text,
  segment     text,
  website     text,
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);

alter table public.companies enable row level security;

drop policy if exists "companies: user sees own, admin sees all"        on public.companies;
drop policy if exists "companies: user inserts own"                     on public.companies;
drop policy if exists "companies: user updates own, admin updates all"  on public.companies;
drop policy if exists "companies: admin deletes"                        on public.companies;

create policy "companies: user sees own, admin sees all"
  on public.companies for select
  using (owner_id = auth.uid() or public.is_admin());

create policy "companies: user inserts own"
  on public.companies for insert
  with check (owner_id = auth.uid());

create policy "companies: user updates own, admin updates all"
  on public.companies for update
  using (owner_id = auth.uid() or public.is_admin());

create policy "companies: admin deletes"
  on public.companies for delete
  using (public.is_admin());

create index if not exists companies_owner_id_idx on public.companies(owner_id);


-- ================================================================
-- 5. CONTACTS
-- ================================================================

create table if not exists public.contacts (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  role        text,
  email       text,
  whatsapp    text,
  phone       text,
  company_id  uuid references public.companies(id) on delete set null,
  source      text,
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create unique index if not exists contacts_email_unique
  on public.contacts(email) where email is not null;

alter table public.contacts enable row level security;

drop policy if exists "contacts: user sees own, admin sees all"        on public.contacts;
drop policy if exists "contacts: user inserts own"                     on public.contacts;
drop policy if exists "contacts: user updates own, admin updates all"  on public.contacts;
drop policy if exists "contacts: admin deletes"                        on public.contacts;

create policy "contacts: user sees own, admin sees all"
  on public.contacts for select
  using (owner_id = auth.uid() or public.is_admin());

create policy "contacts: user inserts own"
  on public.contacts for insert
  with check (owner_id = auth.uid());

create policy "contacts: user updates own, admin updates all"
  on public.contacts for update
  using (owner_id = auth.uid() or public.is_admin());

create policy "contacts: admin deletes"
  on public.contacts for delete
  using (public.is_admin());

create index if not exists contacts_owner_id_idx  on public.contacts(owner_id);
create index if not exists contacts_company_id_idx on public.contacts(company_id);


-- ================================================================
-- 6. DEALS
-- ================================================================

create table if not exists public.deals (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  value          numeric(15, 2),
  stage_id       uuid references public.stages(id) on delete set null,
  funnel_id      uuid references public.funnels(id) on delete set null,
  contact_id     uuid references public.contacts(id) on delete set null,
  company_id     uuid references public.companies(id) on delete set null,
  owner_id       uuid not null references public.profiles(id) on delete cascade,
  expected_close date,
  created_at     timestamptz not null default now()
);

alter table public.deals enable row level security;

drop policy if exists "deals: user sees own, admin sees all"        on public.deals;
drop policy if exists "deals: user inserts own"                     on public.deals;
drop policy if exists "deals: user updates own, admin updates all"  on public.deals;
drop policy if exists "deals: admin deletes"                        on public.deals;

create policy "deals: user sees own, admin sees all"
  on public.deals for select
  using (owner_id = auth.uid() or public.is_admin());

create policy "deals: user inserts own"
  on public.deals for insert
  with check (owner_id = auth.uid());

create policy "deals: user updates own, admin updates all"
  on public.deals for update
  using (owner_id = auth.uid() or public.is_admin());

create policy "deals: admin deletes"
  on public.deals for delete
  using (public.is_admin());

create index if not exists deals_owner_id_idx   on public.deals(owner_id);
create index if not exists deals_funnel_id_idx  on public.deals(funnel_id);
create index if not exists deals_stage_id_idx   on public.deals(stage_id);
create index if not exists deals_contact_id_idx on public.deals(contact_id);
create index if not exists deals_company_id_idx on public.deals(company_id);

create table if not exists public.deal_history (
  id          uuid primary key default gen_random_uuid(),
  deal_id     uuid not null references public.deals(id) on delete cascade,
  from_stage  uuid references public.stages(id) on delete set null,
  to_stage    uuid not null references public.stages(id) on delete cascade,
  moved_by    uuid references public.profiles(id) on delete set null,
  moved_at    timestamptz not null default now()
);

alter table public.deal_history enable row level security;

drop policy if exists "deal_history: authenticated can read"   on public.deal_history;
drop policy if exists "deal_history: authenticated can insert" on public.deal_history;

create policy "deal_history: authenticated can read"
  on public.deal_history for select
  using (auth.role() = 'authenticated');

create policy "deal_history: authenticated can insert"
  on public.deal_history for insert
  with check (auth.role() = 'authenticated');

create index if not exists deal_history_deal_id_idx on public.deal_history(deal_id);


-- ================================================================
-- 7. INTEGRATIONS
-- ================================================================

create table if not exists public.integrations (
  id                uuid primary key default gen_random_uuid(),
  name              text not null unique,
  api_key_encrypted text,
  webhook_url       text,
  status            text not null default 'disconnected'
                    check (status in ('connected','disconnected','error','coming_soon')),
  configured_by     uuid references public.profiles(id) on delete set null,
  updated_at        timestamptz not null default now()
);

alter table public.integrations enable row level security;

drop policy if exists "integrations: authenticated can read" on public.integrations;
drop policy if exists "integrations: admin can insert"       on public.integrations;
drop policy if exists "integrations: admin can update"       on public.integrations;

create policy "integrations: authenticated can read"
  on public.integrations for select
  using (auth.uid() is not null);

create policy "integrations: admin can insert"
  on public.integrations for insert
  with check (public.is_admin());

create policy "integrations: admin can update"
  on public.integrations for update
  using (public.is_admin());


-- ================================================================
-- 8. WEBHOOK LOGS
-- ================================================================

create table if not exists public.webhook_logs (
  id           uuid primary key default gen_random_uuid(),
  webhook_id   uuid references public.integrations(id) on delete cascade,
  payload      jsonb,
  received_at  timestamptz not null default now(),
  status       text not null default 'received'
               check (status in ('received','processed','error'))
);

alter table public.webhook_logs enable row level security;

drop policy if exists "webhook_logs: authenticated can read"   on public.webhook_logs;
drop policy if exists "webhook_logs: authenticated can insert" on public.webhook_logs;

create policy "webhook_logs: authenticated can read"
  on public.webhook_logs for select
  using (auth.uid() is not null);

create policy "webhook_logs: authenticated can insert"
  on public.webhook_logs for insert
  with check (auth.uid() is not null);


-- ================================================================
-- 9. ENRICHMENT LOGS
-- ================================================================

create table if not exists public.enrichment_logs (
  id              uuid primary key default gen_random_uuid(),
  contact_id      uuid references public.contacts(id) on delete cascade,
  status          text not null default 'pending'
                  check (status in ('pending','enriching','done','error')),
  fields_updated  jsonb,
  enriched_at     timestamptz not null default now()
);

alter table public.enrichment_logs enable row level security;

drop policy if exists "enrichment_logs: authenticated can read"   on public.enrichment_logs;
drop policy if exists "enrichment_logs: authenticated can insert" on public.enrichment_logs;
drop policy if exists "enrichment_logs: authenticated can update" on public.enrichment_logs;

create policy "enrichment_logs: authenticated can read"
  on public.enrichment_logs for select
  using (auth.uid() is not null);

create policy "enrichment_logs: authenticated can insert"
  on public.enrichment_logs for insert
  with check (auth.uid() is not null);

create policy "enrichment_logs: authenticated can update"
  on public.enrichment_logs for update
  using (auth.uid() is not null);


-- ================================================================
-- 10. FUNNEL STAGES + SEQUENCES
-- ================================================================

create table if not exists public.funnel_stages (
  id          uuid primary key default gen_random_uuid(),
  funnel_id   uuid not null references public.funnels(id) on delete cascade,
  name        text not null,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.funnel_stages enable row level security;

drop policy if exists "funnel_stages: authenticated can read" on public.funnel_stages;
drop policy if exists "funnel_stages: admin can write"        on public.funnel_stages;

create policy "funnel_stages: authenticated can read"
  on public.funnel_stages for select
  using (auth.role() = 'authenticated');

create policy "funnel_stages: admin can write"
  on public.funnel_stages for all
  using (public.is_admin());

create table if not exists public.sequences (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  funnel_id   uuid not null references public.funnels(id) on delete cascade,
  stage_id    uuid not null references public.funnel_stages(id) on delete cascade,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.sequences enable row level security;

drop policy if exists "sequences: authenticated can read" on public.sequences;
drop policy if exists "sequences: admin can write"        on public.sequences;

create policy "sequences: authenticated can read"
  on public.sequences for select
  using (auth.role() = 'authenticated');

create policy "sequences: admin can write"
  on public.sequences for all
  using (public.is_admin());

create table if not exists public.sequence_steps (
  id           uuid primary key default gen_random_uuid(),
  sequence_id  uuid not null references public.sequences(id) on delete cascade,
  position     integer not null default 0,
  channel      text not null check (channel in ('whatsapp', 'email')),
  delay_days   integer not null default 0 check (delay_days >= 0),
  template     text not null default '',
  created_at   timestamptz not null default now()
);

alter table public.sequence_steps enable row level security;

drop policy if exists "sequence_steps: authenticated can read" on public.sequence_steps;
drop policy if exists "sequence_steps: admin can write"        on public.sequence_steps;

create policy "sequence_steps: authenticated can read"
  on public.sequence_steps for select
  using (auth.role() = 'authenticated');

create policy "sequence_steps: admin can write"
  on public.sequence_steps for all
  using (public.is_admin());

create table if not exists public.deal_sequences (
  id           uuid primary key default gen_random_uuid(),
  deal_id      uuid not null references public.deals(id) on delete cascade,
  sequence_id  uuid not null references public.sequences(id) on delete cascade,
  started_at   timestamptz not null default now(),
  unique (deal_id, sequence_id)
);

alter table public.deal_sequences enable row level security;

drop policy if exists "deal_sequences: authenticated can read" on public.deal_sequences;
drop policy if exists "deal_sequences: admin can write"        on public.deal_sequences;

create policy "deal_sequences: authenticated can read"
  on public.deal_sequences for select
  using (auth.role() = 'authenticated');

create policy "deal_sequences: admin can write"
  on public.deal_sequences for all
  using (public.is_admin());


-- ================================================================
-- 11. ABM — SINAIS, CADENCIA, INTERACOES, TAREFAS
-- ================================================================

-- Campos ABM na tabela companies
alter table public.companies
  add column if not exists icp_score integer default 0 check (icp_score between 0 and 100),
  add column if not exists buying_signal text default 'cold' check (buying_signal in ('hot', 'warm', 'cold')),
  add column if not exists cadence_status text default 'not_started' check (cadence_status in (
    'not_started', 'active', 'paused', 'meeting_booked', 'proposal_sent', 'won', 'lost'
  )),
  add column if not exists cadence_day integer default 0,
  add column if not exists cadence_started_at timestamptz,
  add column if not exists last_interaction_at timestamptz,
  add column if not exists linkedin_url text,
  add column if not exists domain text,
  add column if not exists employees_count text;

-- Sinais de compra
create table if not exists public.account_signals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  signal_type text not null check (signal_type in (
    'new_launch', 'hiring_sales', 'hiring_marketing', 'running_ads',
    'slow_response', 'no_followup', 'vgv_pressure', 'competitor_change',
    'funding', 'custom'
  )),
  description text,
  detected_at timestamptz default now(),
  source text default 'manual',
  confidence numeric(4,3) not null default 0.85 check (confidence >= 0 and confidence <= 1),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- Tracking de cadencia
create table if not exists public.cadence_tracks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  persona_type text not null check (persona_type in ('cmo', 'dir_comercial', 'socio', 'ceo', 'other')),
  contact_id uuid references public.contacts(id),
  cadence_day integer not null default 1,
  block_number integer not null default 1 check (block_number in (1, 2, 3)),
  channel text not null check (channel in ('whatsapp', 'linkedin', 'phone', 'email')),
  status text not null default 'pending' check (status in ('pending', 'done', 'skipped', 'replied')),
  scheduled_for date,
  completed_at timestamptz,
  message_sent text,
  reply_received text,
  created_at timestamptz default now()
);

-- Log de interacoes
create table if not exists public.interactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  interaction_type text not null check (interaction_type in (
    'whatsapp_sent', 'whatsapp_received',
    'email_sent', 'email_received',
    'call_made', 'call_received',
    'linkedin_sent', 'linkedin_received',
    'meeting', 'note',
    'phase0_test', 'proposal_sent',
    'cadence_step'
  )),
  content text,
  summary text,
  channel text,
  direction text check (direction in ('outbound', 'inbound')),
  persona_type text check (persona_type in ('cmo', 'dir_comercial', 'socio', 'ceo', 'other')),
  cadence_day integer,
  metadata jsonb default '{}',
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- Tarefas diarias
create table if not exists public.daily_tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  cadence_track_id uuid references public.cadence_tracks(id) on delete cascade,
  task_type text not null check (task_type in (
    'send_whatsapp', 'send_linkedin', 'make_call', 'send_email', 'followup'
  )),
  persona_type text check (persona_type in ('cmo', 'dir_comercial', 'socio', 'ceo', 'other')),
  cadence_day integer,
  block_number integer,
  generated_message text,
  urgency text default 'normal' check (urgency in ('urgent', 'today', 'normal')),
  due_date date default current_date,
  status text default 'pending' check (status in ('pending', 'done', 'skipped')),
  done_at timestamptz,
  created_at timestamptz default now()
);

-- Resultado da Fase 0
create table if not exists public.phase0_results (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  test_date date not null default current_date,
  first_response_minutes integer,
  followup_count integer default 0,
  followup_days integer default 0,
  response_quality text check (response_quality in ('excellent', 'good', 'poor', 'none')),
  diagnosis text,
  loom_url text,
  raw_notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- Indices ABM
create index if not exists idx_signals_company on account_signals(company_id);
create index if not exists idx_cadence_company on cadence_tracks(company_id);
create index if not exists idx_cadence_status on cadence_tracks(status);
create index if not exists idx_interactions_company on interactions(company_id);
create index if not exists idx_interactions_created on interactions(created_at desc);
create index if not exists idx_daily_tasks_due on daily_tasks(due_date, status);
create index if not exists idx_daily_tasks_company on daily_tasks(company_id);

-- RLS ABM
alter table public.account_signals enable row level security;
alter table public.cadence_tracks enable row level security;
alter table public.interactions enable row level security;
alter table public.daily_tasks enable row level security;
alter table public.phase0_results enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='account_signals' and policyname='auth_all') then
    create policy "auth_all" on account_signals for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='cadence_tracks' and policyname='auth_all') then
    create policy "auth_all" on cadence_tracks for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='interactions' and policyname='auth_all') then
    create policy "auth_all" on interactions for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='daily_tasks' and policyname='auth_all') then
    create policy "auth_all" on daily_tasks for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='phase0_results' and policyname='auth_all') then
    create policy "auth_all" on phase0_results for all to authenticated using (true) with check (true);
  end if;
end $$;


-- ================================================================
-- 12. COMPANY INTELLIGENCE (mercado imobiliario)
-- ================================================================

alter table public.companies
  add column if not exists status text default 'new'
    check (status in ('new', 'prospecting', 'contacted', 'meeting_booked', 'proposal', 'customer', 'lost')),
  add column if not exists score_tier text default 'C'
    check (score_tier in ('A', 'B', 'C')),
  add column if not exists sales_model text
    check (sales_model in ('internal', 'external', 'hybrid')),
  add column if not exists has_active_launch boolean default false,
  add column if not exists upcoming_launch boolean default false,
  add column if not exists launch_count_year integer default 0,
  add column if not exists vgv_projected numeric,
  add column if not exists monthly_media_spend numeric,
  add column if not exists instagram_url text,
  add column if not exists connection_count integer default 0;

create table if not exists public.company_launches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  status text not null default 'active'
    check (status in ('active', 'upcoming', 'sold_out', 'cancelled')),
  launch_date date,
  delivery_date date,
  units_total integer,
  units_sold integer default 0,
  vgv numeric,
  price_per_sqm numeric,
  address text,
  city text,
  neighborhood text,
  website_url text,
  landing_page_url text,
  instagram_url text,
  notes text,
  created_at timestamptz default now()
);

create index if not exists idx_launches_company on company_launches(company_id);

alter table public.company_launches enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='company_launches' and policyname='auth_all') then
    create policy "auth_all" on company_launches for all to authenticated using (true) with check (true);
  end if;
end $$;

-- View de estatisticas
create or replace view public.account_stats as
select
  count(*) as total_accounts,
  count(*) filter (where connection_count > 0) as with_connections,
  count(*) filter (where buying_signal = 'hot') as burning_accounts,
  count(*) filter (where has_active_launch = true) as with_active_launch,
  count(*) filter (where upcoming_launch = true) as with_upcoming_launch,
  count(*) filter (where sales_model = 'hybrid') as hybrid_sales,
  count(*) filter (where cadence_status = 'active') as in_cadence
from public.companies;


-- ================================================================
-- 13. WHATSAPP CONVERSATIONS (para a extensao Chrome)
-- ================================================================

CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID REFERENCES companies(id) ON DELETE SET NULL,
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
  source          TEXT NOT NULL DEFAULT 'manual'
                  CHECK (source IN ('manual', 'api', 'n8n', 'extension')),
  raw_text        TEXT,
  phone_number    TEXT,
  cadence_day     INT,
  persona_type    TEXT,
  summary         TEXT,
  sentiment       TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', 'objecting')),
  interest_level  TEXT CHECK (interest_level IN ('high', 'medium', 'low', 'none')),
  objections      TEXT[] DEFAULT '{}',
  next_steps      TEXT[] DEFAULT '{}',
  suggested_reply TEXT,
  signal_recommendation TEXT CHECK (signal_recommendation IN ('hot', 'warm', 'cold')),
  analyzed        BOOLEAN DEFAULT false,
  analyzed_at     TIMESTAMPTZ,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  company_id      UUID REFERENCES companies(id) ON DELETE SET NULL,
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
  direction       TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  body            TEXT NOT NULL,
  wa_message_id   TEXT UNIQUE,
  status          TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
  sent_at         TIMESTAMPTZ DEFAULT now(),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_conversations_company ON whatsapp_conversations(company_id);
CREATE INDEX IF NOT EXISTS idx_wa_conversations_contact ON whatsapp_conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_wa_conversations_created ON whatsapp_conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_messages_conversation ON whatsapp_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_wa_messages_company ON whatsapp_messages(company_id);

ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages      ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Authenticated read conversations"
  ON whatsapp_conversations FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "Authenticated insert conversations"
  ON whatsapp_conversations FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "Creator updates conversations"
  ON whatsapp_conversations FOR UPDATE
  USING (created_by = auth.uid() OR auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS "Authenticated read messages"
  ON whatsapp_messages FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "Authenticated insert messages"
  ON whatsapp_messages FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "Service role full access conversations"
  ON whatsapp_conversations FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS "Service role full access messages"
  ON whatsapp_messages FOR ALL
  USING (auth.role() = 'service_role');


-- ================================================================
-- 14. AUTOMATION EVENTS
-- ================================================================

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

create index if not exists automation_events_created_idx on public.automation_events(created_at desc);
create index if not exists automation_events_company_idx on public.automation_events(company_id, created_at desc);
create index if not exists automation_events_status_idx on public.automation_events(processing_status, created_at desc);

alter table public.automation_events enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'automation_events' and policyname = 'auth_read_automation_events') then
    create policy "auth_read_automation_events" on public.automation_events for select to authenticated using (true);
  end if;
end $$;


-- ================================================================
-- 15. FUNCOES HELPER
-- ================================================================

create or replace function public.normalize_phone(p_value text)
returns text language sql immutable as $$
  select regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g')
$$;

create or replace function public.normalize_domain(p_value text)
returns text language sql immutable as $$
  select nullif(
    regexp_replace(
      split_part(
        regexp_replace(lower(trim(coalesce(p_value, ''))), '^https?://', '', 'i'),
        '/', 1
      ),
      '^www\.', '', 'i'
    ),
    ''
  )
$$;

create or replace function public.find_contact_by_whatsapp(p_phone text)
returns table (id uuid, company_id uuid, owner_id uuid, name text, role text, whatsapp text, email text)
language sql stable security definer set search_path = public as $$
  select c.id, c.company_id, c.owner_id, c.name, c.role, c.whatsapp, c.email
  from public.contacts c
  where public.normalize_phone(c.whatsapp) = public.normalize_phone(p_phone)
  order by c.created_at asc limit 1
$$;

create or replace function public.match_company_entity(
  p_company_name text default null, p_domain text default null, p_cnpj text default null
)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare
  v_company_id uuid;
  v_domain text := public.normalize_domain(p_domain);
  v_cnpj text := regexp_replace(coalesce(p_cnpj, ''), '[^0-9]', '', 'g');
begin
  if v_cnpj <> '' then
    select c.id into v_company_id from public.companies c
    where regexp_replace(coalesce(c.cnpj, ''), '[^0-9]', '', 'g') = v_cnpj limit 1;
    if found then return v_company_id; end if;
  end if;
  if coalesce(v_domain, '') <> '' then
    select c.id into v_company_id from public.companies c
    where public.normalize_domain(c.domain) = v_domain
       or public.normalize_domain(c.website) = v_domain
    order by case when public.normalize_domain(c.domain) = v_domain then 0 else 1 end limit 1;
    if found then return v_company_id; end if;
  end if;
  if coalesce(trim(p_company_name), '') <> '' then
    select c.id into v_company_id from public.companies c
    where lower(c.name) = lower(trim(p_company_name))
       or lower(c.name) like lower(trim(p_company_name)) || '%'
    order by char_length(c.name) asc limit 1;
    if found then return v_company_id; end if;
  end if;
  return null;
end;
$$;

-- Score de buying signal
create or replace function public.recalculate_buying_signal(p_company_id uuid)
returns void language plpgsql as $$
declare
  v_score integer := 0;
  v_signal text;
begin
  select coalesce(
    round(sum(
      (case signal_type
        when 'new_launch' then 30 when 'running_ads' then 22 when 'vgv_pressure' then 22
        when 'funding' then 20 when 'slow_response' then 18 when 'no_followup' then 18
        when 'hiring_sales' then 16 when 'hiring_marketing' then 14
        when 'competitor_change' then 12 else 8
      end) * greatest(least(confidence, 1), 0.35)
    )), 0
  )::integer into v_score
  from public.account_signals where company_id = p_company_id;

  v_score := least(100, greatest(0, v_score));

  if v_score >= 60 then v_signal := 'hot';
  elsif v_score >= 30 then v_signal := 'warm';
  else v_signal := 'cold';
  end if;

  update public.companies set icp_score = v_score, buying_signal = v_signal
  where id = p_company_id;
end;
$$;


-- ================================================================
-- 16. SEED — Dados iniciais
-- ================================================================

insert into public.integrations (name, status) values
  ('apollo',     'disconnected'),
  ('search_api', 'disconnected'),
  ('n8n',        'disconnected'),
  ('briary',     'coming_soon'),
  ('whatsapp',   'disconnected'),
  ('email',      'disconnected'),
  ('openai',     'disconnected')
on conflict (name) do nothing;

-- Funis padrao
do $$
declare
  v_pre uuid;
  v_com uuid;
begin
  insert into public.funnels (name) values ('Pre-vendas')
  on conflict do nothing returning id into v_pre;

  if v_pre is null then
    select id into v_pre from public.funnels where name = 'Pre-vendas' limit 1;
  end if;

  insert into public.funnels (name) values ('Comercial')
  on conflict do nothing returning id into v_com;

  if v_com is null then
    select id into v_com from public.funnels where name = 'Comercial' limit 1;
  end if;

  if v_pre is not null then
    insert into public.stages (funnel_id, name, "order") values
      (v_pre, 'Novos Leads', 0),
      (v_pre, 'Tentativa de Contato', 1),
      (v_pre, 'Contato com Sucesso', 2),
      (v_pre, 'Conexao', 3),
      (v_pre, 'Reuniao Agendada', 4)
    on conflict do nothing;
  end if;

  if v_com is not null then
    insert into public.stages (funnel_id, name, "order") values
      (v_com, 'Reuniao Realizada', 0),
      (v_com, 'Reuniao 2 Marcada', 1),
      (v_com, 'Reuniao 2 Realizada', 2),
      (v_com, 'Negociacao', 3),
      (v_com, 'Forecast', 4),
      (v_com, 'Fechamento', 5),
      (v_com, 'Ganho / Perdido', 6)
    on conflict do nothing;
  end if;
end $$;


-- ================================================================
-- PRONTO! Banco 100% configurado.
-- ================================================================
