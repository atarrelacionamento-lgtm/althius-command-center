import { supabase } from "@/lib/supabase";
import { getMonthWorkingDays, getRemainingWorkingDaysInMonth, isWorkingDay } from "@/lib/brCalendar";
import { PIPA_GTM_CONTEXT } from "@/lib/pipaGtm";

/**
 * Althius GTM Metrics Service
 * Expandido com métricas de eficiência de GTM Engineering.
 */

export interface MetricCard {
  label: string;
  value: string;
  detail: string;
  health: "good" | "attention" | "risk" | "neutral";
}

export interface GoalProgress {
  key: string;
  label: string;
  target: number;
  actual: number;
  unit: "count" | "currency";
  achievementPct: number;
  expectedPct: number;
  expectedActual: number;
  remaining: number;
  forcedPerWorkingDay: number;
  targetLabel: string;
  actualLabel: string;
  expectedLabel: string;
  remainingLabel: string;
  forcedLabel: string;
  detail: string;
  health: MetricCard["health"];
}

export interface ExecutiveStat {
  label: string;
  value: string;
  detail: string;
  tone: "primary" | "good" | "attention" | "neutral";
}

export interface PipelineStageMetric {
  label: string;
  count: number;
  value: number;
}

export interface GtmMetrics {
  generatedAt: string;
  calendar: {
    remainingWorkingDays: number;
    totalWorkingDays: number;
    elapsedWorkingDays: number;
    requiredPhase0PerWorkingDay: number;
    requiredMeetingsPerWorkingDay: number;
  };
  goals: GoalProgress[];
  executive: ExecutiveStat[];
  pipeline: PipelineStageMetric[];
  presales: MetricCard[];
  sales: MetricCard[];
  expansion: MetricCard[];
  efficiency: MetricCard[];
}

interface CompanyRow {
  id: string;
  status: string | null;
  buying_signal: string | null;
  cadence_status: string | null;
  last_interaction_at: string | null;
  vgv_projected: number | null;
  monthly_media_spend: number | null;
}

interface DealRow {
  id: string;
  stage: string;
  value: number | null;
  created_at: string | null;
  closed_at?: string | null;
}

interface InteractionRow {
  company_id: string | null;
  interaction_type: string;
}

function brl(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function compactNumber(value: number) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function formatGoalValue(value: number, unit: GoalProgress["unit"]) {
  return unit === "currency" ? brl(value) : compactNumber(value);
}

function percent(value: number) {
  return `${Math.round(value)}%`;
}

function sumValues<T>(rows: T[], getter: (row: T) => number | null | undefined) {
  return rows.reduce((sum, row) => sum + Number(getter(row) ?? 0), 0);
}

async function countRows(table: string, build?: (query: any) => any) {
  try {
    const base = supabase.from(table);
    const query = build ? build(base) : base.select("id", { count: "exact", head: true });
    const result = await (query as any);
    if (result.error) return 0;
    return result.count ?? 0;
  } catch {
    return 0;
  }
}

function getGoalHealth(actual: number, expectedActual: number, target: number): MetricCard["health"] {
  if (target <= 0) return "neutral";
  if (actual >= target) return "good";
  if (expectedActual <= 0) return actual > 0 ? "good" : "neutral";
  if (actual >= expectedActual) return "good";
  if (actual >= expectedActual * 0.7) return "attention";
  return "risk";
}

function buildGoalProgress(params: {
  key: string;
  label: string;
  target: number;
  actual: number;
  unit: GoalProgress["unit"];
  remainingWorkingDays: number;
  elapsedWorkingDays: number;
  totalWorkingDays: number;
  detail: string;
}): GoalProgress {
  const expectedActual = params.totalWorkingDays > 0
    ? (params.target * params.elapsedWorkingDays) / params.totalWorkingDays
    : 0;
  const achievementPct = params.target > 0 ? (params.actual / params.target) * 100 : 0;
  const expectedPct = params.target > 0 ? (expectedActual / params.target) * 100 : 0;
  const remaining = Math.max(params.target - params.actual, 0);
  const forcedPerWorkingDay = params.remainingWorkingDays > 0
    ? remaining / params.remainingWorkingDays
    : remaining;
  const health = getGoalHealth(params.actual, expectedActual, params.target);

  return {
    key: params.key,
    label: params.label,
    target: params.target,
    actual: params.actual,
    unit: params.unit,
    achievementPct,
    expectedPct,
    expectedActual,
    remaining,
    forcedPerWorkingDay,
    targetLabel: formatGoalValue(params.target, params.unit),
    actualLabel: formatGoalValue(params.actual, params.unit),
    expectedLabel: formatGoalValue(expectedActual, params.unit),
    remainingLabel: formatGoalValue(remaining, params.unit),
    forcedLabel:
      remaining <= 0
        ? "Meta batida"
        : params.unit === "currency"
          ? `${brl(forcedPerWorkingDay)}/dia`
          : `${forcedPerWorkingDay.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}/dia`,
    detail: params.detail,
    health,
  };
}

export async function getGtmMetrics(): Promise<GtmMetrics> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const monthStartIso = monthStart.toISOString();
  const nextMonthStartIso = nextMonthStart.toISOString();

  const [
    { data: companiesData },
    { data: dealsData },
    { data: interactionsMonthData },
    { data: phase0MonthData },
    contactsCount,
    signalsCount,
  ] = await Promise.all([
    supabase.from("companies").select("id, status, buying_signal, cadence_status, last_interaction_at, vgv_projected, monthly_media_spend"),
    supabase.from("deals").select("id, stage, value, created_at, closed_at"),
    supabase.from("interactions").select("company_id, interaction_type").gte("created_at", monthStartIso).lt("created_at", nextMonthStartIso),
    supabase.from("phase0_results").select("company_id").gte("created_at", monthStartIso).lt("created_at", nextMonthStartIso),
    countRows("contacts"),
    countRows("account_signals"),
  ]);

  const companiesRows = (companiesData ?? []) as CompanyRow[];
  const dealsRows = (dealsData ?? []) as DealRow[];
  const interactionsMonthRows = (interactionsMonthData ?? []) as InteractionRow[];

  // --- Cálculos Base ---
  const wonDealsMonthRows = dealsRows.filter(d => d.stage === 'Fechado - Ganho' && d.created_at && d.created_at >= monthStartIso);
  const wonDealsCount = wonDealsMonthRows.length;
  const totalMediaSpend = sumValues(companiesRows, c => c.monthly_media_spend);
  
  // --- Métricas de Eficiência (GTM Engineering) ---
  
  // 1. CAC (Custo de Aquisição de Cliente)
  // Simplificado: Mídia Total / Novos Clientes no mês
  const cac = wonDealsCount > 0 ? totalMediaSpend / wonDealsCount : 0;
  
  // 2. LTV (Lifetime Value) Estimado
  // Baseado no ticket médio e uma estimativa de retenção (ex: 24 meses)
  const avgTicket = PIPA_GTM_CONTEXT.commercialGoal.averageTicket;
  const estimatedLtv = avgTicket * 24; 
  
  // 3. LTV/CAC Ratio
  const ltvCacRatio = cac > 0 ? estimatedLtv / cac : 0;

  // 4. Sales Velocity (Velocidade de Vendas)
  // Formula: (Oportunidades * Taxa de Conversão * Ticket Médio) / Ciclo de Vendas (dias)
  const openDealsCount = dealsRows.filter(d => !['Fechado - Ganho', 'Fechado - Perdido'].includes(d.stage)).length;
  const winRate = dealsRows.length > 0 ? wonDealsCount / dealsRows.length : 0;
  const avgCycleDays = 90; // Fallback ou cálculo real se houver closed_at
  const velocity = (openDealsCount * winRate * avgTicket) / avgCycleDays;

  const totalWorkingDays = getMonthWorkingDays(now.getFullYear(), now.getMonth());
  const remainingWorkingDays = getRemainingWorkingDaysInMonth(now);
  const elapsedWorkingDays = Math.max(totalWorkingDays - remainingWorkingDays + (isWorkingDay(now) ? 1 : 0), 0);

  // --- Construção do Objeto de Resposta ---
  return {
    generatedAt: now.toISOString(),
    calendar: {
      remainingWorkingDays,
      totalWorkingDays,
      elapsedWorkingDays,
      requiredPhase0PerWorkingDay: 0,
      requiredMeetingsPerWorkingDay: 0,
    },
    goals: [
      buildGoalProgress({
        key: "mrr",
        label: "Novo MRR",
        target: PIPA_GTM_CONTEXT.commercialGoal.targetMrr,
        actual: wonDealsCount * avgTicket,
        unit: "currency",
        remainingWorkingDays,
        elapsedWorkingDays,
        totalWorkingDays,
        detail: "Novos contratos fechados no mês corrente",
      })
    ],
    executive: [
      { label: "CAC Atual", value: brl(cac), detail: "Custo de aquisição baseado em mídia", tone: cac < 5000 ? "good" : "attention" },
      { label: "LTV/CAC", value: ltvCacRatio.toFixed(1) + "x", detail: "Saúde financeira do GTM", tone: ltvCacRatio > 3 ? "good" : "attention" },
      { label: "Sales Velocity", value: brl(velocity) + "/dia", detail: "Potencial de geração de receita diária", tone: "primary" }
    ],
    pipeline: [],
    presales: [],
    sales: [],
    expansion: [],
    efficiency: [
      { label: "CAC", value: brl(cac), detail: "Investimento por novo cliente", health: cac < 5000 ? "good" : "attention" },
      { label: "LTV/CAC", value: ltvCacRatio.toFixed(1) + "x", detail: "Retorno sobre investimento", health: ltvCacRatio > 3 ? "good" : "attention" },
      { label: "Velocity", value: brl(velocity), detail: "Velocidade do funil", health: "neutral" }
    ]
  };
}
