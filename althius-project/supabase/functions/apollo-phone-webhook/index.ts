import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("APOLLO_WEBHOOK_SECRET") ?? "";

interface ApolloPhoneNumber {
  raw_number?: string;
  sanitized_number?: string;
  type?: string;
  status?: string;
  source?: string;
}

interface ApolloWebhookPerson {
  id?: string;
  mobile_phone?: string;
  phone_numbers?: ApolloPhoneNumber[];
  personal_numbers?: Array<string | ApolloPhoneNumber>;
  organization_phones?: string[];
  personal_emails?: string[];
  email?: string;
  linkedin_url?: string;
}

function pickPhone(p: ApolloWebhookPerson): { phone: string | null; source: string | null; debug: Record<string, unknown> } {
  const debug: Record<string, unknown> = {
    has_mobile_phone: !!p.mobile_phone,
    phone_numbers_count: p.phone_numbers?.length ?? 0,
    phone_numbers_types: (p.phone_numbers ?? []).map((n) => n.type ?? "unknown"),
    phone_numbers_sources: (p.phone_numbers ?? []).map((n) => n.source ?? "unknown"),
    has_personal_numbers: Array.isArray(p.personal_numbers) && p.personal_numbers.length > 0,
  };

  if (p.mobile_phone) return { phone: p.mobile_phone, source: "mobile_phone_field", debug };

  const phones = p.phone_numbers ?? [];
  const priorities = ["mobile", "personal_mobile", "cell", "work_mobile"];
  for (const pri of priorities) {
    const m = phones.find((n) => (n.type ?? "").toLowerCase().includes(pri));
    if (m) {
      const num = m.sanitized_number || m.raw_number;
      if (num) return { phone: num, source: `phone_numbers.${m.type}${m.source ? `(${m.source})` : ""}`, debug };
    }
  }
  for (const n of phones) {
    const num = n.sanitized_number || n.raw_number;
    if (num) return { phone: num, source: `phone_numbers.${n.type ?? "unknown"}${n.source ? `(${n.source})` : ""}`, debug };
  }
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

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Shared-secret check (Apollo não suporta headers customizados, então usamos query ?token=)
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? req.headers.get("x-webhook-secret") ?? "";
  if (!WEBHOOK_SECRET || token !== WEBHOOK_SECRET) {
    console.warn("[apollo-phone-webhook] unauthorized", { hasSecret: !!WEBHOOK_SECRET });
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  let payload: Record<string, unknown> = {};
  try { payload = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Bad JSON" }), { status: 400 });
  }

  // Apollo pode mandar em 3 formatos:
  //   a) { person: {...} }           — /people/match callback
  //   b) { people: [{...}, ...] }    — bulk enrichment callback
  //   c) {...person fields...}       — raiz direto
  const peopleArr = Array.isArray(payload.people) ? payload.people as ApolloWebhookPerson[] : [];
  const persons: ApolloWebhookPerson[] = peopleArr.length
    ? peopleArr
    : [(payload.person ?? payload) as ApolloWebhookPerson];

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const results: Array<{ apolloId: string; updated: number; phone: boolean; phone_source: string | null; email: boolean; debug: Record<string, unknown> }> = [];
  const skipped: Array<{ reason: string; apolloId?: string; debug?: Record<string, unknown> }> = [];

  for (const person of persons) {
    const apolloId = person?.id;
    if (!apolloId) {
      skipped.push({ reason: "missing_id" });
      continue;
    }

    const picked = pickPhone(person);
    const phone = picked.phone;
    const email = person.email ?? person.personal_emails?.[0] ?? null;
    const linkedin = person.linkedin_url ?? null;

    if (!phone && !email && !linkedin) {
      // Apollo retornou o registro mas sem dados novos (waterfall não achou nada)
      skipped.push({ reason: "no_new_data", apolloId, debug: picked.debug });
      continue;
    }

    const updates: Record<string, unknown> = {
      enriched_at: new Date().toISOString(),
      enrichment_source: "apollo_waterfall",
    };
    if (phone) { updates.phone = phone; updates.whatsapp = phone; }
    if (email) updates.email = email;
    if (linkedin) updates.linkedin_url = linkedin;

    const { data, error } = await admin
      .from("contacts")
      .update(updates)
      .eq("apollo_person_id", apolloId)
      .select("id, name, phone, email");

    if (error) {
      console.error("[apollo-phone-webhook] update failed", { apolloId, error: error.message });
      skipped.push({ reason: `db_error:${error.message}`, apolloId });
      continue;
    }

    results.push({ apolloId, updated: data?.length ?? 0, phone: !!phone, phone_source: picked.source, email: !!email, debug: picked.debug });
  }

  // Audit trail — sempre, com payload cru pra diagnóstico
  await admin.from("enrichment_jobs").insert({
    provider: "apollo_waterfall",
    stage: "webhook_reveal",
    status: results.length ? "completed" : "failed",
    response_payload: {
      apollo_status: payload.status,
      credits_consumed: payload.credits_consumed,
      unique_enriched_records: payload.unique_enriched_records,
      missing_records: payload.missing_records,
      results,
      skipped,
      raw_people: persons,  // payload completo pra diagnóstico
    },
  });

  console.info("[apollo-phone-webhook] processed", {
    received: persons.length,
    enriched: results.length,
    skipped: skipped.length,
    reasons: skipped.map((s) => s.reason),
    sources_found: results.map((r) => r.phone_source).filter(Boolean),
  });

  return new Response(JSON.stringify({ ok: true, enriched: results.length, skipped: skipped.length }));
});
