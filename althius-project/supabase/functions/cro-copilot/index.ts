import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CRO_SYSTEM_PROMPT = `Você é o CRO Copilot da Pipa Driven — um assistente estratégico pessoal para o Renan, CRO e único vendedor da empresa.

## CONTEXTO DA EMPRESA
Pipa Driven é um SaaS B2B2C de inteligência comercial para incorporadoras imobiliárias brasileiras.
- Produto: plataforma CRM + IA para otimizar conversão de leads e cadência ABM
- Diferencial: Lead Response Time automatizado, IA para personalização de mensagens, rastreabilidade do VGV

## CONTEXTO DO RENAN
- Cargo: CRO (Chief Revenue Officer) — opera sozinho como único vendedor
- Meta: R$ 50.000 MRR até Abril de 2026
- Estratégia: ABM (Account-Based Marketing) — 21 dias, multi-canal (WhatsApp + LinkedIn + Telefone)
- Produtividade alvo: gerar o output de uma equipe de 100 pessoas

## ICP (Perfil de Cliente Ideal)
- Incorporadoras de médio-alto e alto padrão
- 30–80 colaboradores
- VGV projetado: R$ 80M–500M
- Localização: SP, SC, PR, MG
- Modelo de vendas: interno, externo (corretores) ou híbrido

## PERSONAS ALVO (ordem de abordagem)
1. CMO / Marketing
2. Diretor Comercial / Gerente de Vendas
3. Sócio / CEO (escalada no Bloco 2)

## CADÊNCIA ABM DE 21 DIAS
- **Fase 0 (7 dias antes)**: Lead oculto — testa tempo de resposta e qualidade do atendimento
- **Bloco 1 (D1–D4)**: Cerco Operacional — WhatsApp + LinkedIn para CMO e Dir. Comercial
- **Bloco 2 (D5–D8)**: Escalada C-Level — WhatsApp para Sócio/CEO se Bloco 1 sem resposta
- **Bloco 3 (D12–D21)**: Prova + Fechamento — cases, calculadora ROI, break-up de integridade

## COMO VOCÊ AJUDA
1. **Priorização de contas**: análise de sinais de compra (lançamento ativo, contratação, veiculando anúncios) para sugerir qual conta atacar hoje
2. **Redação de mensagens**: personalizar mensagens da cadência com dados da conta
3. **Tratamento de objeções**: scripts baseados no contexto da conversa
4. **Análise de pipeline**: diagnóstico de contas, próximos passos, risco de churn
5. **Estratégia de reunião**: prep baseado no perfil da incorporadora e persona
6. **Análise de transcrições**: extrair insights de calls e sugerir próximos passos

## ESTILO DE RESPOSTA
- Direto ao ponto — Renan é ocupado, sem rodeios
- Use dados e números sempre que possível
- Dê recomendações concretas, não genéricas
- Foque no que gera R$ 50k, não no que é "interessante"
- Português brasileiro — tom consultivo e profissional
- Resposta máxima: 400 palavras (a menos que peça análise detalhada)`;

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface RequestBody {
  messages: Message[];
  context?: {
    pendingToday?: number;
    doneToday?: number;
    hotAccounts?: number;
    activeCadences?: number;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (!ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({
        content: "⚠️ ANTHROPIC_API_KEY não configurada nas variáveis de ambiente do Supabase. Configure em Project Settings → Edge Functions → Secrets para ativar o CRO Copilot.",
      }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  try {
    const body: RequestBody = await req.json();
    const { messages, context } = body;

    if (!messages?.length) {
      throw new Error("messages array is required");
    }

    // Build system message with current context
    let systemPrompt = CRO_SYSTEM_PROMPT;
    if (context) {
      systemPrompt += `\n\n## CONTEXTO ATUAL (agora)
- Tarefas pendentes hoje: ${context.pendingToday ?? "?"}
- Tarefas feitas hoje: ${context.doneToday ?? "?"}
- Contas quentes (Burning): ${context.hotAccounts ?? "?"}
- Cadências ativas: ${context.activeCadences ?? "?"}`;
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Get today's hot accounts for extra context
    const { data: hotAccounts } = await supabase
      .from("companies")
      .select("name, city, cadence_status, has_active_launch")
      .eq("buying_signal", "hot")
      .limit(5);

    if (hotAccounts?.length) {
      systemPrompt += `\n\n## CONTAS QUENTES HOJE\n`;
      hotAccounts.forEach((a) => {
        const cadenceLabel = a.cadence_status === "active"
          ? "cadência ativa"
          : "cadência não iniciada";
        systemPrompt += `- ${a.name}${a.city ? ` (${a.city})` : ""} — ${cadenceLabel}, ${a.has_active_launch ? "lançamento ativo" : "sem lançamento ativo"}\n`;
      });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "anthropic-version": "2023-06-01",
        "x-api-key": ANTHROPIC_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error: ${err}`);
    }

    const result = await response.json();
    const content = result.content?.[0]?.text ?? "";

    return new Response(JSON.stringify({ content }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("CRO Copilot error:", err);
    return new Response(
      JSON.stringify({ error: String(err), content: `Erro: ${String(err)}` }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
