-- ═══════════════════════════════════════════════════════
-- ALTHIUS GTM ENGINEERING - Cron Job de Enriquecimento Automático
-- Configura o pg_cron para processar a fila a cada 5 minutos
-- ═══════════════════════════════════════════════════════

-- Nota: Este script requer que a extensão pg_cron esteja habilitada no Supabase.
-- Para habilitar: Dashboard → Database → Extensions → pg_cron

-- Habilitar extensão pg_cron (se não estiver ativa)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remover job existente se houver
SELECT cron.unschedule('althius-auto-enrich-dispatcher')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'althius-auto-enrich-dispatcher'
);

-- Agendar processamento da fila a cada 5 minutos
SELECT cron.schedule(
  'althius-auto-enrich-dispatcher',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/auto-enrich-dispatcher',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-dispatcher-secret', current_setting('app.settings.dispatcher_secret', true)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ═══════════════════════════════════════════════════════
-- INSTRUÇÕES DE CONFIGURAÇÃO
-- ═══════════════════════════════════════════════════════
-- 
-- 1. No Supabase Dashboard → Settings → API → Configurar:
--    app.settings.supabase_url = 'https://<seu-projeto>.supabase.co'
--    app.settings.dispatcher_secret = '<gerar-secret-seguro>'
--
-- 2. No Supabase Dashboard → Settings → Secrets → Adicionar:
--    DISPATCHER_SECRET = '<mesmo-valor-acima>'
--
-- 3. Verificar jobs agendados:
--    SELECT * FROM cron.job;
--
-- 4. Verificar histórico de execuções:
--    SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
-- ═══════════════════════════════════════════════════════
