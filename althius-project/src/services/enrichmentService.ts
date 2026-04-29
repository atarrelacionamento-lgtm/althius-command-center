/**
 * ALTHIUS GTM Engineering — Enrichment Service
 *
 * Responsabilidades:
 *   1. Enriquecimento manual de contatos (legado, via n8n)
 *   2. Enriquecimento automático de decisores por empresa (via Apollo)
 *      — Disparado automaticamente quando uma empresa detecta alta intenção
 *   3. Monitoramento da fila de enriquecimento automático
 */

import { supabase } from '@/lib/supabase';
import { enrichCompany, type EnrichCompanyResponse } from './apolloService';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type EnrichmentStatus = 'pending' | 'enriching' | 'done' | 'error';

export interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  city: string | null;
  segment: string | null;
  responsible_id: string | null;
  stage: string;
  created_at: string;
  enrichment_status?: EnrichmentStatus;
}

export interface EnrichmentLog {
  id: string;
  contact_id: string;
  status: EnrichmentStatus;
  fields_updated: Record<string, unknown> | null;
  enriched_at: string;
}

export interface AutoEnrichmentQueueItem {
  id: string;
  company_id: string;
  owner_id: string | null;
  trigger_reason: string;
  score_at_trigger: number | null;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
  error_message: string | null;
  created_at: string;
  processed_at: string | null;
  companies?: {
    name: string;
    buying_signal: string;
    icp_score: number;
  };
}

export interface AutoEnrichmentResult {
  queued: number;
  alreadyEnriched: number;
  companyIds: string[];
}

// ─── Enriquecimento Manual de Contatos (Legado via n8n) ───────────────────────

export async function fetchContacts(): Promise<Contact[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const ids = (data as Contact[]).map((c) => c.id);
  if (ids.length === 0) return data as Contact[];

  const { data: logs } = await supabase
    .from('enrichment_logs')
    .select('contact_id, status')
    .in('contact_id', ids)
    .order('enriched_at', { ascending: false });

  const latestStatus: Record<string, EnrichmentStatus> = {};
  for (const log of logs ?? []) {
    if (!latestStatus[log.contact_id]) {
      latestStatus[log.contact_id] = log.status as EnrichmentStatus;
    }
  }

  return (data as Contact[]).map((c) => ({
    ...c,
    enrichment_status: latestStatus[c.id] ?? 'pending',
  }));
}

export async function startEnrichment(contactIds: string[]): Promise<void> {
  if (contactIds.length === 0) return;

  const now = new Date().toISOString();
  const logRows = contactIds.map((id) => ({
    contact_id: id,
    status: 'enriching' as EnrichmentStatus,
    enriched_at: now,
  }));
  await supabase.from('enrichment_logs').insert(logRows);

  const { data: integration } = await supabase
    .from('integrations')
    .select('webhook_url, status')
    .eq('name', 'n8n')
    .single();

  if (!integration?.webhook_url || integration.status !== 'connected') {
    const errorRows = contactIds.map((id) => ({
      contact_id: id,
      status: 'error' as EnrichmentStatus,
      fields_updated: { error: 'n8n webhook não configurado' },
      enriched_at: new Date().toISOString(),
    }));
    await supabase.from('enrichment_logs').insert(errorRows);
    throw new Error('Integração n8n não configurada. Configure o webhook antes de enriquecer.');
  }

  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .in('id', contactIds);

  const response = await fetch(integration.webhook_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contacts }),
  });

  if (!response.ok) {
    const errorRows = contactIds.map((id) => ({
      contact_id: id,
      status: 'error' as EnrichmentStatus,
      fields_updated: { error: `n8n retornou ${response.status}` },
      enriched_at: new Date().toISOString(),
    }));
    await supabase.from('enrichment_logs').insert(errorRows);
    throw new Error(`Erro ao chamar n8n: ${response.statusText}`);
  }

  const doneRows = contactIds.map((id) => ({
    contact_id: id,
    status: 'done' as EnrichmentStatus,
    enriched_at: new Date().toISOString(),
  }));
  await supabase.from('enrichment_logs').insert(doneRows);
}

export async function fetchEnrichmentLogs(contactId: string): Promise<EnrichmentLog[]> {
  const { data, error } = await supabase
    .from('enrichment_logs')
    .select('*')
    .eq('contact_id', contactId)
    .order('enriched_at', { ascending: false });

  if (error) throw error;
  return data as EnrichmentLog[];
}

// ─── Enriquecimento Automático de Decisores por Empresa ───────────────────────

/**
 * Verifica se uma empresa precisa de enriquecimento de decisores e
 * dispara o processo Apollo automaticamente se necessário.
 *
 * Critérios para disparo automático:
 *   - Empresa com buying_signal = 'hot' OU icp_score >= 50
 *   - Menos de 2 decisores Apollo já mapeados
 *   - Nenhum job de enriquecimento pendente/em processamento
 */
export async function triggerAutoEnrichmentForCompany(
  companyId: string,
): Promise<{ triggered: boolean; reason: string; result?: EnrichCompanyResponse }> {
  // 1. Verificar o estado atual da empresa
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id, name, buying_signal, icp_score, owner_id')
    .eq('id', companyId)
    .single();

  if (companyError || !company) {
    return { triggered: false, reason: 'Empresa não encontrada' };
  }

  const isHighIntent = company.buying_signal === 'hot' || (company.icp_score ?? 0) >= 50;
  if (!isHighIntent) {
    return {
      triggered: false,
      reason: `Score insuficiente para enriquecimento automático (${company.icp_score ?? 0}/100)`,
    };
  }

  // 2. Verificar se já há decisores Apollo mapeados
  const { count: existingDecisionMakers } = await supabase
    .from('contacts')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('enrichment_source', 'apollo')
    .in('seniority', ['owner', 'founder', 'c_suite', 'vp', 'director']);

  if ((existingDecisionMakers ?? 0) >= 2) {
    return {
      triggered: false,
      reason: `Empresa já possui ${existingDecisionMakers} decisores mapeados via Apollo`,
    };
  }

  // 3. Verificar se há job pendente na fila
  const { count: pendingJobs } = await supabase
    .from('auto_enrichment_queue')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .in('status', ['pending', 'processing']);

  if ((pendingJobs ?? 0) > 0) {
    return {
      triggered: false,
      reason: 'Enriquecimento já está em fila/processamento',
    };
  }

  // 4. Disparar enriquecimento Apollo diretamente
  try {
    const result = await enrichCompany(companyId, {
      maxContacts: 5,
      revealPhones: true,
    });

    // Registrar na fila como completed para auditoria
    await supabase.from('auto_enrichment_queue').insert({
      company_id: companyId,
      trigger_reason: 'manual_high_intent_trigger',
      score_at_trigger: company.icp_score,
      status: 'completed',
      processed_at: new Date().toISOString(),
    });

    return {
      triggered: true,
      reason: `Enriquecimento automático concluído: ${result.created} decisores identificados`,
      result,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Registrar falha na fila
    await supabase.from('auto_enrichment_queue').insert({
      company_id: companyId,
      trigger_reason: 'manual_high_intent_trigger',
      score_at_trigger: company.icp_score,
      status: 'failed',
      error_message: message,
      processed_at: new Date().toISOString(),
    });

    throw new Error(`Falha no enriquecimento automático: ${message}`);
  }
}

/**
 * Detecta empresas com alta intenção sem decisores mapeados e
 * enfileira enriquecimento automático para todas elas.
 *
 * Ideal para ser chamado em background ou na inicialização do app.
 */
export async function detectAndQueueHighIntentCompanies(): Promise<AutoEnrichmentResult> {
  // Buscar empresas HOT sem decisores Apollo
  const { data: hotCompanies, error } = await supabase
    .from('companies')
    .select('id, name, icp_score, buying_signal')
    .eq('buying_signal', 'hot')
    .order('icp_score', { ascending: false })
    .limit(20);

  if (error) throw error;
  if (!hotCompanies || hotCompanies.length === 0) {
    return { queued: 0, alreadyEnriched: 0, companyIds: [] };
  }

  const companyIds = hotCompanies.map((c) => c.id);

  // Verificar quais já têm decisores
  const { data: enrichedContacts } = await supabase
    .from('contacts')
    .select('company_id')
    .in('company_id', companyIds)
    .eq('enrichment_source', 'apollo')
    .in('seniority', ['owner', 'founder', 'c_suite', 'vp', 'director']);

  const enrichedCompanyIds = new Set(
    (enrichedContacts ?? []).map((c) => c.company_id)
  );

  // Verificar quais já estão na fila
  const { data: pendingQueue } = await supabase
    .from('auto_enrichment_queue')
    .select('company_id')
    .in('company_id', companyIds)
    .in('status', ['pending', 'processing']);

  const queuedCompanyIds = new Set(
    (pendingQueue ?? []).map((q) => q.company_id)
  );

  // Filtrar empresas que precisam ser enfileiradas
  const toQueue = companyIds.filter(
    (id) => !enrichedCompanyIds.has(id) && !queuedCompanyIds.has(id)
  );

  if (toQueue.length > 0) {
    const queueRows = toQueue.map((companyId) => {
      const company = hotCompanies.find((c) => c.id === companyId)!;
      return {
        company_id: companyId,
        trigger_reason: 'batch_high_intent_scan',
        score_at_trigger: company.icp_score,
        status: 'pending' as const,
      };
    });

    await supabase.from('auto_enrichment_queue').insert(queueRows);
  }

  return {
    queued: toQueue.length,
    alreadyEnriched: enrichedCompanyIds.size,
    companyIds: toQueue,
  };
}

/**
 * Busca o status atual da fila de enriquecimento automático.
 */
export async function fetchAutoEnrichmentQueue(
  limit = 20,
): Promise<AutoEnrichmentQueueItem[]> {
  const { data, error } = await supabase
    .from('auto_enrichment_queue')
    .select(`
      id,
      company_id,
      owner_id,
      trigger_reason,
      score_at_trigger,
      status,
      error_message,
      created_at,
      processed_at,
      companies (name, buying_signal, icp_score)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as AutoEnrichmentQueueItem[];
}

/**
 * Dispara manualmente o processamento da fila de enriquecimento
 * via Edge Function `auto-enrich-dispatcher`.
 */
export async function dispatchEnrichmentQueue(): Promise<{
  processed: number;
  completed: number;
  failed: number;
  skipped: number;
}> {
  const { data, error } = await supabase.functions.invoke('auto-enrich-dispatcher', {
    body: {},
  });

  if (error) throw new Error(`Erro ao disparar dispatcher: ${error.message}`);
  if (!data?.ok) throw new Error(data?.error ?? 'Falha ao processar fila de enriquecimento');

  return {
    processed: data.processed ?? 0,
    completed: data.completed ?? 0,
    failed: data.failed ?? 0,
    skipped: data.skipped ?? 0,
  };
}

// ─── Operações em Massa (Legado) ──────────────────────────────────────────────

export async function bulkAssignResponsible(
  contactIds: string[],
  responsibleId: string,
): Promise<void> {
  const { error } = await supabase
    .from('contacts')
    .update({ responsible_id: responsibleId, updated_at: new Date().toISOString() })
    .in('id', contactIds);

  if (error) throw error;
}

export async function bulkMoveStage(contactIds: string[], stage: string): Promise<void> {
  const { error } = await supabase
    .from('contacts')
    .update({ stage, updated_at: new Date().toISOString() })
    .in('id', contactIds);

  if (error) throw error;
}
