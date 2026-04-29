-- ═══════════════════════════════════════════════════════
-- ALTHIUS GTM ENGINEERING - Orquestração Automática de Missões
-- Triggers para geração de tarefas por score crítico
-- ═══════════════════════════════════════════════════════

-- 1. Função para gerar tarefas da Missão do Dia quando empresa atinge score crítico
CREATE OR REPLACE FUNCTION public.generate_mission_tasks_on_hot_signal(
  p_company_id uuid,
  p_score integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company record;
  v_contacts record;
  v_task_count integer;
  v_approach_message text;
BEGIN
  -- Buscar dados da empresa
  SELECT c.id, c.name, c.owner_id, c.buying_signal, c.icp_score,
         c.cadence_status, c.cadence_day
  INTO v_company
  FROM public.companies c
  WHERE c.id = p_company_id;

  IF NOT FOUND THEN RETURN; END IF;

  -- Verificar se já existem tarefas urgentes para hoje
  SELECT count(*) INTO v_task_count
  FROM public.daily_tasks
  WHERE company_id = p_company_id
    AND status = 'pending'
    AND urgency = 'urgent'
    AND due_date = current_date;

  -- Evitar duplicatas de tarefas urgentes no mesmo dia
  IF v_task_count > 0 THEN RETURN; END IF;

  -- Construir mensagem de abordagem baseada nos sinais detectados
  SELECT string_agg(
    '• ' || signal_type || ': ' || coalesce(description, 'Sinal detectado'),
    E'\n'
    ORDER BY detected_at DESC
  )
  INTO v_approach_message
  FROM public.account_signals
  WHERE company_id = p_company_id
  ORDER BY detected_at DESC
  LIMIT 3;

  -- Gerar tarefa principal de abordagem para cada persona-chave (sem contato específico)
  INSERT INTO public.daily_tasks (
    company_id,
    contact_id,
    task_type,
    persona_type,
    urgency,
    due_date,
    status,
    generated_message
  )
  SELECT
    p_company_id,
    ct.id,
    CASE
      WHEN ct.seniority IN ('owner', 'founder', 'c_suite') THEN 'send_whatsapp'
      WHEN ct.seniority = 'vp' THEN 'send_linkedin'
      ELSE 'send_whatsapp'
    END,
    CASE
      WHEN lower(coalesce(ct.role, '')) LIKE '%cmo%' OR lower(coalesce(ct.role, '')) LIKE '%marketing%' THEN 'cmo'
      WHEN lower(coalesce(ct.role, '')) LIKE '%comercial%' OR lower(coalesce(ct.role, '')) LIKE '%vendas%' THEN 'dir_comercial'
      WHEN lower(coalesce(ct.role, '')) LIKE '%ceo%' OR lower(coalesce(ct.role, '')) LIKE '%socio%' OR lower(coalesce(ct.role, '')) LIKE '%founder%' THEN 'socio'
      ELSE 'other'
    END,
    'urgent',
    current_date,
    'pending',
    format(
      E'🚀 ALVO QUENTE — %s (Score: %s)\n\nSinais detectados:\n%s\n\nAbordagem sugerida: Contato imediato com decisor. Mencionar os sinais de mercado identificados para demonstrar inteligência sobre o momento da empresa.',
      v_company.name,
      p_score,
      coalesce(v_approach_message, 'Múltiplos sinais de intenção detectados.')
    )
  FROM public.contacts ct
  WHERE ct.company_id = p_company_id
    AND ct.enrichment_source = 'apollo'
    AND ct.seniority IN ('owner', 'founder', 'c_suite', 'vp', 'director')
  ORDER BY
    CASE ct.seniority
      WHEN 'owner' THEN 1
      WHEN 'founder' THEN 2
      WHEN 'c_suite' THEN 3
      WHEN 'vp' THEN 4
      ELSE 5
    END
  LIMIT 3;

  -- Se não houver contatos Apollo, criar tarefa genérica de enriquecimento
  IF NOT FOUND THEN
    INSERT INTO public.daily_tasks (
      company_id,
      task_type,
      urgency,
      due_date,
      status,
      generated_message
    ) VALUES (
      p_company_id,
      'followup',
      'urgent',
      current_date,
      'pending',
      format(
        E'🚀 ALVO QUENTE — %s (Score: %s)\n\nSinais detectados:\n%s\n\n⚠️ Decisores ainda não mapeados. Enriquecimento Apollo necessário para identificar personas-chave.',
        v_company.name,
        p_score,
        coalesce(v_approach_message, 'Múltiplos sinais de intenção detectados.')
      )
    );
  END IF;

  -- Registrar interação de sistema
  INSERT INTO public.interactions (
    company_id,
    interaction_type,
    content,
    summary,
    direction,
    metadata
  ) VALUES (
    p_company_id,
    'note',
    format('Sistema Althius: Empresa atingiu Nível de Propulsão Crítico. Score: %s/100. Tarefas urgentes geradas automaticamente.', p_score),
    format('Score de propulsão: %s/100 (HOT). Orquestração automática ativada.', p_score),
    'outbound',
    jsonb_build_object(
      'automated', true,
      'trigger', 'score_transition_to_hot',
      'score', p_score
    )
  );
END;
$$;

-- 2. Trigger na tabela companies para detectar transição de sinal e orquestrar missões
CREATE OR REPLACE FUNCTION public.on_company_signal_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Detectar transição para HOT
  IF NEW.buying_signal = 'hot' AND coalesce(OLD.buying_signal, 'cold') <> 'hot' THEN
    PERFORM public.generate_mission_tasks_on_hot_signal(NEW.id, NEW.icp_score);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_company_signal_transition ON public.companies;
CREATE TRIGGER tr_company_signal_transition
  AFTER UPDATE OF buying_signal ON public.companies
  FOR EACH ROW EXECUTE PROCEDURE public.on_company_signal_transition();

-- 3. Tabela de fila de enriquecimento automático
CREATE TABLE IF NOT EXISTS public.auto_enrichment_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  trigger_reason text NOT NULL DEFAULT 'score_transition_to_hot',
  score_at_trigger integer,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  error_message text,
  enrichment_job_id uuid REFERENCES public.enrichment_jobs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS auto_enrichment_queue_status_idx
  ON public.auto_enrichment_queue(status, created_at DESC);
CREATE INDEX IF NOT EXISTS auto_enrichment_queue_company_idx
  ON public.auto_enrichment_queue(company_id, created_at DESC);

ALTER TABLE public.auto_enrichment_queue ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'auto_enrichment_queue' AND policyname = 'auto_enrichment_owner_policy'
  ) THEN
    CREATE POLICY "auto_enrichment_owner_policy"
      ON public.auto_enrichment_queue
      FOR ALL TO authenticated
      USING (
        is_admin() OR
        owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.companies c
          WHERE c.id = company_id AND c.owner_id = auth.uid()
        )
      );
  END IF;
END $$;

-- 4. Trigger para inserir na fila de enriquecimento automático quando empresa fica HOT
CREATE OR REPLACE FUNCTION public.on_hot_signal_queue_enrichment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_owner_id uuid;
  v_existing_contacts integer;
  v_pending_jobs integer;
BEGIN
  -- Só agir na transição para HOT
  IF NEW.buying_signal <> 'hot' OR coalesce(OLD.buying_signal, 'cold') = 'hot' THEN
    RETURN NEW;
  END IF;

  v_owner_id := NEW.owner_id;

  -- Verificar se já existem decisores Apollo mapeados
  SELECT count(*) INTO v_existing_contacts
  FROM public.contacts
  WHERE company_id = NEW.id
    AND enrichment_source = 'apollo'
    AND seniority IN ('owner', 'founder', 'c_suite', 'vp', 'director');

  -- Se já tem decisores, não precisa enriquecer novamente
  IF v_existing_contacts >= 2 THEN
    RETURN NEW;
  END IF;

  -- Verificar se já há um job pendente ou em processamento
  SELECT count(*) INTO v_pending_jobs
  FROM public.auto_enrichment_queue
  WHERE company_id = NEW.id
    AND status IN ('pending', 'processing');

  IF v_pending_jobs > 0 THEN
    RETURN NEW;
  END IF;

  -- Inserir na fila de enriquecimento automático
  INSERT INTO public.auto_enrichment_queue (
    company_id,
    owner_id,
    trigger_reason,
    score_at_trigger,
    status
  ) VALUES (
    NEW.id,
    v_owner_id,
    'score_transition_to_hot',
    NEW.icp_score,
    'pending'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_hot_signal_queue_enrichment ON public.companies;
CREATE TRIGGER tr_hot_signal_queue_enrichment
  AFTER UPDATE OF buying_signal ON public.companies
  FOR EACH ROW EXECUTE PROCEDURE public.on_hot_signal_queue_enrichment();
