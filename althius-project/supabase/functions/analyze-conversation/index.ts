import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const SYSTEM_PROMPT = `Você é um analista de inteligência comercial da Pipa Driven, especialista em prospecção ABM de incorporadoras imobiliárias.

Sua tarefa: analisar conversas de WhatsApp entre o Renan (vendedor da Pipa Driven) e potenciais clientes (incorporadoras), e extrair insights estruturados para ajudar na cadência de 21 dias.

CONTEXTO DO PRODUTO:
- Pipa Driven = SaaS de inteligência comercial para incorporadoras
- Proposta de valor: Lead Response Time, IA para conversão, rastreabilidade de VGV
- Meta do Renan: R$ 50k MRR, 4 contratos/mês, 200 incorporadoras em prospecção

Você deve retornar um JSON com a estrutura abaixo (SEM markdown, SEM explicação, APENAS o JSON):

{
  "summary": "Resumo executivo de 2-3 frases da conversa",
  "sentiment": "positive | neutral | negative | objecting",
  "interest_level": "high | medium | low | none",
  "objections": ["objeção 1", "objeção 2"],
  "next_steps": ["próximo passo 1", "próximo passo 2"],
  "signal_recommendation": "hot | warm | cold",
  "key_insights": ["insight 1", "insight 2"],
  "cadence_guidance": "Leitura comercial da conversa para o vendedor; não gere resposta para enviar ao lead"
}

CRITÉRIOS:
- sentiment "positive": interesse real, perguntas sobre o produto, disposição para reunião
- sentiment "negative": rejeição clara, sem interesse
- sentiment "objecting": interesse mas com barreiras (preço, timing, "já temos algo")
- interest_level "high": pediu reunião, pediu proposta, fez perguntas técnicas
- signal_recommendation "hot": alta probabilidade de fechamento próximo (respondeu rápido, interesse ativo)
- signal_recommendation "warm": interesse presente mas sem urgência clara
- signal_recommendation "cold": sem resposta, rejeição ou indiferença

RESTRIÇÃO DE MVP:
- Não escreva uma resposta para enviar ao lead.
- Não execute nem recomende automação outbound.
- Analise apenas o conteúdo salvo no CRM.`;

type SupabaseClient = ReturnType<typeof createClient>;

type ConversationPayload = {
  conversation_id?: string;
  raw_text?: string;
  company_name?: string | null;
  contact_name?: string | null;
  cadence_day?: number | null;
  persona_type?: string | null;
  wait_for_result?: boolean;
};

type AnalysisResult = {
  summary: string;
  sentiment: "positive" | "neutral" | "negative" | "objecting";
  interest_level: "high" | "medium" | "low" | "none";
  objections: string[];
  next_steps: string[];
  signal_recommendation: "hot" | "warm" | "cold";
  key_insights: string[];
  cadence_guidance: string;
};

type EdgeRuntimeGlobal = typeof globalThis & {
  EdgeRuntime?: {
    waitUntil?: (promise: Promise<unknown>) => void;
  };
};

const ANTHROPIC_MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-4-6";

function asString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim()).map((entry) => entry.trim())
    : [];
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T) {
  return allowed.includes(value as T) ? value as T : fallback;
}

function sanitizeAnalysis(value: Record<string, unknown>): AnalysisResult {
  return {
    summary: asString(value.summary, "Conversa salva no CRM. A análise automática não retornou um resumo."),
    sentiment: enumValue(value.sentiment, ["positive", "neutral", "negative", "objecting"] as const, "neutral"),
    interest_level: enumValue(value.interest_level, ["high", "medium", "low", "none"] as const, "low"),
    objections: asStringArray(value.objections),
    next_steps: asStringArray(value.next_steps),
    signal_recommendation: enumValue(value.signal_recommendation, ["hot", "warm", "cold"] as const, "cold"),
    key_insights: asStringArray(value.key_insights),
    cadence_guidance: asString(value.cadence_guidance, "Revisar a conversa manualmente no CRM."),
  };
}

async function patchConversation(
  db: SupabaseClient,
  conversationId: string | undefined,
  variants: Record<string, unknown>[],
) {
  if (!conversationId) return true;

  let lastError: unknown = null;
  for (const payload of variants) {
    const { error } = await db
      .from("whatsapp_conversations")
      .update(payload)
      .eq("id", conversationId);

    if (!error) return true;
    lastError = error;
  }

  console.warn("[analyze-conversation] failed to patch conversation", conversationId, lastError);
  return false;
}

async function markProcessing(db: SupabaseClient, conversationId?: string) {
  await patchConversation(db, conversationId, [
    { analysis_status: "processing", analysis_error: null, analyzed: false },
    { analyzed: false },
  ]);
}

async function markFailed(db: SupabaseClient, conversationId: string | undefined, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  await patchConversation(db, conversationId, [
    {
      analysis_status: "failed",
      analysis_error: message,
      analyzed: false,
      analyzed_at: null,
    },
    { analyzed: false },
  ]);
}

async function markDone(db: SupabaseClient, conversationId: string | undefined, analysis: AnalysisResult) {
  const analyzedAt = new Date().toISOString();
  const currentSchemaPayload = {
    summary: analysis.summary,
    sentiment: analysis.sentiment,
    interest_level: analysis.interest_level,
    objections: analysis.objections,
    next_steps: analysis.next_steps,
    signal_recommendation: analysis.signal_recommendation,
    analyzed: true,
    analyzed_at: analyzedAt,
  };

  await patchConversation(db, conversationId, [
    {
      ...currentSchemaPayload,
      key_insights: analysis.key_insights,
      cadence_guidance: analysis.cadence_guidance,
      suggested_reply: "",
      analysis_status: "done",
      analysis_error: null,
    },
    {
      ...currentSchemaPayload,
      key_insights: analysis.key_insights,
      cadence_guidance: analysis.cadence_guidance,
      analysis_status: "done",
      analysis_error: null,
    },
    {
      ...currentSchemaPayload,
      suggested_reply: "",
      analysis_status: "done",
      analysis_error: null,
    },
    {
      ...currentSchemaPayload,
      analysis_status: "done",
      analysis_error: null,
    },
    {
      ...currentSchemaPayload,
      suggested_reply: "",
    },
    currentSchemaPayload,
  ]);
}

async function loadConversationPayload(db: SupabaseClient, payload: ConversationPayload) {
  if (payload.raw_text?.trim() || !payload.conversation_id) {
    return payload;
  }

  const { data, error } = await db
    .from("whatsapp_conversations")
    .select("*")
    .eq("id", payload.conversation_id)
    .single();

  if (error) throw error;
  return {
    ...payload,
    raw_text: data?.raw_text ?? "",
    company_name: payload.company_name ?? data?.company_name ?? null,
    contact_name: payload.contact_name ?? data?.contact_name ?? null,
    cadence_day: payload.cadence_day ?? data?.cadence_day ?? null,
    persona_type: payload.persona_type ?? data?.persona_type ?? null,
  };
}

async function callAnthropic(payload: ConversationPayload): Promise<AnalysisResult> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const userPrompt = `Analise a seguinte conversa de WhatsApp:

EMPRESA: ${payload.company_name || "Não informada"}
CONTATO: ${payload.contact_name || "Não informado"}
DIA DA CADÊNCIA: ${payload.cadence_day || "Não informado"}
PERSONA: ${payload.persona_type || "Não informada"}

--- CONVERSA ---
${payload.raw_text}
--- FIM DA CONVERSA ---`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "anthropic-version": "2023-06-01",
      "x-api-key": ANTHROPIC_API_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) throw new Error(`Anthropic error: ${await response.text()}`);

  const result = await response.json();
  const rawJson = result.content?.[0]?.text ?? "{}";

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    const match = rawJson.match(/\{[\s\S]*\}/);
    parsed = match ? JSON.parse(match[0]) : {};
  }

  return sanitizeAnalysis(parsed);
}

async function processConversation(payload: ConversationPayload) {
  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const resolvedPayload = await loadConversationPayload(db, payload);

  if (!resolvedPayload.raw_text?.trim()) {
    throw new Error("raw_text is required");
  }

  await markProcessing(db, resolvedPayload.conversation_id);

  try {
    const analysis = await callAnthropic(resolvedPayload);
    await markDone(db, resolvedPayload.conversation_id, analysis);
    return { ok: true, analyzed: true, conversation_id: resolvedPayload.conversation_id ?? null, analysis };
  } catch (error) {
    await markFailed(db, resolvedPayload.conversation_id, error);
    throw error;
  }
}

function runInBackground(promise: Promise<unknown>) {
  const runtime = (globalThis as EdgeRuntimeGlobal).EdgeRuntime;
  const handled = promise.catch((error) => {
    console.error("[analyze-conversation] background processing failed", error);
  });

  if (runtime?.waitUntil) {
    runtime.waitUntil(handled);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  let payload: ConversationPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body" }, 400);
  }

  if (!payload.conversation_id && !payload.raw_text?.trim()) {
    return json({ ok: false, error: "conversation_id or raw_text is required" }, 400);
  }

  if (!payload.conversation_id || payload.wait_for_result) {
    try {
      const result = await processConversation(payload);
      return json(result);
    } catch (error) {
      console.error("analyze-conversation inline error:", error);
      return json({
        ok: false,
        analyzed: false,
        conversation_id: payload.conversation_id ?? null,
        error: error instanceof Error ? error.message : String(error),
      }, 500);
    }
  }

  runInBackground(processConversation(payload));
  return json({
    ok: true,
    queued: true,
    analyzed: false,
    conversation_id: payload.conversation_id,
  }, 202);
});
