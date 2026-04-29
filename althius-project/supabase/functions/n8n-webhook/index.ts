import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const AUTOMATION_WEBHOOK_SECRET = Deno.env.get("AUTOMATION_WEBHOOK_SECRET") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

const SIGNAL_TYPES = new Set([
  "new_launch",
  "hiring_sales",
  "hiring_marketing",
  "running_ads",
  "slow_response",
  "no_followup",
  "vgv_pressure",
  "competitor_change",
  "funding",
  "custom",
] as const);

type AutomationEventKind = "whatsapp_message" | "market_signal";
type MessageDirection = "inbound" | "outbound";

interface IntegrationRecord {
  id: string;
  name: string;
  configured_by: string | null;
}

interface ContactRecord {
  id: string;
  company_id: string | null;
  owner_id: string;
  name: string;
  role: string | null;
  whatsapp: string | null;
  email: string | null;
}

interface CompanyRecord {
  id: string;
  name: string;
  owner_id: string;
  status: string | null;
  cadence_status: string | null;
}

interface BasePayload {
  kind: AutomationEventKind;
  source?: string;
  integration_id?: string;
  integration_name?: string;
  external_event_id?: string;
  timestamp?: string;
  company_id?: string;
  contact_id?: string;
  deal_id?: string;
  company?: {
    name?: string;
    domain?: string;
    cnpj?: string;
  };
  company_updates?: Record<string, unknown>;
  allow_create_company?: boolean;
}

interface WhatsAppPayload extends BasePayload {
  kind: "whatsapp_message";
  whatsapp: {
    direction: MessageDirection;
    phone?: string;
    message: string;
    provider?: string;
    contact_name?: string;
    contact_role?: string;
    contact_email?: string;
    persona_type?: string;
    cadence_day?: number;
    summary?: string;
    next_step?: string;
    status?: string;
    meeting_booked?: boolean;
    create_followup_task?: boolean;
    signal_hints?: string[];
  };
  contact_updates?: Record<string, unknown>;
}

interface MarketSignalPayload extends BasePayload {
  kind: "market_signal";
  market_signal: {
    type: string;
    description?: string;
    source?: string;
    confidence?: number;
    create_followup_task?: boolean;
    metadata?: Record<string, unknown>;
  };
}

type AutomationPayload = WhatsAppPayload | MarketSignalPayload;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function toIsoDate(value?: string) {
  const parsed = value ? new Date(value) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function toDateKey(value?: string) {
  return toIsoDate(value).slice(0, 10);
}

function compactObject<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;
}

function isKnownSignalType(value: string): value is (typeof SIGNAL_TYPES extends Set<infer T> ? T : string) {
  return SIGNAL_TYPES.has(value as never);
}

function deriveInteractionSummary(payload: WhatsAppPayload) {
  if (payload.whatsapp.summary?.trim()) {
    return payload.whatsapp.summary.trim();
  }

  const directionLabel = payload.whatsapp.direction === "inbound" ? "respondeu" : "recebeu contato";
  const message = payload.whatsapp.message.trim();
  if (!message) {
    return `Contato ${directionLabel} no WhatsApp.`;
  }

  const trimmed = message.length > 180 ? `${message.slice(0, 177)}...` : message;
  return payload.whatsapp.direction === "inbound"
    ? `Lead respondeu no WhatsApp: "${trimmed}"`
    : `Mensagem outbound enviada no WhatsApp: "${trimmed}"`;
}

function inferPersonaFromRole(role?: string | null) {
  const normalized = role?.toLowerCase() ?? "";
  if (normalized.includes("marketing") || normalized.includes("cmo")) return "cmo";
  if (normalized.includes("comercial") || normalized.includes("vendas")) return "dir_comercial";
  if (normalized.includes("ceo") || normalized.includes("socio") || normalized.includes("founder")) return "socio";
  return "other";
}

async function requireWebhookSecret(req: Request) {
  if (!AUTOMATION_WEBHOOK_SECRET) return;

  const provided = req.headers.get("x-webhook-secret");
  if (provided !== AUTOMATION_WEBHOOK_SECRET) {
    throw new Error("Webhook secret inválido.");
  }
}

async function resolveIntegration(
  supabase: ReturnType<typeof createClient>,
  req: Request,
  payload: AutomationPayload,
): Promise<IntegrationRecord | null> {
  const pathname = new URL(req.url).pathname.split("/").filter(Boolean);
  const pathIntegrationId = pathname[pathname.length - 1] !== "n8n-webhook"
    ? pathname[pathname.length - 1]
    : null;
  const requestedId = payload.integration_id || pathIntegrationId;

  if (requestedId) {
    const { data, error } = await supabase
      .from("integrations")
      .select("id, name, configured_by")
      .eq("id", requestedId)
      .maybeSingle();

    if (error) throw error;
    if (data) return data as IntegrationRecord;
  }

  const fallbackName = payload.integration_name || (payload.kind === "whatsapp_message" ? "whatsapp" : "n8n");
  const { data, error } = await supabase
    .from("integrations")
    .select("id, name, configured_by")
    .eq("name", fallbackName)
    .maybeSingle();

  if (error) throw error;
  return (data as IntegrationRecord | null) ?? null;
}

async function resolveFallbackOwnerId(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.id ?? null;
}

async function insertWebhookLog(
  supabase: ReturnType<typeof createClient>,
  integrationId: string | null,
  payload: AutomationPayload,
) {
  const { data, error } = await supabase
    .from("webhook_logs")
    .insert({
      webhook_id: integrationId,
      payload,
      status: "received",
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

async function updateWebhookLog(
  supabase: ReturnType<typeof createClient>,
  id: string,
  status: "processed" | "error",
) {
  const { error } = await supabase
    .from("webhook_logs")
    .update({ status })
    .eq("id", id);

  if (error) throw error;
}

async function insertAutomationEvent(
  supabase: ReturnType<typeof createClient>,
  payload: AutomationPayload,
  integrationId: string | null,
  source: string,
) {
  if (payload.external_event_id) {
    const { data, error } = await supabase
      .from("automation_events")
      .select("id, processing_status, interaction_id, signal_id, task_id")
      .eq("source", source)
      .eq("external_event_id", payload.external_event_id)
      .maybeSingle();

    if (error) throw error;
    if (data) {
      return { duplicate: true as const, event: data };
    }
  }

  const { data, error } = await supabase
    .from("automation_events")
    .insert({
      integration_id: integrationId,
      event_type: payload.kind,
      source,
      external_event_id: payload.external_event_id ?? null,
      payload,
      processing_status: "received",
    })
    .select("id")
    .single();

  if (error) throw error;
  return { duplicate: false as const, event: data };
}

async function updateAutomationEvent(
  supabase: ReturnType<typeof createClient>,
  id: string,
  updates: Record<string, unknown>,
) {
  const { error } = await supabase
    .from("automation_events")
    .update(updates)
    .eq("id", id);

  if (error) throw error;
}

async function resolveCompany(
  supabase: ReturnType<typeof createClient>,
  payload: AutomationPayload,
  contactCompanyId?: string | null,
) {
  if (payload.company_id) return payload.company_id;
  if (contactCompanyId) return contactCompanyId;

  const { data, error } = await supabase.rpc("match_company_entity", {
    p_company_name: payload.company?.name ?? null,
    p_domain: payload.company?.domain ?? null,
    p_cnpj: payload.company?.cnpj ?? null,
  });

  if (error) throw error;
  return (data as string | null) ?? null;
}

async function fetchCompany(
  supabase: ReturnType<typeof createClient>,
  companyId: string,
) {
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, owner_id, status, cadence_status")
    .eq("id", companyId)
    .single();

  if (error) throw error;
  return data as CompanyRecord;
}

async function fetchContact(
  supabase: ReturnType<typeof createClient>,
  contactId: string,
) {
  const { data, error } = await supabase
    .from("contacts")
    .select("id, company_id, owner_id, name, role, whatsapp, email")
    .eq("id", contactId)
    .single();

  if (error) throw error;
  return data as ContactRecord;
}

async function findContactByPhone(
  supabase: ReturnType<typeof createClient>,
  phone?: string,
) {
  if (!phone) return null;
  const { data, error } = await supabase.rpc("find_contact_by_whatsapp", {
    p_phone: phone,
  });

  if (error) throw error;
  const rows = (data as ContactRecord[] | null) ?? [];
  return rows[0] ?? null;
}

async function applyContactUpdates(
  supabase: ReturnType<typeof createClient>,
  contact: ContactRecord,
  updates: Record<string, unknown>,
) {
  const payload = compactObject({
    name: typeof updates.name === "string" && updates.name.trim() ? updates.name.trim() : undefined,
    role: typeof updates.role === "string" && updates.role.trim() ? updates.role.trim() : undefined,
    email: typeof updates.email === "string" && updates.email.trim() ? updates.email.trim() : undefined,
    whatsapp: typeof updates.whatsapp === "string" && updates.whatsapp.trim() ? updates.whatsapp.trim() : undefined,
    source: typeof updates.source === "string" && updates.source.trim() ? updates.source.trim() : undefined,
  });

  if (Object.keys(payload).length === 0) return;

  const { error } = await supabase
    .from("contacts")
    .update(payload)
    .eq("id", contact.id);

  if (error) throw error;
}

async function maybeCreateContact(
  supabase: ReturnType<typeof createClient>,
  payload: WhatsAppPayload,
  companyId: string | null,
  ownerId: string | null,
) {
  const phone = payload.whatsapp.phone?.trim();
  if (!companyId || !ownerId || !phone) return null;

  const { data, error } = await supabase
    .from("contacts")
    .insert({
      name: payload.whatsapp.contact_name?.trim() || `Contato ${phone.slice(-4)}`,
      role: payload.whatsapp.contact_role?.trim() || null,
      email: payload.whatsapp.contact_email?.trim() || null,
      whatsapp: phone,
      company_id: companyId,
      source: "WhatsApp",
      owner_id: ownerId,
    })
    .select("id, company_id, owner_id, name, role, whatsapp, email")
    .single();

  if (error) throw error;
  return data as ContactRecord;
}

async function applyCompanyUpdates(
  supabase: ReturnType<typeof createClient>,
  companyId: string,
  updates: Record<string, unknown> | undefined,
) {
  if (!updates) return;

  const payload = compactObject({
    domain: typeof updates.domain === "string" && updates.domain.trim() ? updates.domain.trim() : undefined,
    website: typeof updates.website === "string" && updates.website.trim() ? updates.website.trim() : undefined,
    linkedin_url:
      typeof updates.linkedin_url === "string" && updates.linkedin_url.trim()
        ? updates.linkedin_url.trim()
        : undefined,
    instagram_url:
      typeof updates.instagram_url === "string" && updates.instagram_url.trim()
        ? updates.instagram_url.trim()
        : undefined,
    employees_count:
      typeof updates.employees_count === "string" && updates.employees_count.trim()
        ? updates.employees_count.trim()
        : undefined,
    monthly_media_spend:
      typeof updates.monthly_media_spend === "number" ? updates.monthly_media_spend : undefined,
    sales_model: typeof updates.sales_model === "string" ? updates.sales_model : undefined,
    has_active_launch:
      typeof updates.has_active_launch === "boolean" ? updates.has_active_launch : undefined,
    upcoming_launch:
      typeof updates.upcoming_launch === "boolean" ? updates.upcoming_launch : undefined,
    launch_count_year:
      typeof updates.launch_count_year === "number" ? updates.launch_count_year : undefined,
    vgv_projected:
      typeof updates.vgv_projected === "number" ? updates.vgv_projected : undefined,
    status: typeof updates.status === "string" ? updates.status : undefined,
  });

  if (Object.keys(payload).length === 0) return;

  const { error } = await supabase
    .from("companies")
    .update(payload)
    .eq("id", companyId);

  if (error) throw error;
}

async function createCompanyFromPayload(
  supabase: ReturnType<typeof createClient>,
  payload: AutomationPayload,
  ownerId: string | null,
) {
  if (!payload.allow_create_company || !ownerId || !payload.company?.name?.trim()) {
    return null;
  }

  const { data, error } = await supabase
    .from("companies")
    .insert({
      name: payload.company.name.trim(),
      cnpj: payload.company.cnpj ?? null,
      website: payload.company.domain ?? null,
      domain: payload.company.domain ?? null,
      owner_id: ownerId,
      status: "new",
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

async function completePendingWhatsAppTask(
  supabase: ReturnType<typeof createClient>,
  companyId: string,
  contactId: string | null,
  completedAt: string,
) {
  let query = supabase
    .from("daily_tasks")
    .select("id, cadence_day, block_number")
    .eq("company_id", companyId)
    .eq("status", "pending")
    .in("task_type", ["send_whatsapp", "followup"])
    .order("due_date", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1);

  query = contactId
    ? query.or(`contact_id.eq.${contactId},contact_id.is.null`)
    : query.is("contact_id", null);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { error: updateError } = await supabase
    .from("daily_tasks")
    .update({ status: "done", done_at: completedAt })
    .eq("id", data.id);

  if (updateError) throw updateError;
  return data;
}

async function createFollowupTaskIfNeeded(
  supabase: ReturnType<typeof createClient>,
  params: {
    companyId: string;
    contactId: string | null;
    personaType: string;
    message: string;
    dueDate: string;
    urgency: "urgent" | "today" | "normal";
  },
) {
  let query = supabase
    .from("daily_tasks")
    .select("id")
    .eq("company_id", params.companyId)
    .eq("task_type", "followup")
    .eq("status", "pending")
    .eq("due_date", params.dueDate)
    .limit(1);

  query = params.contactId
    ? query.or(`contact_id.eq.${params.contactId},contact_id.is.null`)
    : query.is("contact_id", null);

  const { data: existing, error: existingError } = await query.maybeSingle();
  if (existingError) throw existingError;
  if (existing) return existing.id as string;

  const { data, error } = await supabase
    .from("daily_tasks")
    .insert({
      company_id: params.companyId,
      contact_id: params.contactId,
      task_type: "followup",
      persona_type: params.personaType,
      generated_message: params.message,
      urgency: params.urgency,
      due_date: params.dueDate,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

async function createSignal(
  supabase: ReturnType<typeof createClient>,
  params: {
    companyId: string;
    signalType: string;
    description: string;
    source: string;
    confidence?: number;
    metadata?: Record<string, unknown>;
    createdBy?: string | null;
  },
) {
  if (!isKnownSignalType(params.signalType)) {
    return null;
  }

  const { data, error } = await supabase
    .from("account_signals")
    .insert({
      company_id: params.companyId,
      signal_type: params.signalType,
      description: params.description,
      source: params.source,
      confidence: params.confidence ?? 0.85,
      metadata: params.metadata ?? {},
      created_by: params.createdBy ?? null,
    })
    .select("id")
    .single();

  if (error) throw error;
  await supabase.rpc("recalculate_buying_signal", { p_company_id: params.companyId });
  return data.id as string;
}

async function processWhatsAppEvent(
  supabase: ReturnType<typeof createClient>,
  payload: WhatsAppPayload,
  integration: IntegrationRecord | null,
) {
  const source = payload.source || payload.whatsapp.provider || integration?.name || "whatsapp";
  const fallbackOwnerId = integration?.configured_by ?? await resolveFallbackOwnerId(supabase);
  const occurredAt = toIsoDate(payload.timestamp);
  const dueDate = toDateKey(payload.timestamp);

  let contact = payload.contact_id ? await fetchContact(supabase, payload.contact_id) : await findContactByPhone(supabase, payload.whatsapp.phone);
  let companyId = await resolveCompany(supabase, payload, contact?.company_id);

  if (!companyId) {
    companyId = await createCompanyFromPayload(supabase, payload, fallbackOwnerId);
  }

  if (!contact) {
    contact = await maybeCreateContact(supabase, payload, companyId, fallbackOwnerId);
  }

  if (contact && (payload.contact_updates || payload.whatsapp.contact_name || payload.whatsapp.contact_role || payload.whatsapp.contact_email)) {
    await applyContactUpdates(supabase, contact, compactObject({
      ...(payload.contact_updates ?? {}),
      name: payload.whatsapp.contact_name,
      role: payload.whatsapp.contact_role,
      email: payload.whatsapp.contact_email,
      whatsapp: payload.whatsapp.phone,
      source: "WhatsApp",
    }));
    contact = await fetchContact(supabase, contact.id);
  }

  if (!companyId && contact?.company_id) {
    companyId = contact.company_id;
  }

  if (!companyId) {
    throw new Error("Nao foi possivel vincular a mensagem a uma conta.");
  }

  await applyCompanyUpdates(supabase, companyId, payload.company_updates);

  const company = await fetchCompany(supabase, companyId);
  const personaType = payload.whatsapp.persona_type
    || inferPersonaFromRole(contact?.role || payload.whatsapp.contact_role);

  const completedTask = payload.whatsapp.direction === "outbound"
    && payload.whatsapp.status !== "failed"
      ? await completePendingWhatsAppTask(supabase, companyId, contact?.id ?? null, occurredAt)
      : null;

  const companyStatus = payload.whatsapp.meeting_booked
    ? "meeting_booked"
    : company.status === "new"
      ? "contacted"
      : company.status;
  const cadenceStatus = payload.whatsapp.meeting_booked
    ? "meeting_booked"
    : payload.whatsapp.direction === "inbound" && company.cadence_status === "active"
      ? "paused"
      : company.cadence_status;

  const interactionPayload = compactObject({
    company_id: companyId,
    contact_id: contact?.id ?? null,
    deal_id: payload.deal_id ?? null,
    interaction_type: payload.whatsapp.direction === "inbound" ? "whatsapp_received" : "whatsapp_sent",
    content: payload.whatsapp.message,
    summary: deriveInteractionSummary(payload),
    channel: "whatsapp",
    direction: payload.whatsapp.direction,
    persona_type: personaType,
    cadence_day: payload.whatsapp.cadence_day ?? completedTask?.cadence_day ?? null,
    created_by: integration?.configured_by ?? null,
    metadata: {
      external_event_id: payload.external_event_id ?? null,
      provider: payload.whatsapp.provider ?? integration?.name ?? "whatsapp",
      message_status: payload.whatsapp.status ?? null,
      next_step: payload.whatsapp.next_step ?? null,
      auto_created_contact: !payload.contact_id && Boolean(contact?.id),
      task_completed_id: completedTask?.id ?? null,
    },
  });

  const { data: interaction, error: interactionError } = await supabase
    .from("interactions")
    .insert(interactionPayload)
    .select("id")
    .single();

  if (interactionError) throw interactionError;

  const { error: companyError } = await supabase
    .from("companies")
    .update(compactObject({
      last_interaction_at: occurredAt,
      status: companyStatus,
      cadence_status: cadenceStatus,
    }))
    .eq("id", companyId);

  if (companyError) throw companyError;

  let taskId: string | null = null;
  if (payload.whatsapp.direction === "inbound" && (payload.whatsapp.create_followup_task ?? true)) {
    const nextStep = payload.whatsapp.next_step?.trim()
      || "Lead respondeu no WhatsApp. Retorne com proposta de proximo passo ainda hoje.";
    taskId = await createFollowupTaskIfNeeded(supabase, {
      companyId,
      contactId: contact?.id ?? null,
      personaType,
      message: nextStep,
      dueDate,
      urgency: payload.whatsapp.meeting_booked ? "today" : "urgent",
    });
  }

  const createdSignalIds: string[] = [];
  for (const signalType of payload.whatsapp.signal_hints ?? []) {
    const signalId = await createSignal(supabase, {
      companyId,
      signalType,
      description: payload.whatsapp.summary || payload.whatsapp.message,
      source: "whatsapp_auto",
      confidence: 0.8,
      metadata: {
        interaction_id: interaction.id,
        external_event_id: payload.external_event_id ?? null,
      },
      createdBy: integration?.configured_by ?? null,
    });
    if (signalId) createdSignalIds.push(signalId);
  }

  return {
    companyId,
    contactId: contact?.id ?? null,
    interactionId: interaction.id as string,
    taskId,
    signalIds: createdSignalIds,
    summary: interactionPayload.summary,
    source,
  };
}

async function processMarketSignalEvent(
  supabase: ReturnType<typeof createClient>,
  payload: MarketSignalPayload,
  integration: IntegrationRecord | null,
) {
  const fallbackOwnerId = integration?.configured_by ?? await resolveFallbackOwnerId(supabase);
  let companyId = await resolveCompany(supabase, payload);
  if (!companyId) {
    companyId = await createCompanyFromPayload(supabase, payload, fallbackOwnerId);
  }

  if (!companyId) {
    throw new Error("Nao foi possivel vincular o sinal a uma conta.");
  }

  await applyCompanyUpdates(supabase, companyId, payload.company_updates);
  const company = await fetchCompany(supabase, companyId);

  const signalType = isKnownSignalType(payload.market_signal.type)
    ? payload.market_signal.type
    : "custom";
  const description = payload.market_signal.description?.trim()
    || `Sinal detectado automaticamente para ${company.name}.`;
  const signalId = await createSignal(supabase, {
    companyId,
    signalType,
    description,
    source: payload.market_signal.source || payload.source || integration?.name || "market_signal",
    confidence: payload.market_signal.confidence ?? 0.85,
    metadata: payload.market_signal.metadata ?? {},
    createdBy: integration?.configured_by ?? null,
  });

  const { data: interaction, error: interactionError } = await supabase
    .from("interactions")
    .insert({
      company_id: companyId,
      interaction_type: "note",
      content: description,
      summary: `Sinal de mercado detectado: ${description}`,
      channel: "market_signal",
      direction: "inbound",
      created_by: integration?.configured_by ?? null,
      metadata: {
        signal_type: signalType,
        signal_id: signalId,
        external_event_id: payload.external_event_id ?? null,
        source: payload.market_signal.source || integration?.name || "market_signal",
      },
    })
    .select("id")
    .single();

  if (interactionError) throw interactionError;

  const { error: companyError } = await supabase
    .from("companies")
    .update(compactObject({
      status: company.status === "new" ? "prospecting" : company.status,
    }))
    .eq("id", companyId);

  if (companyError) throw companyError;

  const shouldCreateTask = payload.market_signal.create_followup_task ?? true;
  const taskId = shouldCreateTask
    ? await createFollowupTaskIfNeeded(supabase, {
      companyId,
      contactId: null,
      personaType: "other",
      message: `Sinal detectado: ${description}. Priorize pesquisa e proximo contato desta conta.`,
      dueDate: toDateKey(payload.timestamp),
      urgency: signalType === "new_launch" || signalType === "running_ads" ? "today" : "normal",
    })
    : null;

  return {
    companyId,
    contactId: null,
    interactionId: interaction.id as string,
    signalIds: signalId ? [signalId] : [],
    taskId,
    summary: description,
    source: payload.market_signal.source || integration?.name || "market_signal",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    await requireWebhookSecret(req);

    const payload = await req.json() as AutomationPayload;
    if (!payload?.kind) {
      throw new Error("Payload inválido: 'kind' é obrigatório.");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const integration = await resolveIntegration(supabase, req, payload);
    const source = payload.source || integration?.name || payload.integration_name || "automation";
    const webhookLogId = await insertWebhookLog(supabase, integration?.id ?? null, payload);
    const automationEvent = await insertAutomationEvent(
      supabase,
      payload,
      integration?.id ?? null,
      source,
    );

    if (automationEvent.duplicate) {
      await updateWebhookLog(supabase, webhookLogId, "processed");
      return jsonResponse({
        ok: true,
        duplicate: true,
        event_id: automationEvent.event.id,
      });
    }

    const eventId = automationEvent.event.id as string;
    try {
      const result = payload.kind === "whatsapp_message"
        ? await processWhatsAppEvent(supabase, payload, integration)
        : await processMarketSignalEvent(supabase, payload, integration);

      await updateAutomationEvent(supabase, eventId, {
        processing_status: "processed",
        processed_at: new Date().toISOString(),
        company_id: result.companyId,
        contact_id: result.contactId,
        interaction_id: result.interactionId,
        signal_id: result.signalIds[0] ?? null,
        task_id: result.taskId,
      });
      await updateWebhookLog(supabase, webhookLogId, "processed");

      return jsonResponse({
        ok: true,
        duplicate: false,
        event_id: eventId,
        ...result,
      });
    } catch (processingError) {
      await updateAutomationEvent(supabase, eventId, {
        processing_status: "error",
        processed_at: new Date().toISOString(),
        error_message: String(processingError),
      });
      await updateWebhookLog(supabase, webhookLogId, "error");
      throw processingError;
    }
  } catch (error) {
    console.error("n8n-webhook error", error);
    return jsonResponse({
      ok: false,
      error: String(error),
    }, 500);
  }
});
