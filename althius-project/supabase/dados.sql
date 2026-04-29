-- =============================================================
-- Pipa Driven CRM — Módulo Dados
-- Execute no SQL Editor do seu projeto Supabase
-- =============================================================

-- -------------------------------------------------------
-- Tabela: contacts
-- Leads e contatos unificados do CRM
-- -------------------------------------------------------
create table if not exists public.contacts (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  email           text,
  phone           text,
  company         text,
  city            text,
  segment         text,
  responsible_id  uuid references public.profiles(id) on delete set null,
  stage           text not null default 'lead'
                  check (stage in ('lead','mql','sql','visita_agendada','visita_realizada','comprou')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.contacts enable row level security;

create policy "contacts: authenticated users can read"
  on public.contacts for select
  using (auth.uid() is not null);

create policy "contacts: authenticated users can insert"
  on public.contacts for insert
  with check (auth.uid() is not null);

create policy "contacts: authenticated users can update"
  on public.contacts for update
  using (auth.uid() is not null);

-- -------------------------------------------------------
-- Tabela: integrations
-- Configurações de integrações externas por workspace
-- A api_key_encrypted deve ser cifrada no app antes de salvar
-- -------------------------------------------------------
create table if not exists public.integrations (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null unique,
  api_key_encrypted  text,
  webhook_url        text,
  status             text not null default 'disconnected'
                     check (status in ('connected','disconnected','error','coming_soon')),
  configured_by      uuid references public.profiles(id) on delete set null,
  updated_at         timestamptz not null default now()
);

alter table public.integrations enable row level security;

-- Qualquer autenticado pode ler status das integrações
create policy "integrations: authenticated can read"
  on public.integrations for select
  using (auth.uid() is not null);

-- Apenas admins podem inserir/atualizar integrações
create policy "integrations: admin can insert"
  on public.integrations for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "integrations: admin can update"
  on public.integrations for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- -------------------------------------------------------
-- Seed: integrações iniciais
-- -------------------------------------------------------
insert into public.integrations (name, status) values
  ('apollo',     'disconnected'),
  ('search_api', 'disconnected'),
  ('n8n',        'disconnected'),
  ('briary',     'coming_soon'),
  ('whatsapp',   'disconnected'),
  ('email',      'disconnected'),
  ('openai',     'disconnected')
on conflict (name) do nothing;

-- -------------------------------------------------------
-- Tabela: webhook_logs
-- Log das requisições recebidas pelo endpoint n8n
-- -------------------------------------------------------
create table if not exists public.webhook_logs (
  id           uuid primary key default gen_random_uuid(),
  webhook_id   uuid references public.integrations(id) on delete cascade,
  payload      jsonb,
  received_at  timestamptz not null default now(),
  status       text not null default 'received'
               check (status in ('received','processed','error'))
);

alter table public.webhook_logs enable row level security;

create policy "webhook_logs: authenticated can read"
  on public.webhook_logs for select
  using (auth.uid() is not null);

create policy "webhook_logs: authenticated can insert"
  on public.webhook_logs for insert
  with check (auth.uid() is not null);

-- -------------------------------------------------------
-- Tabela: enrichment_logs
-- Histórico de enriquecimento por contato
-- -------------------------------------------------------
create table if not exists public.enrichment_logs (
  id              uuid primary key default gen_random_uuid(),
  contact_id      uuid references public.contacts(id) on delete cascade,
  status          text not null default 'pending'
                  check (status in ('pending','enriching','done','error')),
  fields_updated  jsonb,
  enriched_at     timestamptz not null default now()
);

alter table public.enrichment_logs enable row level security;

create policy "enrichment_logs: authenticated can read"
  on public.enrichment_logs for select
  using (auth.uid() is not null);

create policy "enrichment_logs: authenticated can insert"
  on public.enrichment_logs for insert
  with check (auth.uid() is not null);

create policy "enrichment_logs: authenticated can update"
  on public.enrichment_logs for update
  using (auth.uid() is not null);