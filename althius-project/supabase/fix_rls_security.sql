-- ═══════════════════════════════════════════════════════
-- ALTHIUS-001 — Fix RLS Security & Data Isolation
-- ═══════════════════════════════════════════════════════

-- 1. Limpar políticas inseguras (auth_all)
do $$ 
declare
    r record;
begin
    for r in (select policyname, tablename from pg_policies where policyname = 'auth_all' and schemaname = 'public') loop
        execute format('drop policy %I on public.%I', r.policyname, r.tablename);
    end loop;
end $$;

-- 2. Implementar políticas baseadas em Ownership/Admin

-- Helper: Verificar se o usuário é admin
create or replace function public.is_admin()
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Account Signals
drop policy if exists "signals_isolation" on public.account_signals;
create policy "signals_isolation" on public.account_signals
  for all to authenticated
  using (
    is_admin() or 
    exists (
      select 1 from public.companies c 
      where c.id = company_id and c.owner_id = auth.uid()
    )
  );

-- Daily Tasks
drop policy if exists "tasks_isolation" on public.daily_tasks;
create policy "tasks_isolation" on public.daily_tasks
  for all to authenticated
  using (
    is_admin() or 
    exists (
      select 1 from public.companies c 
      where c.id = company_id and c.owner_id = auth.uid()
    )
  );

-- Interactions
drop policy if exists "interactions_isolation" on public.interactions;
create policy "interactions_isolation" on public.interactions
  for all to authenticated
  using (
    is_admin() or 
    exists (
      select 1 from public.companies c 
      where c.id = company_id and c.owner_id = auth.uid()
    )
  );

-- Cadence Tracks
drop policy if exists "cadence_isolation" on public.cadence_tracks;
create policy "cadence_isolation" on public.cadence_tracks
  for all to authenticated
  using (
    is_admin() or 
    exists (
      select 1 from public.companies c 
      where c.id = company_id and c.owner_id = auth.uid()
    )
  );

-- Phase 0 Results
drop policy if exists "phase0_isolation" on public.phase0_results;
create policy "phase0_isolation" on public.phase0_results
  for all to authenticated
  using (
    is_admin() or 
    exists (
      select 1 from public.companies c 
      where c.id = company_id and c.owner_id = auth.uid()
    )
  );

-- Automation Events
drop policy if exists "events_isolation" on public.automation_events;
create policy "events_isolation" on public.automation_events
  for all to authenticated
  using (
    is_admin() or 
    exists (
      select 1 from public.companies c 
      where c.id = company_id and c.owner_id = auth.uid()
    )
  );

-- WhatsApp Conversations (Se existir)
do $$ begin
  if exists (select 1 from pg_tables where tablename = 'whatsapp_conversations') then
    alter table public.whatsapp_conversations enable row level security;
    drop policy if exists "wa_conv_isolation" on public.whatsapp_conversations;
    execute 'create policy "wa_conv_isolation" on public.whatsapp_conversations
      for all to authenticated
      using (
        is_admin() or 
        exists (
          select 1 from public.companies c 
          where c.id = company_id and c.owner_id = auth.uid()
        )
      )';
  end if;
end $$;
