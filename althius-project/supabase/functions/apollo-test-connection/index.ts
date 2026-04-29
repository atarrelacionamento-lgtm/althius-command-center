import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ ok: false, message: "Method not allowed" }, 405);

  let body: { api_key?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }
  const apiKey = body.api_key?.trim();
  if (!apiKey) return json({ ok: false, message: "Informe a API key antes de testar." }, 400);

  try {
    const res = await fetch("https://api.apollo.io/api/v1/auth/health", {
      method: "GET",
      headers: {
        "Cache-Control": "no-cache",
        "X-Api-Key": apiKey,
      },
    });
    const text = await res.text();
    if (!res.ok) {
      return json({ ok: false, message: `Apollo recusou a chave (${res.status}): ${text.slice(0, 200)}` });
    }
    return json({ ok: true, message: "Chave Apollo válida. Conexão estabelecida." });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ ok: false, message: `Falha ao contatar Apollo: ${message}` });
  }
});
