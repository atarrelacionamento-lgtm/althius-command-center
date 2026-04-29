import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function buildTranscript(messages: Array<{ direction: string; body: string; occurred_at: string | null }>) {
  return messages
    .map((message) => {
      const who = message.direction === "outbound" ? "Renan" : "Lead";
      const when = message.occurred_at ? ` (${message.occurred_at})` : "";
      return `${who}${when}: ${message.body || ""}`.trim();
    })
    .join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY nao configurada");

    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { auto_reply_queue_id } = await req.json();
    if (!auto_reply_queue_id) throw new Error("auto_reply_queue_id obrigatorio");

    const { data: queueItem, error: queueError } = await supabase
      .from("auto_reply_queue")
      .select("id, chat_key, company_id, contact_id, companies(name, objective), contacts(name)")
      .eq("id", auto_reply_queue_id)
      .single();
    if (queueError) throw queueError;
    if (!queueItem) throw new Error("Fila de auto-reply nao encontrada");

    const { data: rawMessages, error: messageError } = await supabase
      .from("whatsapp_messages")
      .select("direction, body, occurred_at")
      .eq("chat_key", queueItem.chat_key)
      .order("occurred_at", { ascending: false })
      .limit(20);
    if (messageError) throw messageError;

    const messages = [...(rawMessages || [])].reverse();
    const transcript = buildTranscript(messages);
    const objective = queueItem.companies?.objective || "avancar a conversa para uma proxima reuniao qualificada";

    const systemPrompt = `Você é o Renan, CRO da Javali. Objetivo desta conta: ${objective}.
Tom: direto, curto, português BR, sem emoji desnecessário.
Responda em até 2 parágrafos à última mensagem do lead.
Contexto das últimas mensagens:
${transcript}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.5,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Gere a próxima resposta do Renan para enviar no WhatsApp." },
        ],
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result?.error?.message || "Falha ao chamar OpenAI");
    }

    const generatedMessage = String(result?.choices?.[0]?.message?.content || "").trim();
    if (!generatedMessage) throw new Error("OpenAI nao retornou mensagem");

    await supabase
      .from("auto_reply_queue")
      .update({ generated_message: generatedMessage })
      .eq("id", auto_reply_queue_id);

    return jsonResponse({ generated_message: generatedMessage });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
