/**
 * ALTHIUS GTM Engineering — Next Step Service
 *
 * Serviço de Lógica de Próximo Passo Nativa
 *
 * Analisa o histórico de comunicações e telemetria de sinais para gerar
 * recomendações técnicas de fechamento diretamente na interface de Propulsão.
 *
 * Não utiliza modelos externos — toda a lógica é determinística baseada em:
 *   - Histórico de interações (interactions)
 *   - Sinais de intenção (account_signals)
 *   - Estágio de cadência (cadence_tracks)
 *   - Score de propulsão (icp_score / buying_signal)
 *   - Resultado do lead oculto (phase0_results)
 */

import { supabase } from '@/lib/supabase';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type PropulsionLevel = 'critical' | 'high' | 'medium' | 'low';
export type RecommendationChannel = 'whatsapp' | 'linkedin' | 'phone' | 'email' | 'meeting';
export type ClosingTactic =
  | 'urgency_signal'
  | 'social_proof'
  | 'roi_anchor'
  | 'pain_amplification'
  | 'direct_ask'
  | 'executive_escalation'
  | 'competitor_displacement'
  | 'timing_leverage';

export interface SignalSummary {
  type: string;
  description: string | null;
  detectedAt: string;
  confidence: number;
  weight: number;
}

export interface InteractionSummary {
  type: string;
  direction: 'inbound' | 'outbound';
  channel: string | null;
  summary: string | null;
  persona: string | null;
  cadenceDay: number | null;
  createdAt: string;
}

export interface CadenceStatus {
  day: number;
  block: number;
  blockLabel: string;
  status: string;
  personasContacted: string[];
  personasPending: string[];
  lastInteractionAt: string | null;
  daysSinceLastContact: number;
}

export interface NextStepRecommendation {
  companyId: string;
  companyName: string;
  propulsionLevel: PropulsionLevel;
  score: number;
  buyingSignal: string;

  // Análise do momento
  momentAnalysis: {
    summary: string;
    urgencyReason: string | null;
    windowOpportunity: string | null;
  };

  // Recomendação principal
  primaryAction: {
    channel: RecommendationChannel;
    persona: string;
    tactic: ClosingTactic;
    message: string;
    rationale: string;
  };

  // Ações secundárias
  secondaryActions: Array<{
    channel: RecommendationChannel;
    persona: string;
    action: string;
  }>;

  // Sinais que sustentam a recomendação
  supportingSignals: SignalSummary[];

  // Histórico relevante
  recentInteractions: InteractionSummary[];

  // Status da cadência
  cadenceStatus: CadenceStatus | null;

  // Alertas e riscos
  alerts: string[];

  generatedAt: string;
}

// ─── Pesos dos Sinais (espelhando o backend PostgreSQL) ───────────────────────

const SIGNAL_WEIGHTS: Record<string, number> = {
  new_launch: 30,
  running_ads: 22,
  vgv_pressure: 22,
  funding: 20,
  slow_response: 18,
  no_followup: 18,
  hiring_sales: 16,
  hiring_marketing: 14,
  competitor_change: 12,
  custom: 8,
};

// ─── Lógica de Análise ────────────────────────────────────────────────────────

function determinePropulsionLevel(score: number): PropulsionLevel {
  if (score >= 70) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

function selectClosingTactic(
  signals: SignalSummary[],
  interactions: InteractionSummary[],
  cadence: CadenceStatus | null,
): ClosingTactic {
  const signalTypes = new Set(signals.map((s) => s.type));
  const hasInboundResponse = interactions.some((i) => i.direction === 'inbound');
  const daysSinceContact = cadence?.daysSinceLastContact ?? 999;

  // Lançamento iminente → urgência de timing
  if (signalTypes.has('new_launch')) return 'timing_leverage';

  // Rodando mídia → já está gastando, ROI é argumento forte
  if (signalTypes.has('running_ads')) return 'roi_anchor';

  // Pressão de VGV → amplificar a dor
  if (signalTypes.has('vgv_pressure')) return 'pain_amplification';

  // Mudou de ferramenta → deslocar concorrente
  if (signalTypes.has('competitor_change')) return 'competitor_displacement';

  // Captou investimento → prova social de crescimento
  if (signalTypes.has('funding')) return 'social_proof';

  // Sem resposta por muito tempo → escalada executiva
  if (daysSinceContact > 7 && !hasInboundResponse) return 'executive_escalation';

  // Respondeu mas não avançou → pedido direto
  if (hasInboundResponse && cadence && cadence.block >= 2) return 'direct_ask';

  return 'urgency_signal';
}

function buildPrimaryMessage(
  companyName: string,
  tactic: ClosingTactic,
  signals: SignalSummary[],
  persona: string,
): string {
  const signalDescriptions = signals
    .slice(0, 2)
    .map((s) => s.description || s.type)
    .join(' e ');

  const messages: Record<ClosingTactic, string> = {
    timing_leverage: `Olá! Vi que a ${companyName} está com lançamento previsto. Empresas que estruturam o processo comercial antes do lançamento convertem 3x mais leads. Temos disponibilidade para implementar em 2 semanas. Quando podemos conversar?`,

    roi_anchor: `Oi! Notei que a ${companyName} está investindo em mídia paga. Nossos clientes que integram CRM com campanhas reduzem o CAC em média 40%. Vale 15 minutos para mostrar como funciona?`,

    pain_amplification: `${persona}, a pressão de VGV parado é um dos maiores drenos de receita no setor. A ${companyName} está deixando dinheiro na mesa sem um processo de reativação estruturado. Posso mostrar como resolvemos isso para empresas similares?`,

    competitor_displacement: `Vi que a ${companyName} fez uma mudança recente de ferramentas — esse é exatamente o momento certo para avaliar o stack comercial completo. Posso mostrar o que estamos fazendo diferente?`,

    social_proof: `Parabéns pelo crescimento da ${companyName}! Empresas em fase de expansão que estruturam o GTM nesse momento crescem 2x mais rápido. Temos cases de empresas no mesmo estágio que vocês. Podemos conversar?`,

    executive_escalation: `${persona}, tentei contato algumas vezes mas não consegui avançar. Dado o que identificamos sobre a ${companyName} (${signalDescriptions}), acredito que vale uma conversa direta com você. 15 minutos esta semana?`,

    direct_ask: `${persona}, já conversamos antes e você demonstrou interesse. Dado o momento atual da ${companyName}, qual é o próximo passo para avançarmos? Posso preparar uma proposta específica para vocês.`,

    urgency_signal: `${persona}, identificamos alguns sinais importantes sobre o momento da ${companyName}: ${signalDescriptions}. Isso indica que agora é o momento ideal para estruturar o processo comercial. Podemos conversar?`,
  };

  return messages[tactic];
}

function selectBestChannel(
  signals: SignalSummary[],
  interactions: InteractionSummary[],
  cadence: CadenceStatus | null,
): RecommendationChannel {
  // Se já houve resposta por WhatsApp, continuar por lá
  const whatsappInteractions = interactions.filter(
    (i) => i.channel === 'whatsapp' && i.direction === 'inbound',
  );
  if (whatsappInteractions.length > 0) return 'whatsapp';

  // Bloco 3 (fechamento) → ligação direta
  if (cadence && cadence.block === 3) return 'phone';

  // Bloco 2 (escalada) → LinkedIn para decisores
  if (cadence && cadence.block === 2) return 'linkedin';

  // Padrão: WhatsApp para primeiro contato
  return 'whatsapp';
}

function selectBestPersona(
  interactions: InteractionSummary[],
  cadence: CadenceStatus | null,
): string {
  // Se já houve resposta de alguém, priorizar essa persona
  const respondent = interactions.find((i) => i.direction === 'inbound' && i.persona);
  if (respondent?.persona) return respondent.persona;

  // Se há personas pendentes na cadência, priorizar
  if (cadence?.personasPending && cadence.personasPending.length > 0) {
    return cadence.personasPending[0];
  }

  // Padrão: CMO (mais receptivo a soluções de GTM)
  return 'CMO / Dir. Marketing';
}

// ─── Função Principal ─────────────────────────────────────────────────────────

/**
 * Gera a recomendação de Próximo Passo para uma empresa específica,
 * analisando todo o histórico disponível.
 */
export async function generateNextStep(
  companyId: string,
): Promise<NextStepRecommendation> {
  // 1. Buscar dados da empresa
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id, name, buying_signal, icp_score, cadence_status, cadence_day, last_interaction_at')
    .eq('id', companyId)
    .single();

  if (companyError || !company) {
    throw new Error('Empresa não encontrada');
  }

  // 2. Buscar sinais de intenção (últimos 30 dias)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: rawSignals } = await supabase
    .from('account_signals')
    .select('signal_type, description, detected_at, confidence, source')
    .eq('company_id', companyId)
    .gte('detected_at', thirtyDaysAgo.toISOString())
    .order('detected_at', { ascending: false });

  const signals: SignalSummary[] = (rawSignals ?? []).map((s) => ({
    type: s.signal_type,
    description: s.description,
    detectedAt: s.detected_at,
    confidence: s.confidence ?? 0.85,
    weight: SIGNAL_WEIGHTS[s.signal_type] ?? 8,
  }));

  // 3. Buscar histórico de interações (últimas 20)
  const { data: rawInteractions } = await supabase
    .from('interactions')
    .select('interaction_type, direction, channel, summary, persona_type, cadence_day, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(20);

  const interactions: InteractionSummary[] = (rawInteractions ?? []).map((i) => ({
    type: i.interaction_type,
    direction: i.direction as 'inbound' | 'outbound',
    channel: i.channel,
    summary: i.summary,
    persona: i.persona_type,
    cadenceDay: i.cadence_day,
    createdAt: i.created_at,
  }));

  // 4. Buscar status da cadência
  const { data: cadenceTracks } = await supabase
    .from('cadence_tracks')
    .select('persona_type, status, block_number, cadence_day, completed_at')
    .eq('company_id', companyId)
    .order('cadence_day', { ascending: false });

  let cadenceStatus: CadenceStatus | null = null;

  if (company.cadence_day && company.cadence_day > 0) {
    const currentBlock = company.cadence_day <= 7 ? 1 : company.cadence_day <= 14 ? 2 : 3;
    const blockLabels = { 1: 'Bloco 1 — Cerco', 2: 'Bloco 2 — Escalada', 3: 'Bloco 3 — Fechamento' };

    const contactedPersonas = (cadenceTracks ?? [])
      .filter((t) => t.status === 'done' || t.status === 'replied')
      .map((t) => t.persona_type)
      .filter((v, i, a) => a.indexOf(v) === i);

    const allPersonas = ['cmo', 'dir_comercial', 'socio'];
    const pendingPersonas = allPersonas.filter((p) => !contactedPersonas.includes(p));

    const lastInteraction = interactions[0]?.createdAt ?? company.last_interaction_at;
    const daysSince = lastInteraction
      ? Math.floor((Date.now() - new Date(lastInteraction).getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    cadenceStatus = {
      day: company.cadence_day,
      block: currentBlock,
      blockLabel: blockLabels[currentBlock as keyof typeof blockLabels],
      status: company.cadence_status ?? 'not_started',
      personasContacted: contactedPersonas,
      personasPending: pendingPersonas,
      lastInteractionAt: lastInteraction,
      daysSinceLastContact: daysSince,
    };
  }

  // 5. Buscar resultado do lead oculto (Phase 0)
  const { data: phase0 } = await supabase
    .from('phase0_results')
    .select('response_quality, first_response_minutes, followup_count, diagnosis')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // 6. Calcular nível de propulsão
  const score = company.icp_score ?? 0;
  const propulsionLevel = determinePropulsionLevel(score);

  // 7. Selecionar tática e canal
  const tactic = selectClosingTactic(signals, interactions, cadenceStatus);
  const channel = selectBestChannel(signals, interactions, cadenceStatus);
  const persona = selectBestPersona(interactions, cadenceStatus);

  // 8. Construir mensagem
  const message = buildPrimaryMessage(company.name, tactic, signals, persona);

  // 9. Montar análise do momento
  const topSignal = signals[0];
  const urgencyReason = topSignal
    ? `Sinal detectado: ${topSignal.description || topSignal.type} (confiança: ${Math.round(topSignal.confidence * 100)}%)`
    : null;

  const windowOpportunity = (() => {
    const signalTypes = new Set(signals.map((s) => s.type));
    if (signalTypes.has('new_launch')) return 'Janela de oportunidade: pré-lançamento (alta urgência)';
    if (signalTypes.has('funding')) return 'Janela de oportunidade: pós-captação (budget disponível)';
    if (signalTypes.has('running_ads')) return 'Janela de oportunidade: campanha ativa (custo de aquisição em foco)';
    if (cadenceStatus && cadenceStatus.daysSinceLastContact > 14) return 'Alerta: mais de 14 dias sem contato';
    return null;
  })();

  const momentSummary = (() => {
    const signalCount = signals.length;
    const hasResponse = interactions.some((i) => i.direction === 'inbound');
    const parts: string[] = [];

    if (signalCount > 0) parts.push(`${signalCount} sinal(is) de intenção detectado(s)`);
    if (hasResponse) parts.push('empresa já respondeu anteriormente');
    if (cadenceStatus) parts.push(`cadência no Dia ${cadenceStatus.day}/21 (${cadenceStatus.blockLabel})`);
    if (phase0?.response_quality === 'poor' || phase0?.response_quality === 'none') {
      parts.push('processo comercial interno fraco (lead oculto)');
    }

    return parts.length > 0
      ? `Empresa com ${parts.join(', ')}.`
      : 'Empresa monitorada sem sinais recentes.';
  })();

  // 10. Ações secundárias
  const secondaryActions = [];

  if (channel !== 'linkedin' && cadenceStatus && cadenceStatus.personasPending.includes('socio')) {
    secondaryActions.push({
      channel: 'linkedin' as RecommendationChannel,
      persona: 'Sócio / CEO',
      action: 'Conectar no LinkedIn com mensagem de contexto sobre o momento da empresa',
    });
  }

  if (cadenceStatus && cadenceStatus.block === 3) {
    secondaryActions.push({
      channel: 'email' as RecommendationChannel,
      persona: persona,
      action: 'Enviar proposta formal por email com prazo de validade de 48h',
    });
  }

  if (signals.some((s) => s.type === 'new_launch')) {
    secondaryActions.push({
      channel: 'phone' as RecommendationChannel,
      persona: 'Dir. Comercial',
      action: 'Ligar para discutir cronograma de implementação antes do lançamento',
    });
  }

  // 11. Alertas
  const alerts: string[] = [];

  if (cadenceStatus && cadenceStatus.daysSinceLastContact > 7) {
    alerts.push(`⚠️ ${cadenceStatus.daysSinceLastContact} dias sem contato — risco de esfriamento`);
  }

  if (propulsionLevel === 'critical' && (!cadenceStatus || cadenceStatus.status === 'not_started')) {
    alerts.push('🚨 Empresa com score crítico sem cadência iniciada — iniciar imediatamente');
  }

  if (signals.some((s) => s.type === 'competitor_change')) {
    alerts.push('🔄 Empresa mudou de ferramenta recentemente — janela de deslocamento de concorrente');
  }

  const { count: pendingEnrichment } = await supabase
    .from('auto_enrichment_queue')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('status', 'pending');

  if ((pendingEnrichment ?? 0) > 0) {
    alerts.push('⏳ Enriquecimento de decisores em fila — aguardando Apollo');
  }

  return {
    companyId,
    companyName: company.name,
    propulsionLevel,
    score,
    buyingSignal: company.buying_signal ?? 'cold',
    momentAnalysis: {
      summary: momentSummary,
      urgencyReason,
      windowOpportunity,
    },
    primaryAction: {
      channel,
      persona,
      tactic,
      message,
      rationale: `Tática "${tactic}" selecionada com base em ${signals.length} sinais e ${interactions.length} interações históricas`,
    },
    secondaryActions,
    supportingSignals: signals.slice(0, 5),
    recentInteractions: interactions.slice(0, 5),
    cadenceStatus,
    alerts,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Gera recomendações de Próximo Passo para todas as empresas HOT,
 * ordenadas por score decrescente.
 */
export async function generateNextStepsForHotCompanies(): Promise<NextStepRecommendation[]> {
  const { data: hotCompanies, error } = await supabase
    .from('companies')
    .select('id')
    .eq('buying_signal', 'hot')
    .order('icp_score', { ascending: false })
    .limit(10);

  if (error) throw error;
  if (!hotCompanies || hotCompanies.length === 0) return [];

  const recommendations = await Promise.allSettled(
    hotCompanies.map((c) => generateNextStep(c.id)),
  );

  return recommendations
    .filter((r): r is PromiseFulfilledResult<NextStepRecommendation> => r.status === 'fulfilled')
    .map((r) => r.value)
    .sort((a, b) => b.score - a.score);
}

/**
 * Registra que uma recomendação foi executada (para aprendizado futuro).
 */
export async function markNextStepExecuted(
  companyId: string,
  channel: RecommendationChannel,
  persona: string,
  notes?: string,
): Promise<void> {
  await supabase.from('interactions').insert({
    company_id: companyId,
    interaction_type: channel === 'whatsapp' ? 'whatsapp_sent' : channel === 'phone' ? 'call_made' : 'linkedin_sent',
    content: notes ?? `Próximo passo executado via ${channel} para ${persona}`,
    direction: 'outbound',
    channel,
    metadata: {
      automated_recommendation: true,
      channel,
      persona,
    },
  });
}
