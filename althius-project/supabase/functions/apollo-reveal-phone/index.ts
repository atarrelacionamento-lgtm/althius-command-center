import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APOLLO_WEBHOOK_SECRET = Deno.env.get("APOLLO_WEBHOOK_SECRET") ?? "";
const APOLLO_WEBHOOK_URL = APOLLO_WEBHOOK_SECRET
  ? `${SUPABASE_URL}/functions/v1/apollo-phone-webhook?token=${encodeURIComponent(APOLLO_WEBHOOK_SECRET)}`
  : null;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ApolloPhoneNumber {
  raw_number?: string;
  sanitized_number?: string;
  type?: string;
  status?: string;
  dnc_status?: string;
  source?: string;
  position?: number;
}

interface ApolloPerson {
  id?: string;
  mobile_phone?: string;
  phone_numbers?: ApolloPhoneNumber[];
  personal_numbers?: Array<string | ApolloPhoneNumber>;
  organization_phones?: string[];
  personal_emails?: string[];
  email?: string;
  email_status?: string;
  linkedin_url?: string;
}

// Retorna o melhor telefone + detalhamento pra debug
function pickPhone(p: ApolloPerson): { phone: string | null; source: string | null; debug: Record<string, unknown> } {
  const debug: Record<string, unknown> = {
    has_mobile_phone: !!p.mobile_phone,
    phone_numbers_count: p.phone_numbers?.length ?? 0,
    phone_numbers_types: (p.phone_numbers ?? []).map((n) => n.type ?? "unknown"),
    phone_numbers_sources: (p.phone_numbers ?? []).map((n) => n.source ?? "unknown"),
    has_personal_numbers: Array.isArray(p.personal_numbers) && p.personal_numbers.length > 0,
    organization_phones_count: p.organization_phones?.length ?? 0,
  };

  // 1) mobile_phone direto (mais confiável)
  if (p.mobile_phone) return { phone: p.mobile_phone, source: "mobile_phone_field", debug };

  // 2) phone_numbers[] — prioriza mobile
  const phones = p.phone_numbers ?? [];
  const priorities = ["mobile", "personal_mobile", "cell", "work_mobile"];
  for (const pri of priorities) {
    const match = phones.find((n) => (n.type ?? "").toLowerCase().includes(pri));
    if (match) {
      const num = match.sanitized_number || match.raw_number;
      if (num) return { phone: num, source: `phone_numbers.${match.type}${match.source ? `(${match.source})` : ""}`, debug };
    }
  }

  // 3) Qualquer phone_numbers com número (work/direct/home como fallback)
  for (const n of phones) {
    const num = n.sanitized_number || n.raw_number;
    if (num) return { phone: num, source: `phone_numbers.${n.type ?? "unknown"}${n.source ? `(${n.source})` : ""}`, debug };
  }

  // 4) personal_numbers[] (campo menos comum mas aparece)
  if (Array.isArray(p.personal_numbers)) {
    for (const pn of p.personal_numbers) {
      if (typeof pn === "string" && pn) return { phone: pn, source: "personal_numbers", debug };
      if (pn && typeof pn === "object") {
        const num = pn.sanitized_number || pn.raw_number;
        if (num) return { phone: num, source: "personal_numbers.object", debug };
      }
    }
  }

  return { phone: null, source: null, debug };
}

function pickEmail(p: ApolloPerson): string | null {
  if (p.email && p.email_status !== "unavailable" && !p.email.includes("email_not_unlocked")) {
    return p.email;
  }
  return p.personal_emails?.[0] ?? null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Missing bearer token" }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) return json({ error: "Unauthenticated" }, 401);
  const userId = userRes.user.id;

  let body: { contact_id?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }
  const contactId = body.contact_id;
  if (!contactId) return json({ error: "contact_id is required" }, 400);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: contact, error: contactErr } = await admin
    .from("contacts")
    .select("id, name, apollo_person_id, phone, email, linkedin_url, company_id, owner_id")
    .eq("id", contactId)
    .maybeSingle();
  if (contactErr) return json({ error: contactErr.message }, 500);
  if (!contact) return json({ error: "Contato não encontrado" }, 404);
  if (contact.owner_id !== userId) return json({ error: "Forbidden" }, 403);
  if (!contact.apollo_person_id && !contact.linkedin_url && !contact.email) {
    return json({ error: "Contato sem identificador Apollo (sem apollo_person_id, LinkedIn ou e-mail)." }, 400);
  }

  const { data: integration } = await admin
    .from("integrations")
    .select("api_key_encrypted")
    .eq("name", "apollo")
    .eq("configured_by", userId)
    .maybeSingle();
  const apiKey = integration?.api_key_encrypted;
  if (!apiKey) return json({ error: "Apollo API key não configurada." }, 400);

  const { data: job } = await admin
    .from("enrichment_jobs")
    .insert({
      company_id: contact.company_id,
      contact_id: contact.id,
      owner_id: userId,
      provider: "apollo",
      stage: "reveal_phone",
      status: "processing",
      request_payload: { contact_id: contact.id, apollo_person_id: contact.apollo_person_id },
    })
    .select("id")
    .single();

  const updateJob = (patch: Record<string, unknown>) =>
    job?.id ? admin.from("enrichment_jobs").update(patch).eq("id", job.id) : Promise.resolve();

  try {
    // reveal_*       → base nativa Apollo (síncrono, grátis no plano pago)
    // run_waterfall_* → providers terceiros (Cognism/Datagma/etc, async via webhook)
    const matchBody: Record<string, unknown> = {
      reveal_personal_emails: true,
      reveal_phone_number: true,
      run_waterfall_email: true,
      run_waterfall_phone: true,
    };
    if (contact.apollo_person_id) matchBody.id = contact.apollo_person_id;
    else if (contact.linkedin_url) matchBody.linkedin_url = contact.linkedin_url;
    else if (contact.email) matchBody.email = contact.email;
    if (APOLLO_WEBHOOK_URL) matchBody.webhook_url = APOLLO_WEBHOOK_URL;

    const res = await fetch("https://api.apollo.io/api/v1/people/match", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify(matchBody),
    });
    const text = await res.text();
    let payload: unknown = null;
    try { payload = JSON.parse(text); } catch { payload = text; }

    if (!res.ok) {
      const message = `Apollo /people/match ${res.status}: ${typeof payload === "string" ? payload : JSON.stringify(payload)}`;
      await updateJob({ status: "failed", error_message: message, response_payload: payload as Record<string, unknown> });
      return json({ ok: false, error: message }, 502);
    }

    const person = ((payload as Record<string, unknown>)?.person ?? null) as ApolloPerson | null;

    // Atualiza tudo o que veio síncrono
    const updates: Record<string, unknown> = {
      enriched_at: new Date().toISOString(),
      enrichment_source: "apollo",
    };
    let phone: string | null = null;
    let phoneSource: string | null = null;
    let phoneDebug: Record<string, unknown> = {};
    let email: string | null = null;
    if (person) {
      const picked = pickPhone(person);
      phone = picked.phone;
      phoneSource = picked.source;
      phoneDebug = picked.debug;
      email = pickEmail(person);
      if (phone) { updates.phone = phone; updates.whatsapp = phone; }
      if (email) updates.email = email;
      if (person.linkedin_url) updates.linkedin_url = person.linkedin_url;
    }

    await admin.from("contacts").update(updates).eq("id", contact.id);

    // Log debug detalhado — guarda o person cru pra diagnóstico
    console.info("[apollo-reveal-phone] match result", {
      contactId: contact.id,
      apolloId: person?.id,
      phone_found: !!phone,
      phone_source: phoneSource,
      email_found: !!email,
      waterfall_triggered: !phone && !!APOLLO_WEBHOOK_URL,
      phone_debug: phoneDebug,
    });

    await updateJob({
      status: "completed",
      credits_used: 1,
      response_payload: {
        phone_found: !!phone,
        phone_source: phoneSource,
        phone_debug: phoneDebug,
        email_found: !!email,
        async_waterfall: !phone && !!APOLLO_WEBHOOK_URL,
        raw_person: person,  // payload cru pra diagnóstico
      },
    });

    return json({
      ok: true,
      phone,
      email,
      waterfall_pending: !phone && !!APOLLO_WEBHOOK_URL,
      message: phone
        ? "Telefone encontrado!"
        : (APOLLO_WEBHOOK_URL
          ? "Sem número na base nativa. Apollo acionou waterfall (Datagma/etc.) — pode chegar em minutos."
          : "Sem número disponível e waterfall não está habilitado."),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await updateJob({ status: "failed", error_message: message });
    return json({ ok: false, error: message }, 500);
  }
});
