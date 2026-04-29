-- Adiciona campos vindos do Apollo ao companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS employees_count   integer,
  ADD COLUMN IF NOT EXISTS founded_year      smallint,
  ADD COLUMN IF NOT EXISTS state             text,
  ADD COLUMN IF NOT EXISTS facebook_url      text;

COMMENT ON COLUMN public.companies.employees_count IS 'Número de funcionários (fonte: Apollo)';
COMMENT ON COLUMN public.companies.founded_year    IS 'Ano de fundação (fonte: Apollo)';
COMMENT ON COLUMN public.companies.state           IS 'Estado da sede (ex: Santa Catarina)';
COMMENT ON COLUMN public.companies.facebook_url    IS 'URL do perfil no Facebook';
