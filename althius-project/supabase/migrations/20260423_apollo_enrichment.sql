-- ============================================================
-- Pipa Driven — Apollo enrichment (waterfall, Clay-style)
-- Adiciona campos Apollo em contacts, enrichment_jobs e deduplicação.
-- ============================================================

-- 1) Campos Apollo em contacts
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS apollo_person_id   text,
  ADD COLUMN IF NOT EXISTS linkedin_url       text,
  ADD COLUMN IF NOT EXISTS seniority          text,
  ADD COLUMN IF NOT EXISTS departments        text[],
  ADD COLUMN IF NOT EXISTS enriched_at        timestamptz,
  ADD COLUMN IF NOT EXISTS enrichment_source  text;

COMMENT ON COLUMN public.contacts.apollo_person_id  IS 'ID único da pessoa no Apollo (dedupe)';
COMMENT ON COLUMN public.contacts.linkedin_url      IS 'URL do perfil LinkedIn';
COMMENT ON COLUMN public.contacts.seniority         IS 'Nível hierárquico (owner, founder, c_suite, vp, director, manager, senior, entry)';
COMMENT ON COLUMN public.contacts.departments       IS 'Departamentos (ex: c_suite, sales, operations)';
COMMENT ON COLUMN public.contacts.enriched_at       IS 'Timestamp do último enriquecimento bem-sucedido';
COMMENT ON COLUMN public.contacts.enrichment_source IS 'Provedor que forneceu o dado (apollo, datagma, etc)';

-- Dedupe global por apollo_person_id (nulls allowed)
CREATE UNIQUE INDEX IF NOT EXISTS contacts_apollo_person_id_key
  ON public.contacts (apollo_person_id)
  WHERE apollo_person_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS contacts_company_seniority_idx
  ON public.contacts (company_id, seniority);

-- 2) Tabela de jobs de enriquecimento (audit + webhook lookup)
CREATE TABLE IF NOT EXISTS public.enrichment_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  contact_id      uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  owner_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  provider        text NOT NULL DEFAULT 'apollo',
  stage           text NOT NULL DEFAULT 'search',
  status          text NOT NULL DEFAULT 'pending',
  credits_used    integer DEFAULT 0,
  request_payload jsonb,
  response_payload jsonb,
  error_message   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS enrichment_jobs_company_idx ON public.enrichment_jobs (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS enrichment_jobs_owner_idx   ON public.enrichment_jobs (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS enrichment_jobs_status_idx  ON public.enrichment_jobs (status) WHERE status IN ('pending','processing');

-- RLS
ALTER TABLE public.enrichment_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS enrichment_jobs_owner_select ON public.enrichment_jobs;
CREATE POLICY enrichment_jobs_owner_select
  ON public.enrichment_jobs FOR SELECT
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS enrichment_jobs_owner_insert ON public.enrichment_jobs;
CREATE POLICY enrichment_jobs_owner_insert
  ON public.enrichment_jobs FOR INSERT
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS enrichment_jobs_owner_update ON public.enrichment_jobs;
CREATE POLICY enrichment_jobs_owner_update
  ON public.enrichment_jobs FOR UPDATE
  USING (owner_id = auth.uid());

-- 3) Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS enrichment_jobs_updated_at ON public.enrichment_jobs;
CREATE TRIGGER enrichment_jobs_updated_at
  BEFORE UPDATE ON public.enrichment_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
