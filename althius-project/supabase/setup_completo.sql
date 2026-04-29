-- ================================================================
-- PIPA DRIVEN CRM — SETUP COMPLETO DO BANCO
-- Execute este arquivo no SQL Editor do Supabase.
-- Idempotente: pode ser rodado quantas vezes quiser.
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

-- Histórico de movimentação
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
-- 10. FUNNEL STAGES (sub-estágios p/ sequências)
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


-- ================================================================
-- 11. SEQUENCES
-- ================================================================

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


-- ================================================================
-- 12. SEQUENCE STEPS
-- ================================================================

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


-- ================================================================
-- 13. DEAL SEQUENCES (fila de execução)
-- ================================================================

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
-- 14. SEED — Dados iniciais
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

with
  pre as (
    insert into public.funnels (name) values ('Pré-vendas')
    on conflict do nothing
    returning id
  ),
  com as (
    insert into public.funnels (name) values ('Comercial')
    on conflict do nothing
    returning id
  )
insert into public.stages (funnel_id, name, "order")
  select id, v.name, v.ord from pre
  cross join (values
    ('Novos Leads', 0),
    ('Tentativa de Contato', 1),
    ('Contato com Sucesso', 2),
    ('Conexão', 3),
    ('Reunião Agendada', 4)
  ) as v(name, ord)
union all
  select id, v.name, v.ord from com
  cross join (values
    ('Reunião Realizada', 0),
    ('Reunião 2 Marcada', 1),
    ('Reunião 2 Realizada', 2),
    ('Negociação', 3),
    ('Forecast', 4),
    ('Fechamento', 5),
    ('Ganho / Perdido', 6)
  ) as v(name, ord)
on conflict do nothing;
