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

const APOLLO_BASE = "https://api.apollo.io/api/v1";

// BUCKET A — Decisores (Owner / C-Level / VP / Director / Head)
const DECISION_MAKER_TITLES = [
  "Owner", "Founder", "Co-Founder", "Co Founder", "Cofounder",
  "President", "Partner", "Managing Partner", "Shareholder",
  "CEO", "Chief Executive Officer",
  "COO", "Chief Operating Officer",
  "CRO", "Chief Revenue Officer",
  "CCO", "Chief Commercial Officer",
  "CMO", "Chief Marketing Officer",
  "VP Sales", "VP of Sales", "Vice President Sales",
  "VP Revenue", "VP of Revenue",
  "VP Commercial", "VP of Commercial",
  "Director of Sales", "Sales Director",
  "Commercial Director", "Director of Commercial",
  "Head of Sales", "Head of Commercial", "Head of Revenue",
  // PT-BR
  "Sócio", "Dono", "Proprietário", "Presidente",
  "Diretor Comercial", "Diretor de Vendas", "Diretor de Novos Negócios",
];
const DECISION_SENIORITIES = ["owner", "founder", "c_suite", "vp", "director", "head"];

// BUCKET B — Vendedores sênior (Manager / IC Sênior)
const SALES_TITLES = [
  "Sales Manager", "Commercial Manager", "Business Development Manager",
  "Account Executive", "Senior Account Executive",
  "Account Manager", "Senior Account Manager",
  "Inside Sales Manager", "Outside Sales Manager",
  "Sales Team Lead",
  // PT-BR
  "Gerente Comercial", "Gerente de Vendas",
  "Executivo de Contas", "Executivo de Contas Sênior",
  "Consultor de Vendas Sênior", "Coordenador de Vendas",
];
const SALES_SENIORITIES = ["manager", "senior"];

interface ApolloPerson {
  id: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  title?: string;
  seniority?: string;
  departments?: string[];
  linkedin_url?: string;
  email?: string;
  email_status?: string;
  personal_emails?: string[];
  phone_numbers?: Array<{ raw_number?: string; sanitized_number?: string; type?: string }>;
  mobile_phone?: string;
  organization?: { id?: string; name?: string; website_url?: string };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function extractDomain(website: string | null | undefined): string | null {
  if (!website) return null;
  try {
    const url = website.startsWith("http") ? website : `https://${website}`;
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host || null;
  } catch {
    return null;
  }
}

function pickPhone(person: ApolloPerson): string | null {
  if (person.mobile_phone) return person.mobile_phone;
  const phones = person.phone_numbers ?? [];
  const mobile = phones.find((p) => (p.type ?? "").toLowerCase().includes("mobile"));
  return (mobile?.sanitized_number || mobile?.raw_number || phones[0]?.sanitized_number || phones[0]?.raw_number) ?? null;
}

function pickEmail(person: ApolloPerson): string | null {
  if (person.email && person.email_status !== "unavailable" && !person.email.includes("email_not_unlocked")) {
    return person.email;
  }
  return person.personal_emails?.[0] ?? null;
}

async function apolloFetch(path: string, apiKey: string, body: Record<string, unknown>) {
  const res = await fetch(`${APOLLO_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let payload: unknown = null;
  try { payload = JSON.parse(text); } catch { payload = text; }
  if (!res.ok) {
    throw new Error(`Apollo ${path} ${res.status}: ${typeof payload === "string" ? payload : JSON.stringify(payload)}`);
  }
  return payload as Record<string, unknown>;
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

  let payload: { company_id?: string; max_contacts?: number; reveal_phones?: boolean } = {};
  try { payload = await req.json(); } catch { /* empty */ }

  const companyId = payload.company_id;
  const maxContacts = Math.min(Math.max(payload.max_contacts ?? 5, 1), 10);
  const revealPhones = payload.reveal_phones !== false; // default true
  // Cotas por bucket (2 decisores + resto em vendas, ajustado se maxContacts pequeno)
  const maxDecisionMakers = maxContacts >= 4 ? 2 : 1;
  const maxSales = Math.max(maxContacts - maxDecisionMakers, 1);

  if (!companyId) return json({ error: "company_id is required" }, 400);

  // 1) Load company owned by user
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: company, error: companyErr } = await admin
    .from("companies")
    .select("id, name, website, owner_id, city, state, cnpj")
    .eq("id", companyId)
    .maybeSingle();

  if (companyErr) return json({ error: companyErr.message }, 500);
  if (!company) return json({ error: "Company not found" }, 404);
  if (company.owner_id !== userId) return json({ error: "Forbidden" }, 403);

  // 2) Apollo API key
  const { data: integration } = await admin
    .from("integrations")
    .select("id, api_key_encrypted, status")
    .eq("name", "apollo")
    .eq("configured_by", userId)
    .maybeSingle();

  const apiKey = integration?.api_key_encrypted;
  if (!apiKey) return json({ error: "Apollo API key not configured. Go to Integrations > Apollo." }, 400);

  // 3) Open enrichment job (audit)
  const { data: job } = await admin
    .from("enrichment_jobs")
    .insert({
      company_id: companyId,
      owner_id: userId,
      provider: "apollo",
      stage: "search",
      status: "processing",
      request_payload: { company: company.name, website: company.website, max: maxContacts },
    })
    .select("id")
    .single();

  const jobId = job?.id;
  const updateJob = (patch: Record<string, unknown>) =>
    jobId ? admin.from("enrichment_jobs").update(patch).eq("id", jobId) : Promise.resolve();

  try {
    // 4) Search em 2 buckets para garantir mix de persona
    const domain = extractDomain(company.website);
    const orgFilter: Record<string, unknown> = domain
      ? { q_organization_domains_list: [domain] }
      : company.name
        ? { organization_names: [company.name] }
        : (() => { throw new Error("Company has no website nor name to search."); })();

    const decisionSearch = apolloFetch("/mixed_people/api_search", apiKey, {
      page: 1,
      per_page: maxDecisionMakers,
      person_titles: DECISION_MAKER_TITLES,
      person_seniorities: DECISION_SENIORITIES,
      ...orgFilter,
    });
    const salesSearch = apolloFetch("/mixed_people/api_search", apiKey, {
      page: 1,
      per_page: maxSales,
      person_titles: SALES_TITLES,
      person_seniorities: SALES_SENIORITIES,
      ...orgFilter,
    });

    const [decisionResp, salesResp] = await Promise.all([decisionSearch, salesSearch]);
    const decisionPeople = ((decisionResp.people ?? []) as ApolloPerson[]).slice(0, maxDecisionMakers);
    const salesPeople = ((salesResp.people ?? []) as ApolloPerson[]).slice(0, maxSales);

    // Dedupe por id (mesma pessoa pode cair nos dois buckets)
    const selectedMap = new Map<string, { person: ApolloPerson; bucket: "decision" | "sales" }>();
    for (const p of decisionPeople) if (p.id) selectedMap.set(p.id, { person: p, bucket: "decision" });
    for (const p of salesPeople) if (p.id && !selectedMap.has(p.id)) selectedMap.set(p.id, { person: p, bucket: "sales" });

    // Backfill: se um bucket falhou, preenche com o outro até bater maxContacts
    if (selectedMap.size < maxContacts) {
      const overflow = [...decisionPeople, ...salesPeople].filter((p) => p.id && !selectedMap.has(p.id));
      for (const p of overflow) {
        if (selectedMap.size >= maxContacts) break;
        selectedMap.set(p.id, { person: p, bucket: "decision" });
      }
    }

    const selected = [...selectedMap.values()];

    if (!selected.length) {
      await updateJob({
        stage: "search",
        status: "completed",
        response_payload: {
          decision_count: decisionPeople.length,
          sales_count: salesPeople.length,
          selected_count: 0,
        },
      });
      return json({ ok: true, company_id: companyId, created: 0, updated: 0, people: [] });
    }

    // 5) For each selected person, match + reveal (waterfall)
    const upserts: Array<Record<string, unknown>> = [];
    let creditsUsed = 0;

    const bucketCounts = { decision: 0, sales: 0 };
    for (const { person: basic, bucket } of selected) {
      bucketCounts[bucket] += 1;
      let enriched: ApolloPerson = basic;
      try {
        // reveal_*       → base nativa Apollo (síncrono)
        // run_waterfall_* → providers terceiros (Cognism/Datagma/Kaspr/LeadMagic, async via webhook)
        const matchBody: Record<string, unknown> = {
          id: basic.id,
          reveal_personal_emails: true,
          run_waterfall_email: true,
        };
        if (revealPhones) {
          matchBody.reveal_phone_number = true;
          matchBody.run_waterfall_phone = true;
          if (APOLLO_WEBHOOK_URL) matchBody.webhook_url = APOLLO_WEBHOOK_URL;
        }
        const matchResp = await apolloFetch("/people/match", apiKey, matchBody);
        const matched = (matchResp.person ?? null) as ApolloPerson | null;
        if (matched) enriched = { ...basic, ...matched };
        creditsUsed += 1;
      } catch (err) {
        console.warn("[apollo-enrich] match failed", basic.id, err);
      }

      const phone = pickPhone(enriched);
      const email = pickEmail(enriched);
      const fullName = enriched.name || [enriched.first_name, enriched.last_name].filter(Boolean).join(" ").trim();
      if (!fullName) continue;

      upserts.push({
        apollo_person_id: enriched.id,
        name: fullName,
        role: enriched.title ?? null,
        email: email,
        phone: phone,
        whatsapp: phone,
        linkedin_url: enriched.linkedin_url ?? null,
        seniority: enriched.seniority ?? null,
        departments: enriched.departments ?? null,
        company_id: companyId,
        owner_id: userId,
        source: "apollo",
        enrichment_source: "apollo",
        enriched_at: new Date().toISOString(),
      });
    }

    // 6) Upsert contacts by apollo_person_id (dedupe)
    let createdOrUpdated = 0;
    if (upserts.length) {
      const { data: upserted, error: upsertErr } = await admin
        .from("contacts")
        .upsert(upserts, { onConflict: "apollo_person_id", ignoreDuplicates: false })
        .select("id, name, role, phone, email, linkedin_url, seniority");
      if (upsertErr) throw new Error(`contacts upsert: ${upsertErr.message}`);
      createdOrUpdated = upserted?.length ?? 0;

      await updateJob({
        stage: "match",
        status: "completed",
        credits_used: creditsUsed,
        response_payload: {
          decision_count: decisionPeople.length,
          sales_count: salesPeople.length,
          selected_count: selected.length,
          bucket_breakdown: bucketCounts,
          contacts: upserted,
        },
      });

      return json({
        ok: true,
        company_id: companyId,
        created: createdOrUpdated,
        credits_used: creditsUsed,
        contacts: upserted,
      });
    }

    await updateJob({
      stage: "match",
      status: "completed",
      credits_used: creditsUsed,
      response_payload: {
        decision_count: decisionPeople.length,
        sales_count: salesPeople.length,
        selected_count: selected.length,
        bucket_breakdown: bucketCounts,
      },
    });
    return json({ ok: true, company_id: companyId, created: 0, credits_used: creditsUsed, contacts: [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[apollo-enrich-company]", message);
    await updateJob({ status: "failed", error_message: message });
    return json({ error: message }, 500);
  }
});
