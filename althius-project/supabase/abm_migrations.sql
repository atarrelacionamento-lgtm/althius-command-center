-- ═══════════════════════════════════════════════════════
-- PIPA-004 — ABM Migrations
-- Rodar no Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- ── 1. SINAIS DE COMPRA POR EMPRESA ─────────────────────
create table if not exists public.account_signals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  signal_type text not null check (signal_type in (
    'new_launch',        -- lançamento previsto
    'hiring_sales',      -- contratando comercial
    'hiring_marketing',  -- contratando marketing
    'running_ads',       -- rodando mídia paga
    'slow_response',     -- lead oculto: resposta lenta
    'no_followup',       -- lead oculto: sem follow-up
    'vgv_pressure',      -- pressão de VGV parado
    'competitor_change', -- mudou de ferramenta
    'funding',           -- captou investimento
    'custom'             -- sinal customizado
  )),
  description text,
  detected_at timestamptz default now(),
  source text default 'manual' check (source in ('manual', 'apollo', 'linkedin', 'news', 'phase0')),
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- Score calculado de compra (0-100)
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

-- ── 2. TRACKING DE CADÊNCIA ─────────────────────────────
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

-- ── 3. LOG DE INTERAÇÕES ─────────────────────────────────
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
  summary text,          -- resumo gerado por IA
  channel text,
  direction text check (direction in ('outbound', 'inbound')),
  persona_type text check (persona_type in ('cmo', 'dir_comercial', 'socio', 'ceo', 'other')),
  cadence_day integer,
  metadata jsonb default '{}',
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- ── 4. FILA DE AÇÕES DIÁRIAS ─────────────────────────────
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
  generated_message text,  -- mensagem já gerada por Claude
  urgency text default 'normal' check (urgency in ('urgent', 'today', 'normal')),
  due_date date default current_date,
  status text default 'pending' check (status in ('pending', 'done', 'skipped')),
  done_at timestamptz,
  created_at timestamptz default now()
);

-- ── 5. RESULTADO DA FASE 0 (LEAD OCULTO) ─────────────────
create table if not exists public.phase0_results (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  test_date date not null default current_date,
  first_response_minutes integer,     -- minutos para 1ª resposta
  followup_count integer default 0,   -- quantas vezes tentaram follow-up
  followup_days integer default 0,    -- por quantos dias
  response_quality text check (response_quality in ('excellent', 'good', 'poor', 'none')),
  diagnosis text,                     -- texto do diagnóstico gerado
  loom_url text,                      -- link do vídeo Loom
  raw_notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- ── ÍNDICES ──────────────────────────────────────────────
create index if not exists idx_signals_company on account_signals(company_id);
create index if not exists idx_cadence_company on cadence_tracks(company_id);
create index if not exists idx_cadence_status on cadence_tracks(status);
create index if not exists idx_interactions_company on interactions(company_id);
create index if not exists idx_interactions_created on interactions(created_at desc);
create index if not exists idx_daily_tasks_due on daily_tasks(due_date, status);
create index if not exists idx_daily_tasks_company on daily_tasks(company_id);

-- ── RLS ──────────────────────────────────────────────────
alter table public.account_signals enable row level security;
alter table public.cadence_tracks enable row level security;
alter table public.interactions enable row level security;
alter table public.daily_tasks enable row level security;
alter table public.phase0_results enable row level security;

-- Políticas: autenticado pode ler e escrever tudo
do $$ begin
  -- account_signals
  if not exists (select 1 from pg_policies where tablename='account_signals' and policyname='auth_all') then
    create policy "auth_all" on account_signals for all to authenticated using (true) with check (true);
  end if;
  -- cadence_tracks
  if not exists (select 1 from pg_policies where tablename='cadence_tracks' and policyname='auth_all') then
    create policy "auth_all" on cadence_tracks for all to authenticated using (true) with check (true);
  end if;
  -- interactions
  if not exists (select 1 from pg_policies where tablename='interactions' and policyname='auth_all') then
    create policy "auth_all" on interactions for all to authenticated using (true) with check (true);
  end if;
  -- daily_tasks
  if not exists (select 1 from pg_policies where tablename='daily_tasks' and policyname='auth_all') then
    create policy "auth_all" on daily_tasks for all to authenticated using (true) with check (true);
  end if;
  -- phase0_results
  if not exists (select 1 from pg_policies where tablename='phase0_results' and policyname='auth_all') then
    create policy "auth_all" on phase0_results for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ── FUNÇÃO: Recalcular buying_signal da empresa ──────────
create or replace function public.recalculate_buying_signal(p_company_id uuid)
returns void language plpgsql as $$
declare
  v_signal_count integer;
  v_has_slow_response boolean;
  v_has_no_followup boolean;
  v_score integer := 0;
  v_signal text;
begin
  -- Contar sinais ativos
  select count(*) into v_signal_count
  from account_signals
  where company_id = p_company_id;

  select exists(
    select 1 from account_signals
    where company_id = p_company_id and signal_type = 'slow_response'
  ) into v_has_slow_response;

  select exists(
    select 1 from account_signals
    where company_id = p_company_id and signal_type = 'no_followup'
  ) into v_has_no_followup;

  -- Score
  v_score := least(100, v_signal_count * 15);
  if v_has_slow_response or v_has_no_followup then
    v_score := v_score + 20;
  end if;

  -- Classificar
  if v_score >= 60 then v_signal := 'hot';
  elsif v_score >= 30 then v_signal := 'warm';
  else v_signal := 'cold';
  end if;

  update public.companies
  set icp_score = v_score, buying_signal = v_signal
  where id = p_company_id;
end;
$$;
