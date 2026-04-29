import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * ALTHIUS GTM Engineering — Auto Enrich Dispatcher
 *
 * Esta Edge Function é responsável por processar a fila `auto_enrichment_queue`.
 * Ela é invocada:
 *   1. Por um Supabase Cron Job a cada 5 minutos
 *   2. Diretamente pelo enrichmentService.ts via `supabase.functions.invoke`
 *
 * Para cada item `pending` na fila, ela chama `apollo-enrich-company`
 * usando o service_role para contornar a autenticação do usuário,
 * garantindo que o enriquecimento aconteça de forma autônoma.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DISPATCHER_SECRET = Deno.env.get("DISPATCHER_SECRET") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-dispatcher-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

interface QueueItem {
  id: string;
  company_id: string;
  owner_id: string | null;
  trigger_reason: string;
  score_at_trigger: number | null;
  status: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Validar secret do dispatcher (para chamadas de cron ou internas)
  const providedSecret = req.headers.get("x-dispatcher-secret") ?? "";
  const authHeader = req.headers.get("Authorization") ?? "";

  const isInternalCall = DISPATCHER_SECRET && providedSecret === DISPATCHER_SECRET;
  const isServiceRole = authHeader.includes(SUPABASE_SERVICE_KEY);

  if (!isInternalCall && !isServiceRole) {
    // Permitir também chamadas autenticadas de usuários admin
    const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    if (!userRes?.user) return json({ error: "Unauthorized" }, 401);

    const { data: profile } = await userClient
      .from("profiles")
      .select("role")
      .eq("id", userRes.user.id)
      .single();

    if (profile?.role !== "admin") return json({ error: "Forbidden: admin only" }, 403);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Buscar itens pendentes na fila (máximo 10 por execução)
  const { data: pendingItems, error: fetchError } = await admin
    .from("auto_enrichment_queue")
    .select("id, company_id, owner_id, trigger_reason, score_at_trigger, status")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(10);

  if (fetchError) {
    console.error("[auto-enrich-dispatcher] Error fetching queue:", fetchError.message);
    return json({ error: fetchError.message }, 500);
  }

  const items = (pendingItems ?? []) as QueueItem[];

  if (items.length === 0) {
    return json({ ok: true, processed: 0, message: "Queue is empty" });
  }

  const results: Array<{
    queue_id: string;
    company_id: string;
    status: "completed" | "failed" | "skipped";
    error?: string;
  }> = [];

  for (const item of items) {
    // Marcar como processing
    await admin
      .from("auto_enrichment_queue")
      .update({ status: "processing" })
      .eq("id", item.id);

    try {
      // Verificar se a empresa ainda está HOT e se o owner tem Apollo configurado
      const { data: company } = await admin
        .from("companies")
        .select("id, name, buying_signal, owner_id")
        .eq("id", item.company_id)
        .single();

      if (!company) {
        await admin
          .from("auto_enrichment_queue")
          .update({
            status: "failed",
            error_message: "Company not found",
            processed_at: new Date().toISOString(),
          })
          .eq("id", item.id);
        results.push({ queue_id: item.id, company_id: item.company_id, status: "failed", error: "Company not found" });
        continue;
      }

      if (company.buying_signal !== "hot") {
        // Empresa não está mais HOT, pular
        await admin
          .from("auto_enrichment_queue")
          .update({
            status: "skipped",
            error_message: "Company is no longer hot",
            processed_at: new Date().toISOString(),
          })
          .eq("id", item.id);
        results.push({ queue_id: item.id, company_id: item.company_id, status: "skipped" });
        continue;
      }

      const ownerId = item.owner_id ?? company.owner_id;

      // Verificar se o owner tem Apollo configurado
      const { data: integration } = await admin
        .from("integrations")
        .select("id, api_key_encrypted, status")
        .eq("name", "apollo")
        .eq("configured_by", ownerId)
        .maybeSingle();

      if (!integration?.api_key_encrypted) {
        await admin
          .from("auto_enrichment_queue")
          .update({
            status: "skipped",
            error_message: "Apollo API key not configured for owner",
            processed_at: new Date().toISOString(),
          })
          .eq("id", item.id);
        results.push({ queue_id: item.id, company_id: item.company_id, status: "skipped", error: "Apollo not configured" });
        continue;
      }

      // Criar um token de sessão temporário para o owner (necessário para apollo-enrich-company)
      // Usamos o service_role para gerar um token de acesso temporário
      const { data: sessionData, error: sessionError } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: ownerId, // Fallback: usar service_role diretamente na chamada
      });

      // Chamar apollo-enrich-company via fetch interno com service_role
      const enrichResponse = await fetch(
        `${SUPABASE_URL}/functions/v1/apollo-enrich-company`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
            "x-owner-id": ownerId, // Header customizado para bypass de auth
          },
          body: JSON.stringify({
            company_id: item.company_id,
            max_contacts: 5,
            reveal_phones: true,
            _service_role_bypass: true, // Flag para a função aceitar service_role
            _owner_id: ownerId,
          }),
        }
      );

      const enrichData = await enrichResponse.json();

      if (!enrichResponse.ok || !enrichData.ok) {
        const errorMsg = enrichData.error ?? `HTTP ${enrichResponse.status}`;
        await admin
          .from("auto_enrichment_queue")
          .update({
            status: "failed",
            error_message: errorMsg,
            processed_at: new Date().toISOString(),
          })
          .eq("id", item.id);
        results.push({ queue_id: item.id, company_id: item.company_id, status: "failed", error: errorMsg });
        continue;
      }

      // Sucesso: atualizar fila e registrar job_id
      await admin
        .from("auto_enrichment_queue")
        .update({
          status: "completed",
          processed_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      // Registrar interação de sistema
      await admin.from("interactions").insert({
        company_id: item.company_id,
        interaction_type: "note",
        content: `Enriquecimento automático Apollo concluído. ${enrichData.created ?? 0} decisores identificados.`,
        summary: `Auto-enriquecimento: ${enrichData.created ?? 0} contatos criados via Apollo (trigger: ${item.trigger_reason})`,
        direction: "outbound",
        metadata: {
          automated: true,
          trigger: item.trigger_reason,
          score_at_trigger: item.score_at_trigger,
          contacts_created: enrichData.created ?? 0,
          credits_used: enrichData.credits_used ?? 0,
        },
      });

      results.push({ queue_id: item.id, company_id: item.company_id, status: "completed" });

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[auto-enrich-dispatcher] Error processing item", item.id, message);

      await admin
        .from("auto_enrichment_queue")
        .update({
          status: "failed",
          error_message: message,
          processed_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      results.push({ queue_id: item.id, company_id: item.company_id, status: "failed", error: message });
    }
  }

  const summary = {
    ok: true,
    processed: results.length,
    completed: results.filter((r) => r.status === "completed").length,
    failed: results.filter((r) => r.status === "failed").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    results,
  };

  console.log("[auto-enrich-dispatcher] Summary:", JSON.stringify(summary));
  return json(summary);
});
