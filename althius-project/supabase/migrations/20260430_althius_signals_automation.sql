-- ═══════════════════════════════════════════════════════
-- ALTHIUS GTM ENGINEERING - Módulo de Inteligência de Sinais
-- Motor de Sinais Ponderados e Orquestração Automática
-- ═══════════════════════════════════════════════════════

-- 1. Atualizar a função recalculate_buying_signal para disparar eventos de transição de score
CREATE OR REPLACE FUNCTION public.recalculate_buying_signal(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_score integer := 0;
  v_old_signal text;
  v_new_signal text;
  v_owner_id uuid;
BEGIN
  -- Obter o sinal atual e o owner
  SELECT buying_signal, owner_id INTO v_old_signal, v_owner_id
  FROM public.companies
  WHERE id = p_company_id;

  -- Calcular o novo score ponderado
  SELECT coalesce(
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
    INTO v_score
  FROM public.account_signals
  WHERE company_id = p_company_id;

  v_score := least(100, greatest(0, v_score));

  -- Determinar o novo nível de propulsão (buying_signal)
  IF v_score >= 60 THEN
    v_new_signal := 'hot';
  ELSIF v_score >= 30 THEN
    v_new_signal := 'warm';
  ELSE
    v_new_signal := 'cold';
  END IF;

  -- Atualizar a empresa
  UPDATE public.companies
  SET icp_score = v_score,
      buying_signal = v_new_signal
  WHERE id = p_company_id;

  -- Se a empresa esquentou (transição para 'hot'), disparar orquestração automática
  IF v_new_signal = 'hot' AND coalesce(v_old_signal, 'cold') <> 'hot' THEN
    
    -- 1. Gerar tarefa na Missão do Dia (daily_tasks)
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
      'Alvo atingiu Nível de Propulsão Crítico (HOT). Iniciar abordagem imediata baseada nos sinais recentes.'
    );

    -- 2. Registrar evento de automação para disparar o enriquecimento via API (Apollo)
    INSERT INTO public.automation_events (
      event_type,
      source,
      company_id,
      payload,
      processing_status
    ) VALUES (
      'market_signal',
      'althius_signal_engine',
      p_company_id,
      jsonb_build_object(
        'action', 'trigger_apollo_enrichment',
        'reason', 'score_transition_to_hot',
        'score', v_score
      ),
      'received'
    );

  END IF;
END;
$$;

-- 2. Trigger para recalcular o score sempre que um sinal for inserido, atualizado ou removido
CREATE OR REPLACE FUNCTION public.on_account_signal_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_buying_signal(OLD.company_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalculate_buying_signal(NEW.company_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS tr_account_signal_change ON public.account_signals;
CREATE TRIGGER tr_account_signal_change
  AFTER INSERT OR UPDATE OR DELETE ON public.account_signals
  FOR EACH ROW EXECUTE PROCEDURE public.on_account_signal_change();
