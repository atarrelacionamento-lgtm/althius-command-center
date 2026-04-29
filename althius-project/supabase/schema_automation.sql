-- ============================================================
-- Automação / Sequências — schema adicional
-- Rodar no Supabase SQL Editor após schema.sql principal
-- ============================================================

-- Estágios de funil (complementa tabela funnels existente)
create table if not exists public.funnel_stages (
  id          uuid primary key default gen_random_uuid(),
  funnel_id   uuid not null references public.funnels(id) on delete cascade,
  name        text not null,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);
alter table public.funnel_stages enable row level security;
create policy "Authenticated read funnel_stages"
  on public.funnel_stages for select using (auth.role() = 'authenticated');
create policy "Admin manage funnel_stages"
  on public.funnel_stages for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Sequências
create table if not exists public.sequences (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  funnel_id   uuid not null references public.funnels(id) on delete cascade,
  stage_id    uuid not null references public.funnel_stages(id) on delete cascade,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
alter table public.sequences enable row level security;
create policy "Authenticated read sequences"
  on public.sequences for select using (auth.role() = 'authenticated');
create policy "Admin manage sequences"
  on public.sequences for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Steps das sequências
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
create policy "Authenticated read sequence_steps"
  on public.sequence_steps for select using (auth.role() = 'authenticated');
create policy "Admin manage sequence_steps"
  on public.sequence_steps for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Fila de execução: registra qual sequência está ativa para cada deal
create table if not exists public.deal_sequences (
  id           uuid primary key default gen_random_uuid(),
  deal_id      uuid not null,              -- referencia deals quando módulo existir
  sequence_id  uuid not null references public.sequences(id) on delete cascade,
  started_at   timestamptz not null default now(),
  unique (deal_id, sequence_id)
);
alter table public.deal_sequences enable row level security;
create policy "Authenticated read deal_sequences"
  on public.deal_sequences for select using (auth.role() = 'authenticated');
create policy "Admin manage deal_sequences"
  on public.deal_sequences for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );