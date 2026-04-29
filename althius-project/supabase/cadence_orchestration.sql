-- ═══════════════════════════════════════════════════════
-- ALTHIUS-002 — Event-Driven Cadence Orchestration
-- ═══════════════════════════════════════════════════════

-- 1. Tabela de Log de Execução de Cadência (Ledger)
create table if not exists public.cadence_execution_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  cadence_day integer not null,
  step_label text,
  action_type text,
  status text check (status in ('completed', 'failed', 'skipped')),
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

alter table public.cadence_execution_log enable row level security;

create policy "cadence_log_isolation" on public.cadence_execution_log
  for all to authenticated
  using (
    is_admin() or 
    exists (
      select 1 from public.companies c 
      where c.id = company_id and c.owner_id = auth.uid()
    )
  );

-- 2. Trigger para avançar cadência automaticamente ao completar tarefa
create or replace function public.on_task_completed_advance_cadence()
returns trigger
language plpgsql
security definer
as $$
declare
  v_current_day integer;
  v_total_tasks_today integer;
  v_pending_tasks_today integer;
begin
  if new.status = 'done' and old.status = 'pending' then
    -- Registrar no log
    insert into public.cadence_execution_log (company_id, contact_id, cadence_day, action_type, status)
    values (new.company_id, new.contact_id, new.cadence_day, new.task_type, 'completed');

    -- Verificar se todas as tarefas do dia atual da empresa foram concluídas
    select cadence_day into v_current_day from public.companies where id = new.company_id;
    
    select count(*) into v_total_tasks_today 
    from public.daily_tasks 
    where company_id = new.company_id and cadence_day = v_current_day;

    select count(*) into v_pending_tasks_today 
    from public.daily_tasks 
    where company_id = new.company_id and cadence_day = v_current_day and status = 'pending';

    -- Se não houver mais tarefas pendentes para o dia atual, avançar para o próximo dia útil
    if v_pending_tasks_today = 0 then
      update public.companies 
      set cadence_day = cadence_day + 1
      where id = new.company_id;
    end if;
  end if;
  return new;
end;
$$;

create or replace trigger tr_advance_cadence
  after update on public.daily_tasks
  for each row execute procedure public.on_task_completed_advance_cadence();

-- 3. Função para pausar cadência em caso de resposta (Sentiment Analysis)
create or replace function public.pause_cadence_on_reply()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.direction = 'inbound' and new.interaction_type like '%received%' then
    update public.companies 
    set cadence_status = 'paused'
    where id = new.company_id and cadence_status = 'active';
    
    -- Cancelar tarefas pendentes
    update public.daily_tasks
    set status = 'skipped'
    where company_id = new.company_id and status = 'pending';
  end if;
  return new;
end;
$$;

create or replace trigger tr_pause_on_reply
  after insert on public.interactions
  for each row execute procedure public.pause_cadence_on_reply();
