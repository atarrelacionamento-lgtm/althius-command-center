# Pipa Driven CRM — Plano de Acao Completo

> Documento vivo. Atualizar conforme cada fase for concluida.

---

## 1. ESTADO ATUAL (Baseline)

### O que ja funciona
- CRM completo: Contatos, Empresas, Negocios (CRUD)
- Kanban com drag-and-drop (dnd-kit)
- Funis configuraveis com estagios customizados
- Sequencias de automacao (WhatsApp + Email) com builder visual
- Integracao com n8n, Apollo, Search API (estrutura pronta)
- Enriquecimento de dados via n8n webhook
- Importacao CSV de contatos
- Dashboard com KPIs (prontos para dados reais)
- Auth com Supabase (login real, RLS ativo)
- Controle de acesso Admin/User
- Dark mode
- Responsivo (mobile-friendly)

### O que falta
- Deploy em producao (esta rodando local)
- WhatsApp espelhado dentro dos negocios
- IA (Claude) para follow-up e gestao de funil
- Metricas reais de CRO (taxas de conversao, tempo medio por estagio)
- Dominio proprio com SSL

---

## 2. ARQUITETURA DE INFRAESTRUTURA

```
                    [Usuario]
                       |
                   [Cloudflare]
                    DNS + CDN
                       |
              [crm.pipadriven.com.br]
                       |
                    [Vercel]
               React SPA (Frontend)
                       |
         +-------------+-------------+
         |                           |
    [Supabase]                 [VPS - Railway/Render]
    Auth + DB + RLS            Evolution API (WhatsApp)
    Edge Functions             n8n (Automacao)
    Realtime                        |
    Storage                    [Claude API]
                               Anthropic
```

### Decisoes de hospedagem

| Componente | Onde | Por que | Custo estimado |
|---|---|---|---|
| Frontend React | **Vercel** (free tier) | Deploy automatico via Git, preview por PR, CDN global | $0-20/mes |
| Banco + Auth | **Supabase** (ja configurado) | Ja esta funcionando, RLS ativo, Edge Functions | $0-25/mes |
| Evolution API | **Railway** ou **Render** | Container Docker, facil de escalar | $5-15/mes |
| n8n | **Railway** ou self-hosted no mesmo VPS | Orquestracao de workflows | $5-10/mes |
| Dominio | **Cloudflare** | DNS gratis, SSL gratis, protecao DDoS | ~R$50/ano |
| Claude API | **Anthropic** (pay-per-use) | Modelo mais capaz para vendas | ~$20-50/mes |

**Custo total estimado: R$150-500/mes** (depende do volume de mensagens)

---

## 3. SITEMAP COMPLETO

### 3.1 Paginas existentes (manter)

```
/login                          Login (Supabase Auth)
/dashboard                      Visao Geral — KPIs + graficos reais
/vendas                         Metricas de vendas
/funil                          Kanban (drag-drop negocios entre estagios)
/crm/contatos                   Lista de contatos + CRUD + importacao CSV
/crm/empresas                   Lista de empresas + CRUD
/crm/negocios                   Lista de negocios + CRUD
/funis                          [Admin] Configurar funis e estagios
/integracoes                    [Admin] Gerenciar integracoes (n8n, WhatsApp, etc)
/sequencias                     [Admin] Lista de sequencias de automacao
/sequencias/nova                [Admin] Builder de nova sequencia
/sequencias/:id                 [Admin] Editar sequencia existente
/settings                       Configuracoes do usuario
```

### 3.2 Paginas novas (por fase)

```
FASE 2 — WhatsApp
/crm/negocios/:id               Detalhe do negocio (chat WhatsApp + timeline + notas)

FASE 3 — IA
/ia/dashboard                   Painel IA — insights, sugestoes, metricas dos agentes
/ia/agentes                     [Admin] Configurar agentes IA (persona, funil, horario)
/ia/logs                        [Admin] Historico de acoes dos agentes

FASE 4 — CRO
/cro/conversoes                 Taxas de conversao por estagio do funil
/cro/tempo-medio                Tempo medio em cada estagio
/cro/previsao                   Forecast de receita (pipeline weighted)
/relatorios                     Relatorios exportaveis (PDF/CSV)
```

### 3.3 Sidebar atualizada (visao final)

```
PRINCIPAL
  Visao Geral          /dashboard
  Vendas               /vendas
  Funil                /funil

CRM
  Contatos             /crm/contatos
  Empresas             /crm/empresas
  Negocios             /crm/negocios

INTELIGENCIA
  Painel IA            /ia/dashboard
  CRO                  /cro/conversoes

ADMIN (so admin)
  Funis                /funis
  Integracoes          /integracoes
  Sequencias           /sequencias
  Agentes IA           /ia/agentes
  Configuracoes        /settings
```

---

## 4. FASES DE IMPLEMENTACAO

---

### FASE 1 — DEPLOY E SEGURANCA
**Duracao:** 1-2 dias
**Meta:** CRM acessivel online com seguranca real

#### Tarefas

- [ ] **1.1** Inicializar repositorio Git (se nao existe)
  ```bash
  cd seamless-crm-suite
  git init && git add . && git commit -m "initial commit"
  ```

- [ ] **1.2** Criar repositorio no GitHub (privado)
  ```bash
  gh repo create pipadriven/crm --private --source=. --push
  ```

- [ ] **1.3** Criar conta Vercel e importar repositorio
  - vercel.com → Import Git Repository
  - Framework: Vite
  - Build Command: `bun run build`
  - Output Directory: `dist`

- [ ] **1.4** Configurar variaveis de ambiente na Vercel
  ```
  VITE_SUPABASE_URL=https://dsvkoeomtnwccxxcwwga.supabase.co
  VITE_SUPABASE_ANON_KEY=<sua_anon_key>
  ```

- [ ] **1.5** Configurar dominio (opcional agora)
  - Comprar dominio (ex: pipadriven.com.br no Registro.br)
  - Apontar DNS para Vercel (CNAME: cname.vercel-dns.com)

- [ ] **1.6** Supabase — configurar URLs de producao
  - Authentication → URL Configuration → Site URL = URL da Vercel
  - Adicionar URL nos Redirect URLs

- [ ] **1.7** Rodar `migration_deals_stage.sql` no Supabase SQL Editor
  - Adiciona coluna `stage` na tabela `deals` (necessario para CRM Negocios)

- [ ] **1.8** Testar deploy: login, criar contato, criar negocio, mover no Kanban

#### Metricas de sucesso
- [ ] App acessivel via URL publica
- [ ] Login/logout funcional
- [ ] CRUD de contatos, empresas e negocios funcionando
- [ ] Kanban carregando e movendo deals

---

### FASE 2 — WHATSAPP ESPELHADO
**Duracao:** 1-2 semanas
**Meta:** Ver e enviar WhatsApp dentro de cada negocio

#### 2A — Infraestrutura WhatsApp

- [ ] **2.1** Deploy da Evolution API no Railway
  ```yaml
  # docker-compose.yml (Railway aceita)
  services:
    evolution:
      image: atendai/evolution-api:latest
      environment:
        - SERVER_URL=https://evo.pipadriven.com.br
        - AUTHENTICATION_API_KEY=<gerar_chave_segura>
        - DATABASE_PROVIDER=postgresql
        - DATABASE_CONNECTION_URI=<supabase_connection_string>
      ports:
        - "8080:8080"
  ```

- [ ] **2.2** Conectar WhatsApp via QR Code
  - POST para Evolution API → `/instance/create`
  - GET → `/instance/connect/{instance}` → QR Code
  - Escanear com WhatsApp Business

- [ ] **2.3** Configurar webhook de mensagens recebidas
  - Evolution API → webhook apontando para Edge Function do Supabase

#### 2B — Banco de dados

- [ ] **2.4** Criar tabelas no Supabase
  ```sql
  -- Mensagens WhatsApp
  create table public.whatsapp_messages (
    id uuid primary key default gen_random_uuid(),
    deal_id uuid references deals(id) on delete set null,
    contact_id uuid references contacts(id) on delete set null,
    phone text not null,
    direction text not null check (direction in ('inbound', 'outbound')),
    content text,
    media_url text,
    message_type text default 'text',
    status text default 'sent' check (status in ('sent', 'delivered', 'read', 'failed')),
    external_id text,
    created_at timestamptz default now()
  );

  -- Indice para busca rapida por negocio
  create index idx_wpp_deal on whatsapp_messages(deal_id);
  create index idx_wpp_phone on whatsapp_messages(phone);

  -- RLS
  alter table whatsapp_messages enable row level security;
  create policy "authenticated read" on whatsapp_messages
    for select to authenticated using (true);
  create policy "authenticated insert" on whatsapp_messages
    for insert to authenticated with check (true);
  ```

- [ ] **2.5** Criar Edge Function `receive-whatsapp`
  ```typescript
  // supabase/functions/receive-whatsapp/index.ts
  // Recebe webhook da Evolution API
  // Identifica contato pelo telefone
  // Vincula ao deal ativo
  // Insere na tabela whatsapp_messages
  ```

- [ ] **2.6** Criar Edge Function `send-whatsapp`
  ```typescript
  // supabase/functions/send-whatsapp/index.ts
  // Recebe: phone, content, deal_id
  // Envia via Evolution API REST
  // Registra na tabela whatsapp_messages
  ```

#### 2C — Frontend

- [ ] **2.7** Criar pagina de detalhe do negocio `/crm/negocios/:id`
  ```
  +-------------------------------------------+
  | [Voltar] Negocio: Projeto Residencial XYZ  |
  +-------------------------------------------+
  | Info do negocio    |  Chat WhatsApp        |
  | - Contato          |  [mensagem 1]         |
  | - Empresa          |  [mensagem 2]         |
  | - Valor            |  [mensagem 3]         |
  | - Estagio          |                       |
  | - Responsavel      |  [__input__] [Enviar] |
  +-------------------------------------------+
  | Timeline / Historico                       |
  | - 03/04 Deal criado                        |
  | - 04/04 Movido para Proposta               |
  | - 05/04 WhatsApp enviado                   |
  +-------------------------------------------+
  ```

- [ ] **2.8** Componente `WhatsAppChat`
  - Lista mensagens do deal via query
  - Input para digitar + botao enviar
  - Supabase Realtime para mensagens novas (sem refresh)

- [ ] **2.9** Componente `DealTimeline`
  - Mostra historico de acoes: criacao, movimentacao, mensagens, notas

- [ ] **2.10** Adicionar link "Ver detalhes" no card do Kanban e na lista de negocios

#### Metricas de sucesso
- [ ] Mensagem enviada pelo CRM chega no WhatsApp do contato
- [ ] Mensagem recebida aparece no chat dentro do negocio em < 5 segundos
- [ ] Timeline mostra historico completo de interacoes

---

### FASE 3 — INTEGRACAO CLAUDE IA
**Duracao:** 2-3 semanas
**Meta:** IA responde leads, faz follow-up e analisa funil

#### 3A — Setup

- [ ] **3.1** Criar conta Anthropic e obter API Key
  - console.anthropic.com → API Keys
  - Guardar como secret no Supabase: `ANTHROPIC_API_KEY`

- [ ] **3.2** Criar tabelas de IA no Supabase
  ```sql
  -- Configuracao de agentes
  create table public.ai_agents (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    persona_prompt text not null,
    funnel_id uuid references funnels(id),
    trigger_type text not null check (trigger_type in ('new_message', 'schedule', 'stage_change')),
    schedule_cron text,           -- ex: '0 9 * * 1-5' (9h seg-sex)
    active boolean default false,
    created_by uuid references profiles(id),
    created_at timestamptz default now()
  );

  -- Historico de conversas com IA (contexto)
  create table public.ai_conversations (
    id uuid primary key default gen_random_uuid(),
    deal_id uuid references deals(id) on delete cascade,
    agent_id uuid references ai_agents(id),
    role text not null check (role in ('system', 'user', 'assistant')),
    content text not null,
    tokens_used integer,
    created_at timestamptz default now()
  );

  -- Log de acoes executadas pela IA
  create table public.ai_logs (
    id uuid primary key default gen_random_uuid(),
    agent_id uuid references ai_agents(id),
    deal_id uuid references deals(id),
    action_type text not null,    -- 'message_sent', 'stage_suggested', 'followup_scheduled'
    details jsonb,
    created_at timestamptz default now()
  );

  -- Sugestoes da IA para o vendedor
  create table public.ai_suggestions (
    id uuid primary key default gen_random_uuid(),
    deal_id uuid references deals(id) on delete cascade,
    agent_id uuid references ai_agents(id),
    suggestion_type text not null, -- 'move_stage', 'send_followup', 'alert_cold', 'priority_high'
    message text not null,
    status text default 'pending' check (status in ('pending', 'accepted', 'dismissed')),
    created_at timestamptz default now()
  );
  ```

#### 3B — Agente de Resposta Automatica

- [ ] **3.3** Criar Edge Function `ai-respond`
  ```
  Fluxo:
  1. Webhook de nova mensagem WhatsApp (inbound)
  2. Busca: dados do contato + empresa + deal + historico
  3. Monta prompt com persona do agente + contexto
  4. Chama Claude API (claude-sonnet-4-6 para custo/beneficio)
  5. Envia resposta via send-whatsapp
  6. Registra em ai_conversations + ai_logs
  ```

- [ ] **3.4** Prompt base do agente de vendas
  ```
  Voce e um assistente de vendas da Pipa Driven.
  Seu objetivo: qualificar o lead, entender a necessidade e agendar uma reuniao.

  Regras:
  - Seja cordial e profissional
  - Faca perguntas abertas para entender a dor do cliente
  - Nao de precos sem antes entender o escopo
  - Se o lead parecer qualificado, sugira agendar uma call
  - Responda em portugues brasileiro
  - Use no maximo 3 paragrafos curtos
  ```

- [ ] **3.5** Flag `ai_auto_reply` no negocio
  - Vendedor liga/desliga IA por negocio
  - Default: desligado (vendedor ativa quando quiser)

- [ ] **3.6** Delay humano: agendar resposta com 2-5min de atraso (via pg_cron ou n8n)

#### 3C — Agente de Follow-up

- [ ] **3.7** Criar Edge Function `ai-followup`
  ```
  Fluxo (roda todo dia as 9h via cron):
  1. Busca negocios sem atividade ha N dias (configuravel por agente)
  2. Para cada negocio:
     a. Busca contexto (contato, historico, estagio)
     b. Gera mensagem personalizada com Claude
     c. Envia via WhatsApp
     d. Registra em ai_logs
  ```

- [ ] **3.8** Configurar pg_cron no Supabase
  ```sql
  select cron.schedule(
    'daily-followup',
    '0 12 * * 1-5',  -- 9h BRT (12h UTC) seg-sex
    $$select net.http_post(
      url := 'https://<project>.supabase.co/functions/v1/ai-followup',
      headers := '{"Authorization": "Bearer <service_role_key>"}'::jsonb
    )$$
  );
  ```

#### 3D — Analise de Funil com IA

- [ ] **3.9** Criar Edge Function `ai-analyze-deals`
  ```
  Fluxo (roda 1x por dia):
  1. Busca todos os negocios ativos
  2. Para cada um:
     - Tempo no estagio atual
     - Ultima interacao
     - Valor do negocio
     - Historico de movimentacao
  3. Claude analisa e gera sugestoes:
     - "Mover para Proposta" (lead qualificado)
     - "Follow-up urgente" (parado ha 5+ dias)
     - "Negocio frio" (sem resposta ha 10+ dias)
     - "Prioridade alta" (valor > X e engajamento alto)
  4. Insere em ai_suggestions
  ```

- [ ] **3.10** Badge de sugestao no KanbanCard
  ```
  [Card do Negocio]
  Projeto XYZ - R$ 50.000
  [!] IA: "Follow-up urgente - 7 dias sem contato"
  ```

#### 3E — Frontend IA

- [ ] **3.11** Pagina `/ia/dashboard`
  ```
  +--------------------------------------------+
  | Painel de Inteligencia Artificial           |
  +--------------------------------------------+
  | Metricas dos agentes (ultimos 30 dias)      |
  | - Mensagens enviadas: 245                   |
  | - Taxa de resposta: 62%                     |
  | - Reunioes agendadas: 18                    |
  | - Negocios movidos: 34                      |
  +--------------------------------------------+
  | Sugestoes pendentes                         |
  | [!] Projeto ABC - follow-up urgente [Aceitar][Ignorar] |
  | [i] Deal XYZ - mover para Proposta  [Aceitar][Ignorar] |
  +--------------------------------------------+
  ```

- [ ] **3.12** Pagina `/ia/agentes` (Admin)
  - CRUD de agentes: nome, persona, funil alvo, horario, ativo/inativo
  - Preview do prompt

- [ ] **3.13** Pagina `/ia/logs` (Admin)
  - Tabela com todas as acoes dos agentes
  - Filtros: agente, tipo de acao, periodo

#### Metricas de sucesso
- [ ] IA responde mensagem nova em < 5 minutos
- [ ] Follow-up diario roda sem falhas por 7 dias consecutivos
- [ ] Sugestoes aparecem no Kanban e podem ser aceitas/ignoradas
- [ ] Dashboard IA mostra metricas reais

---

### FASE 4 — CRO (METRICAS DE CONVERSAO)
**Duracao:** 1-2 semanas
**Meta:** Medir e otimizar cada etapa do funil

#### 4A — Dados de conversao

- [ ] **4.1** Criar view materializada de conversao por estagio
  ```sql
  create or replace view public.funnel_conversion as
  select
    f.name as funnel_name,
    fs.name as stage_name,
    fs.position,
    count(d.id) as total_deals,
    sum(d.value) as total_value,
    avg(extract(epoch from (
      coalesce(
        (select min(dh.created_at) from deal_history dh
         where dh.deal_id = d.id and dh.to_stage_id != d.stage_id),
        now()
      ) - d.created_at
    )) / 86400)::numeric(10,1) as avg_days_in_stage
  from funnels f
  join funnel_stages fs on fs.funnel_id = f.id
  left join deals d on d.funnel_id = f.id and d.stage_id = fs.id
  group by f.name, fs.name, fs.position
  order by fs.position;
  ```

- [ ] **4.2** Criar tabela `deal_events` para tracking granular
  ```sql
  create table public.deal_events (
    id uuid primary key default gen_random_uuid(),
    deal_id uuid references deals(id) on delete cascade,
    event_type text not null,  -- 'created', 'stage_changed', 'won', 'lost', 'contacted', 'meeting'
    metadata jsonb,
    created_at timestamptz default now()
  );
  ```

#### 4B — Frontend CRO

- [ ] **4.3** Pagina `/cro/conversoes`
  ```
  +--------------------------------------------+
  | Taxas de Conversao por Estagio              |
  +--------------------------------------------+
  | Funil: [Comercial v]  Periodo: [Ultimos 30d]|
  +--------------------------------------------+
  | Qualificacao  → Proposta     : 45% (89/198) |
  | Proposta      → Negociacao   : 62% (55/89)  |
  | Negociacao    → Fechado Ganho: 38% (21/55)  |
  +--------------------------------------------+
  | Taxa geral: 10.6% (21/198)                  |
  | Ticket medio: R$ 47.200                     |
  | Ciclo medio: 23 dias                        |
  +--------------------------------------------+
  | [Grafico de funil visual - barras empilhadas]|
  +--------------------------------------------+
  ```

- [ ] **4.4** Pagina `/cro/tempo-medio`
  - Tempo medio em cada estagio (por funil)
  - Comparativo mes a mes
  - Destaque em vermelho para estagios com tempo acima da media

- [ ] **4.5** Pagina `/cro/previsao` (Pipeline Forecast)
  ```
  +--------------------------------------------+
  | Previsao de Receita                         |
  +--------------------------------------------+
  | Pipeline total:    R$ 1.250.000             |
  | Ponderado (prob.): R$ 487.500               |
  | Previsto (30d):    R$ 198.000               |
  +--------------------------------------------+
  | Probabilidade por estagio:                  |
  | Qualificacao: 10% | Proposta: 30%           |
  | Negociacao: 60%   | Fechado: 100%           |
  +--------------------------------------------+
  ```

- [ ] **4.6** Atualizar Dashboard principal (`/dashboard`)
  - StatCards com dados reais do banco:
    - Total de contatos (query `count(*)`)
    - Negocios abertos (filtra stage != Fechado)
    - Valor do pipeline (sum de deals abertos)
    - Taxa de conversao geral
  - Graficos de vendas com dados reais via Recharts

- [ ] **4.7** Pagina `/relatorios`
  - Exportar relatorios em CSV/PDF
  - Filtros: periodo, funil, responsavel
  - Templates: Pipeline, Conversao, Atividade, Receita

#### Metricas de sucesso
- [ ] Dashboard mostra KPIs reais em tempo real
- [ ] Taxa de conversao calculada automaticamente por estagio
- [ ] Forecast ponderado atualiza conforme deals se movem
- [ ] Relatorios exportaveis funcionando

---

## 5. METAS POR MARCO

| Marco | Prazo | Indicador de Sucesso |
|---|---|---|
| **M1 — Online** | Dia 2 | CRM acessivel via URL, login real funcionando |
| **M2 — WhatsApp conectado** | Semana 2 | QR Code escaneado, mensagens chegando no Supabase |
| **M3 — Chat no CRM** | Semana 3 | Vendedor envia/recebe WhatsApp dentro do negocio |
| **M4 — IA responde** | Semana 4 | Claude responde lead automaticamente via WhatsApp |
| **M5 — Follow-up diario** | Semana 5 | Agente IA faz follow-up todo dia as 9h nos deals parados |
| **M6 — CRO ativo** | Semana 6 | Dashboard com taxas de conversao reais e forecast |
| **M7 — Multi-agente** | Semana 7 | 2+ agentes com personas diferentes rodando em paralelo |

---

## 6. STACK TECNICA FINAL

```
Frontend:     React 18 + TypeScript + Vite + Tailwind + shadcn/ui
Hospedagem:   Vercel (free/pro)
Backend:      Supabase (PostgreSQL + Auth + RLS + Edge Functions + Realtime)
WhatsApp:     Evolution API (Docker no Railway)
Automacao:    n8n (workflows) + pg_cron (jobs agendados)
IA:           Claude API (Anthropic) — claude-sonnet-4-6
Charts:       Recharts (ja instalado)
Drag-drop:    dnd-kit (ja instalado)
Validacao:    Zod + React Hook Form (ja instalado)
Testes:       Vitest + Playwright (ja configurado)
```

---

## 7. SEGURANCA — CHECKLIST

- [ ] **RLS** ativo em TODAS as tabelas (incluindo novas)
- [ ] **Anon key** apenas no frontend; **service_role** apenas em Edge Functions
- [ ] **CORS** configurado na Evolution API (apenas dominio do CRM)
- [ ] **Webhook secrets** — validar assinatura em cada Edge Function
- [ ] **Rate limiting** — limitar chamadas a Claude API (max 100/dia por agente)
- [ ] **API keys** — armazenadas como Supabase Secrets, nunca no codigo
- [ ] **HTTPS** em todos os endpoints (Vercel + Railway forcam SSL)
- [ ] **Backup** — ativar Point-in-Time Recovery no Supabase (plano Pro)
- [ ] **Audit log** — `deal_history` e `ai_logs` registram toda acao
- [ ] **2FA** — avaliar ativar no Supabase Auth para admins

---

## 8. ESTIMATIVA DE CUSTOS (MENSAL)

### Cenario inicial (1-5 usuarios, < 1000 mensagens/mes)

| Item | Custo |
|---|---|
| Vercel (free tier) | $0 |
| Supabase (free tier, 500MB) | $0 |
| Railway (Evolution API) | $5 |
| Claude API (~2000 chamadas) | $10-20 |
| Dominio (.com.br) | ~R$4/mes |
| **Total** | **~R$100-150/mes** |

### Cenario crescimento (10-20 usuarios, 5000+ mensagens/mes)

| Item | Custo |
|---|---|
| Vercel Pro | $20 |
| Supabase Pro (8GB, backup) | $25 |
| Railway (Evolution + n8n) | $15 |
| Claude API (~10000 chamadas) | $50-100 |
| Dominio + Cloudflare | ~R$4/mes |
| **Total** | **~R$600-900/mes** |

---

## 9. PROXIMO PASSO IMEDIATO

**Agora:** Fase 1 — Deploy na Vercel

1. Garantir que o repo esta no GitHub
2. Conectar na Vercel
3. Configurar env vars
4. Testar deploy
5. Configurar Supabase redirect URLs

Tempo estimado: 30 minutos.

---

> "Nao e sobre ter a ferramenta perfeita no dia 1.
> E sobre ter a ferramenta certa evoluindo todo dia."
