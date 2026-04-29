-- ============================================================
-- Automação entre funis + histórico com funil origem/destino
-- ============================================================

-- 1) Amplia deal_history pra guardar também os funis
ALTER TABLE deal_history
  ADD COLUMN IF NOT EXISTS from_funnel uuid REFERENCES funnels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS to_funnel   uuid REFERENCES funnels(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS deal_history_to_funnel ON deal_history(to_funnel);

-- 2) Tabela de automações por stage
--    Quando um deal entra em from_stage, é movido pra to_stage (em to_funnel)
CREATE TABLE IF NOT EXISTS stage_automations (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  from_stage   uuid NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
  to_funnel    uuid NOT NULL REFERENCES funnels(id) ON DELETE CASCADE,
  to_stage     uuid NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
  active       boolean NOT NULL DEFAULT true,
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at   timestamptz DEFAULT now(),
  UNIQUE (from_stage) -- uma automação por stage origem (simples, conforme alinhado)
);

CREATE INDEX IF NOT EXISTS stage_automations_from ON stage_automations(from_stage) WHERE active;

ALTER TABLE stage_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stage_automations_select" ON stage_automations
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "stage_automations_write" ON stage_automations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 3) Trigger: ao mover deal pra stage com automação, dispara o pulo pro outro funil
CREATE OR REPLACE FUNCTION apply_stage_automation()
RETURNS trigger AS $$
DECLARE
  rule stage_automations%ROWTYPE;
  prev_stage uuid;
  prev_funnel uuid;
BEGIN
  IF NEW.stage_id IS NULL OR NEW.stage_id = OLD.stage_id THEN
    RETURN NEW;
  END IF;

  SELECT * INTO rule FROM stage_automations
    WHERE from_stage = NEW.stage_id AND active;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- guarda origem antes de mutar
  prev_stage  := NEW.stage_id;
  prev_funnel := NEW.funnel_id;

  NEW.stage_id  := rule.to_stage;
  NEW.funnel_id := rule.to_funnel;

  -- histórico do pulo automático
  INSERT INTO deal_history (deal_id, from_stage, to_stage, from_funnel, to_funnel, moved_by)
  VALUES (NEW.id, prev_stage, rule.to_stage, prev_funnel, rule.to_funnel, auth.uid());

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS deals_apply_automation ON deals;
CREATE TRIGGER deals_apply_automation
  BEFORE UPDATE OF stage_id ON deals
  FOR EACH ROW
  EXECUTE FUNCTION apply_stage_automation();
