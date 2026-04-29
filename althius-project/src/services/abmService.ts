import { supabase } from "@/lib/supabase";
import { addDays, isWorkingDay, toDateKey } from "@/lib/brCalendar";
import { inferPersonaFromRole, personalizeTemplate, PIPA_21_DAY_CADENCE } from "@/lib/pipaGtm";

// ── Types ────────────────────────────────────────────────

export type BuyingSignal = "hot" | "warm" | "cold";
export type CadenceStatus =
  | "not_started"
  | "active"
  | "paused"
  | "meeting_booked"
  | "proposal_sent"
  | "won"
  | "lost";
export type PersonaType = "cmo" | "dir_comercial" | "socio" | "ceo" | "other";
export type TaskType =
  | "send_whatsapp"
  | "send_linkedin"
  | "make_call"
  | "send_email"
  | "followup";
export type Urgency = "urgent" | "today" | "normal";

export interface DailyTask {
  id: string;
  company_id: string;
  contact_id: string | null;
  cadence_track_id: string | null;
  task_type: TaskType;
  persona_type: PersonaType | null;
  cadence_day: number | null;
  block_number: number | null;
  generated_message: string | null;
  urgency: Urgency;
  due_date: string;
  status: "pending" | "done" | "skipped";
  done_at: string | null;
  created_at: string;
  company?: { name: string; buying_signal: BuyingSignal };
  contact?: { name: string; whatsapp: string | null };
}

export interface AccountSignal {
  id: string;
  company_id: string;
  signal_type: string;
  description: string | null;
  detected_at: string;
  source: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

export interface Interaction {
  id: string;
  company_id: string | null;
  contact_id: string | null;
  deal_id: string | null;
  interaction_type: string;
  content: string | null;
  summary: string | null;
  channel: string | null;
  direction: "outbound" | "inbound" | null;
  persona_type: PersonaType | null;
  cadence_day: number | null;
  created_by: string | null;
  created_at: string;
  metadata?: Record<string, unknown> | null;
  contact?: { name: string } | null;
}

export interface Phase0Result {
  id: string;
  company_id: string;
  test_date: string;
  first_response_minutes: number | null;
  followup_count: number;
  followup_days: number;
  response_quality: "excellent" | "good" | "poor" | "none" | null;
  diagnosis: string | null;
  loom_url: string | null;
  raw_notes: string | null;
  created_at: string;
}

// ── Daily Tasks ──────────────────────────────────────────

export async function getDailyTasks(date?: string): Promise<DailyTask[]> {
  const today = date || new Date().toISOString().split("T")[0];
  const { data, error } = await supabase
    .from("daily_tasks")
    .select(
      `*, company:companies(name, buying_signal), contact:contacts(name, whatsapp)`
    )
    .lte("due_date", today)
    .eq("status", "pending")
    .order("urgency", { ascending: true })
    .order("due_date", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function completeTask(id: string): Promise<void> {
  const { error } = await supabase
    .from("daily_tasks")
    .update({ status: "done", done_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function skipTask(id: string): Promise<void> {
  const { error } = await supabase
    .from("daily_tasks")
    .update({ status: "skipped" })
    .eq("id", id);
  if (error) throw error;
}

export async function createTask(
  payload: Omit<DailyTask, "id" | "created_at" | "done_at" | "company" | "contact">
): Promise<DailyTask> {
  const { data, error } = await supabase
    .from("daily_tasks")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Interactions ─────────────────────────────────────────

export async function getInteractions(
  companyId: string,
  limit = 50
): Promise<Interaction[]> {
  const { data, error } = await supabase
    .from("interactions")
    .select(`*, contact:contacts(name)`)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function logInteraction(
  payload: Omit<Interaction, "id" | "created_at" | "contact">
): Promise<Interaction> {
  const { data, error } = await supabase
    .from("interactions")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Account Signals ──────────────────────────────────────

export async function getSignals(companyId: string): Promise<AccountSignal[]> {
  const { data, error } = await supabase
    .from("account_signals")
    .select("*")
    .eq("company_id", companyId)
    .order("detected_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addSignal(
  companyId: string,
  signalType: string,
  description?: string,
  source = "manual"
): Promise<AccountSignal> {
  const { data, error } = await supabase
    .from("account_signals")
    .insert({ company_id: companyId, signal_type: signalType, description, source })
    .select()
    .single();
  if (error) throw error;

  // Recalculate score
  await supabase.rpc("recalculate_buying_signal", { p_company_id: companyId });

  return data;
}

// ── Phase 0 ──────────────────────────────────────────────

export async function savePhase0(
  payload: Omit<Phase0Result, "id" | "created_at">
): Promise<Phase0Result> {
  const { data, error } = await supabase
    .from("phase0_results")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;

  // Adicionar sinal automaticamente
  if (payload.first_response_minutes && payload.first_response_minutes > 60) {
    await addSignal(payload.company_id, "slow_response",
      `Respondeu em ${payload.first_response_minutes}min`, "phase0");
  }
  if (payload.followup_count === 0) {
    await addSignal(payload.company_id, "no_followup",
      "Nenhum follow-up em 5 dias", "phase0");
  }

  return data;
}

export async function getPhase0(companyId: string): Promise<Phase0Result | null> {
  const { data } = await supabase
    .from("phase0_results")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

// ── Cadence ──────────────────────────────────────────────

export async function startCadence(companyId: string): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  const { error } = await supabase
    .from("companies")
    .update({
      cadence_status: "active",
      cadence_day: 1,
      cadence_started_at: new Date().toISOString(),
    })
    .eq("id", companyId);
  if (error) throw error;

  // Gerar tarefas iniciais (Dia 1 — Bloco 1)
  const personas: PersonaType[] = ["cmo", "dir_comercial"];
  for (const persona of personas) {
    await supabase.from("daily_tasks").insert({
      company_id: companyId,
      task_type: "send_whatsapp",
      persona_type: persona,
      cadence_day: 1,
      block_number: 1,
      urgency: "today",
      due_date: today,
    });
    await supabase.from("daily_tasks").insert({
      company_id: companyId,
      task_type: "send_linkedin",
      persona_type: persona,
      cadence_day: 1,
      block_number: 1,
      urgency: "today",
      due_date: today,
    });
  }
}

export interface CadenceContactTarget {
  id: string;
  name: string;
  role: string | null;
}

export interface StartAccountCadencePayload {
  companyId: string;
  companyName: string;
  contacts: CadenceContactTarget[];
  startDate?: Date;
}

function nextWorkingDate(date: Date) {
  let cursor = date;
  while (!isWorkingDay(cursor)) {
    cursor = addDays(cursor, 1);
  }
  return cursor;
}

function dueDateForCadenceDay(startDate: Date, cadenceDay: number) {
  return toDateKey(nextWorkingDate(addDays(startDate, cadenceDay - 1)));
}

export async function startCadenceForContacts(payload: StartAccountCadencePayload): Promise<number> {
  if (!payload.companyId) throw new Error("Selecione uma conta.");
  if (payload.contacts.length < 2) {
    throw new Error("Selecione pelo menos 2 pessoas da conta para iniciar a sequencia.");
  }

  const startDate = payload.startDate ?? new Date();
  const contactsWithPersona = payload.contacts.map((contact) => ({
    ...contact,
    persona: inferPersonaFromRole(contact.role),
  }));

  const tasks = PIPA_21_DAY_CADENCE.flatMap((step) =>
    contactsWithPersona
      .filter((contact) => step.personas.includes(contact.persona))
      .map((contact) => ({
        company_id: payload.companyId,
        contact_id: contact.id,
        task_type: step.taskType,
        persona_type: contact.persona,
        cadence_day: step.day,
        block_number: step.block,
        generated_message: personalizeTemplate(step.message, {
          name: contact.name,
          company: payload.companyName,
        }),
        urgency: step.day === 1 ? "today" : "normal",
        due_date: dueDateForCadenceDay(startDate, step.day),
        status: "pending",
      })),
  );

  if (tasks.length === 0) {
    throw new Error("As pessoas selecionadas precisam ter cargos de marketing, comercial ou C-Level.");
  }

  await supabase
    .from("daily_tasks")
    .delete()
    .eq("company_id", payload.companyId)
    .eq("status", "pending");

  const { error: insertError } = await supabase.from("daily_tasks").insert(tasks);
  if (insertError) throw insertError;

  const { error: companyError } = await supabase
    .from("companies")
    .update({
      cadence_status: "active",
      cadence_day: 1,
      cadence_started_at: new Date().toISOString(),
    })
    .eq("id", payload.companyId);
  if (companyError) throw companyError;

  return tasks.length;
}

// ── Dashboard stats ──────────────────────────────────────

export async function getABMStats() {
  const today = new Date().toISOString().split("T")[0];
  const [pending, done, hot, active] = await Promise.all([
    supabase.from("daily_tasks").select("id", { count: "exact", head: true })
      .eq("status", "pending").lte("due_date", today),
    supabase.from("daily_tasks").select("id", { count: "exact", head: true })
      .eq("status", "done").gte("done_at", today),
    supabase.from("companies").select("id", { count: "exact", head: true })
      .eq("buying_signal", "hot"),
    supabase.from("companies").select("id", { count: "exact", head: true })
      .eq("cadence_status", "active"),
  ]);
  return {
    pendingToday: pending.count || 0,
    doneToday: done.count || 0,
    hotAccounts: hot.count || 0,
    activeCadences: active.count || 0,
  };
}
