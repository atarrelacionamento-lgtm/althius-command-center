-- ================================================================
-- MIGRATION: adiciona coluna stage (texto) na tabela deals
-- Execute no SQL Editor do Supabase caso a tabela deals já exista
-- sem esta coluna.
-- ================================================================

alter table public.deals
  add column if not exists stage text not null default 'Qualificação'
  check (stage in ('Qualificação', 'Proposta', 'Negociação', 'Fechado - Ganho', 'Fechado - Perdido'));
