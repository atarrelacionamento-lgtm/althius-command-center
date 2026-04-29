# SPRINT — Pipa Driven v2
**Meta:** Transformar o CRM num revenue platform tipo Monaco
**Prazo:** 1 hora
**Equipe:** Claude Code (backend/infra/UI) + Codex (componentes paralelos)

---

## ISSUES

### PIPA-001 — Daily Command Center `/hoje` [CLAUDE CODE]
**Prioridade:** CRITICA
**O quê:** Página que abre todo dia de manhã e mostra exatamente o que fazer
**Entrega:**
- Lista de ações do dia agrupadas por tipo (Enviar WPP / Ligar / Conectar LinkedIn)
- Por conta: nome da empresa, persona, dia da cadência, mensagem gerada
- Botão "Copiar mensagem" + marcar como feito
- Badge de urgência (vermelho = atrasado, amarelo = hoje, verde = adiantado)

---

### PIPA-002 — Interaction Timeline por Conta [CLAUDE CODE]
**Prioridade:** ALTA
**O quê:** Feed de todas as interações em cada empresa/negócio
**Entrega:**
- Tabela `interactions` no Supabase
- Timeline visual em `/crm/empresas/:id` e `/crm/negocios/:id`
- Tipos: whatsapp_sent, whatsapp_received, email, call, linkedin, note, meeting
- Resumo automático por Claude AI

---

### PIPA-003 — Gerador de Mensagens com Claude API [CLAUDE CODE]
**Prioridade:** CRITICA
**O quê:** Dado empresa + persona + dia da cadência → gera mensagem personalizada
**Entrega:**
- Edge Function `generate-message` no Supabase
- Usa templates do GTM como base
- Input: company_id, persona_type, cadence_day, lead_test_result
- Output: mensagem pronta, canal recomendado, tom

---

### PIPA-004 — SQL: Tabelas ABM [CLAUDE CODE]
**Prioridade:** CRITICA (blocker das outras)
**O quê:** Migrations para suportar todo o fluxo ABM
**Entrega:**
- `account_signals` — sinais de compra por empresa
- `cadence_tracks` — qual dia cada conta está na cadência
- `interactions` — log de toda interação por conta/contato
- `daily_tasks` — fila de ações geradas automaticamente
- `phase0_results` — resultado do lead oculto por empresa

---

### PIPA-005 — Signal Engine: Score de Momento de Compra [CODEX]
**Prioridade:** ALTA
**O quê:** Sistema de score que indica se empresa está no momento de compra
**Entrega:**
- Componente `SignalBadge` (Quente/Morno/Frio)
- Cálculo: lançamento previsto + contratando + rodando mídia + sem resposta ao lead oculto
- Filtro na lista de empresas por score

---

### PIPA-006 — Cadence Tracker: Status Visual da Cadência [CODEX]
**Prioridade:** ALTA
**O quê:** Visualizar em que bloco/dia cada conta está na cadência de 21 dias
**Entrega:**
- Barra de progresso por conta (Dia X/21)
- Bloco atual: Bloco 1 (Cerco) / Bloco 2 (Escalada) / Bloco 3 (Fechamento)
- Personas contatadas: ✓ CMO / ✓ Dir. Comercial / ✗ Sócio
- Status: Em andamento / Parado / Reunião agendada / Perdido

---

### PIPA-007 — Apollo Enrichment Trigger [CODEX]
**Prioridade:** MEDIA
**O quê:** Botão na empresa que dispara enriquecimento via Apollo API
**Entrega:**
- Botão "Enriquecer com Apollo" na ficha da empresa
- Chama n8n webhook que busca 3 personas (CMO, Dir, Sócio)
- Retorna e salva: nome, cargo, LinkedIn, email, WhatsApp estimado
- Status: pending / enriching / done / error

---

## DIVISÃO DE TRABALHO

```
CLAUDE CODE executa agora:          CODEX executa em paralelo:
├── PIPA-004 (SQL migrations)       ├── PIPA-005 (Signal Engine)
├── PIPA-001 (Daily Command Center) ├── PIPA-006 (Cadence Tracker)
├── PIPA-002 (Interaction Timeline) └── PIPA-007 (Apollo Trigger)
└── PIPA-003 (Message Generator)
```

## ORDEM DE EXECUÇÃO (Claude Code)

1. PIPA-004 → SQL (5 min) — blocker de tudo
2. PIPA-001 → Daily Command Center (20 min) — maior impacto imediato
3. PIPA-003 → Message Generator (15 min) — multiplica produtividade
4. PIPA-002 → Interaction Timeline (20 min) — completa o loop

## PROMPT PARA CODEX

Para cada issue do Codex, use este contexto:
- Stack: React 18 + TypeScript + Tailwind + shadcn/ui + Supabase
- Projeto: c:\Users\RenanZanato\OneDrive\Anexos\agente-pipa-driven\seamless-crm-suite
- Padrão de componentes: ver src/components/crm/ContactForm.tsx
- Padrão de serviços: ver src/services/crmService.ts
- Supabase client: import { supabase } from '@/lib/supabase'
