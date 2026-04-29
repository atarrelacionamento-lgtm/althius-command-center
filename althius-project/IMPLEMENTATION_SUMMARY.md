# IMPLEMENTATION SUMMARY — Althius GTM Engineering

> Documento técnico de referência. Atualizado automaticamente a cada fase de implementação.

---

## Fase 1 — Segurança e Base (Concluída)

- RLS (Row Level Security) com isolamento por `owner_id`
- Rebranding Althius (estética SpaceX Black & White)
- Estrutura de métricas de eficiência: CAC, LTV, Velocity
- Motor de orquestração de cadências baseado em eventos no Supabase

---

## Fase 2 — Módulo de Inteligência de Sinais e Automação Proativa (Implementada)

### 2.1 Motor de Sinais Ponderados

**Arquivo:** `supabase/migrations/20260430_althius_signals_automation.sql`

A função `recalculate_buying_signal(p_company_id)` foi refatorada para:

1. Detectar transições de estado (`cold → warm → hot`)
2. Ao atingir `hot`, inserir automaticamente:
   - Uma tarefa urgente em `daily_tasks`
   - Um evento em `automation_events` com `action = 'trigger_apollo_enrichment'`

Um trigger `tr_account_signal_change` foi criado na tabela `account_signals` para recalcular o score automaticamente após qualquer INSERT, UPDATE ou DELETE de sinal.

**Tabela de pesos dos sinais:**

| Sinal | Peso | Descrição |
|---|---|---|
| `new_launch` | 30 | Lançamento previsto |
| `running_ads` | 22 | Rodando mídia paga |
| `vgv_pressure` | 22 | Pressão de VGV parado |
| `funding` | 20 | Captou investimento |
| `slow_response` | 18 | Lead oculto: resposta lenta |
| `no_followup` | 18 | Lead oculto: sem follow-up |
| `hiring_sales` | 16 | Contratando comercial |
| `hiring_marketing` | 14 | Contratando marketing |
| `competitor_change` | 12 | Mudou de ferramenta |
| `custom` | 8 | Sinal customizado |

**Fórmula:** `score = min(100, sum(peso × confidence))` onde `confidence ∈ [0.35, 1.0]`

**Níveis de Propulsão:**
- `hot` → score ≥ 60
- `warm` → score ≥ 30
- `cold` → score < 30

---

### 2.2 Orquestração Automática de Missões

**Arquivo:** `supabase/migrations/20260430_althius_mission_orchestration.sql`

**Função `generate_mission_tasks_on_hot_signal`:**
- Chamada quando empresa transita para `hot`
- Gera tarefas urgentes em `daily_tasks` para cada decisor Apollo já mapeado
- Se não há decisores, cria tarefa de alerta para enriquecimento
- Registra interação de sistema em `interactions`

**Trigger `tr_company_signal_transition`:**
- Monitora `UPDATE OF buying_signal ON companies`
- Dispara `generate_mission_tasks_on_hot_signal` na transição para `hot`

**Tabela `auto_enrichment_queue`:**
- Fila de enriquecimento automático por empresa
- Status: `pending → processing → completed/failed/skipped`
- RLS com isolamento por `owner_id`

**Trigger `tr_hot_signal_queue_enrichment`:**
- Ao detectar empresa `hot`, verifica se há decisores Apollo
- Se não há (< 2 decisores), insere na fila de enriquecimento
- Evita duplicatas verificando jobs pendentes

---

### 2.3 Automação de Enriquecimento de Decisores

**Arquivo:** `src/services/enrichmentService.ts` (refatorado)

Novas funções adicionadas:

| Função | Descrição |
|---|---|
| `triggerAutoEnrichmentForCompany(companyId)` | Dispara Apollo para empresa com alta intenção |
| `detectAndQueueHighIntentCompanies()` | Escaneia e enfileira todas as empresas HOT sem decisores |
| `fetchAutoEnrichmentQueue(limit)` | Busca status da fila de enriquecimento |
| `dispatchEnrichmentQueue()` | Invoca a Edge Function `auto-enrich-dispatcher` |

**Critérios para disparo automático:**
- `buying_signal = 'hot'` OU `icp_score >= 50`
- Menos de 2 decisores Apollo já mapeados
- Nenhum job pendente/em processamento na fila

**Arquivo:** `supabase/functions/auto-enrich-dispatcher/index.ts`

Edge Function que processa a `auto_enrichment_queue`:
- Invocada pelo pg_cron a cada 5 minutos
- Processa até 10 itens por execução
- Chama `apollo-enrich-company` para cada empresa na fila
- Registra resultado em `interactions` para auditoria

---

### 2.4 Lógica de Próximo Passo Nativa

**Arquivo:** `src/services/nextStepService.ts`

Serviço determinístico (sem LLM externo) que analisa:
- Sinais de intenção (últimos 30 dias)
- Histórico de interações (últimas 20)
- Status da cadência (dia, bloco, personas)
- Resultado do lead oculto (Phase 0)

**Táticas de fechamento disponíveis:**

| Tática | Trigger |
|---|---|
| `timing_leverage` | Sinal `new_launch` detectado |
| `roi_anchor` | Sinal `running_ads` detectado |
| `pain_amplification` | Sinal `vgv_pressure` detectado |
| `competitor_displacement` | Sinal `competitor_change` detectado |
| `social_proof` | Sinal `funding` detectado |
| `executive_escalation` | > 7 dias sem contato, sem resposta |
| `direct_ask` | Respondeu + Bloco 2+ |
| `urgency_signal` | Padrão |

**Arquivo:** `src/components/crm/PropulsionPanel.tsx`

Componente React com estética SpaceX (Black & White) que exibe:
- Nível de Propulsão com score visual
- Alertas de risco (esfriamento, cadência parada)
- Análise do momento (sinais + janela de oportunidade)
- Mensagem de abordagem com botão "Copiar"
- Ações secundárias por persona
- Barra de progresso da cadência (Dia X/21)
- Botão de enriquecimento automático de decisores

---

## Arquitetura do Fluxo Automático

```
[Sinal detectado] → account_signals (INSERT)
        ↓
[Trigger tr_account_signal_change]
        ↓
[recalculate_buying_signal()]
        ↓
[companies.buying_signal = 'hot'?]
        ↓ SIM
[Trigger tr_company_signal_transition]
        ├── generate_mission_tasks_on_hot_signal() → daily_tasks (urgente)
        └── tr_hot_signal_queue_enrichment() → auto_enrichment_queue (pending)
                                                        ↓
                                          [pg_cron: a cada 5 min]
                                                        ↓
                                          [auto-enrich-dispatcher]
                                                        ↓
                                          [apollo-enrich-company]
                                                        ↓
                                          [contacts (decisores Apollo)]
                                                        ↓
                                          [PropulsionPanel atualiza]
```

---

## Arquivos Criados/Modificados

| Arquivo | Tipo | Descrição |
|---|---|---|
| `supabase/migrations/20260430_althius_signals_automation.sql` | SQL | Motor de sinais + trigger de transição |
| `supabase/migrations/20260430_althius_mission_orchestration.sql` | SQL | Orquestração de missões + fila de enriquecimento |
| `supabase/migrations/20260430_althius_cron_enrichment.sql` | SQL | Configuração do pg_cron |
| `supabase/functions/auto-enrich-dispatcher/index.ts` | Edge Function | Processador da fila de enriquecimento |
| `src/services/enrichmentService.ts` | TypeScript | Refatorado com automação por empresa |
| `src/services/nextStepService.ts` | TypeScript | Novo serviço de Próximo Passo nativo |
| `src/components/crm/PropulsionPanel.tsx` | React | Interface de Propulsão SpaceX |

---

## Configuração Necessária no Supabase

### 1. Rodar as migrations (em ordem):
```sql
-- No SQL Editor do Supabase:
-- 1. supabase/migrations/20260430_althius_signals_automation.sql
-- 2. supabase/migrations/20260430_althius_mission_orchestration.sql
-- 3. supabase/migrations/20260430_althius_cron_enrichment.sql (opcional, requer pg_cron)
```

### 2. Deploy das Edge Functions:
```bash
supabase functions deploy auto-enrich-dispatcher
```

### 3. Secrets necessários:
```
DISPATCHER_SECRET=<gerar-uuid-seguro>
```

### 4. Configurações de app (para pg_cron):
```sql
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://<projeto>.supabase.co';
ALTER DATABASE postgres SET app.settings.dispatcher_secret = '<mesmo-valor-do-secret>';
```

---

## Uso do PropulsionPanel

```tsx
import { PropulsionPanel } from '@/components/crm/PropulsionPanel';

// Em CompanyDetail.tsx ou qualquer página de empresa:
<PropulsionPanel companyId={company.id} className="mt-4" />
```

---

*Última atualização: 30/04/2026 — Fase 2 implementada por Althius Engineering*
