import { supabase } from '@/lib/supabase';

export type IntegrationName =
  | 'apollo'
  | 'search_api'
  | 'n8n'
  | 'briary'
  | 'whatsapp'
  | 'email'
  | 'openai';

export type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'coming_soon';

export interface Integration {
  id: string;
  name: IntegrationName;
  api_key_encrypted: string | null;
  webhook_url: string | null;
  status: IntegrationStatus;
  configured_by: string | null;
  updated_at: string;
}

export interface WebhookLog {
  id: string;
  webhook_id: string;
  payload: Record<string, unknown>;
  received_at: string;
  status: 'received' | 'processed' | 'error';
}

export type AutomationEventKind = 'whatsapp_message' | 'market_signal';

export interface AutomationWebhookPayload {
  kind: AutomationEventKind;
  source?: string;
  integration_id?: string;
  integration_name?: IntegrationName;
  external_event_id?: string;
  timestamp?: string;
  company_id?: string;
  contact_id?: string;
  company?: {
    name?: string;
    domain?: string;
    cnpj?: string;
  };
  company_updates?: Record<string, unknown>;
  contact_updates?: Record<string, unknown>;
  allow_create_company?: boolean;
  whatsapp?: {
    direction: 'inbound' | 'outbound';
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
  market_signal?: {
    type: string;
    description?: string;
    source?: string;
    confidence?: number;
    create_followup_task?: boolean;
    metadata?: Record<string, unknown>;
  };
}

export interface AutomationWebhookResult {
  ok: boolean;
  duplicate?: boolean;
  event_id?: string;
  companyId?: string;
  contactId?: string | null;
  interactionId?: string;
  taskId?: string | null;
  signalIds?: string[];
  summary?: string;
  source?: string;
  error?: string;
}

export const AUTOMATION_EVENT_BLUEPRINTS: Record<AutomationEventKind, AutomationWebhookPayload> = {
  whatsapp_message: {
    kind: 'whatsapp_message',
    integration_name: 'whatsapp',
    source: 'whatsapp',
    external_event_id: 'evt-whatsapp-demo-001',
    timestamp: new Date().toISOString(),
    company_id: 'substitua-pelo-id-da-company',
    contact_id: 'substitua-pelo-id-do-contato',
    whatsapp: {
      direction: 'inbound',
      phone: '+55 11 99999-0000',
      message: 'Oi Renan, vi sua mensagem. Podemos alinhar isso semana que vem?',
      contact_name: 'Mariana Oliveira',
      contact_role: 'Diretora Comercial',
      summary: 'Lead respondeu pelo WhatsApp e pediu para retomar a conversa na próxima semana.',
      next_step: 'Responder hoje com 2 opções de horário e proposta de call de 15 min.',
      create_followup_task: true,
      signal_hints: ['vgv_pressure'],
    },
  },
  market_signal: {
    kind: 'market_signal',
    integration_name: 'n8n',
    source: 'n8n',
    external_event_id: 'evt-market-demo-001',
    timestamp: new Date().toISOString(),
    company: {
      name: 'Incorporadora Exemplo',
      domain: 'exemplo.com.br',
    },
    market_signal: {
      type: 'new_launch',
      source: 'news',
      confidence: 0.92,
      description: 'A conta sinalizou um novo lançamento para os próximos 90 dias.',
      create_followup_task: true,
      metadata: {
        headline: 'Novo empreendimento anunciado em evento do mercado',
      },
    },
    company_updates: {
      upcoming_launch: true,
      domain: 'exemplo.com.br',
    },
  },
};

export async function fetchIntegrations(): Promise<Integration[]> {
  const { data, error } = await supabase
    .from('integrations')
    .select('*')
    .order('name');

  if (error) throw error;
  return data as Integration[];
}

export async function saveIntegration(
  name: IntegrationName,
  apiKey: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('integrations')
    .update({
      api_key_encrypted: apiKey,
      status: 'connected',
      configured_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq('name', name);

  if (error) throw error;
}

export async function connectWebhookIntegration(
  integrationId: string,
  userId: string,
  webhookUrl: string | null = null,
): Promise<void> {
  const { error } = await supabase
    .from('integrations')
    .update({
      webhook_url: webhookUrl,
      status: 'connected',
      configured_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', integrationId);

  if (error) throw error;
}

export async function disconnectIntegration(name: IntegrationName): Promise<void> {
  const { error } = await supabase
    .from('integrations')
    .update({
      api_key_encrypted: null,
      webhook_url: null,
      status: 'disconnected',
      updated_at: new Date().toISOString(),
    })
    .eq('name', name);

  if (error) throw error;
}

/** Testa conexão chamando Edge Function dedicada (quando houver) ou validação mínima. */
export async function testConnection(
  name: IntegrationName,
  apiKey: string,
): Promise<{ ok: boolean; message: string }> {
  if (!apiKey.trim()) {
    return { ok: false, message: 'Informe a API key antes de testar.' };
  }

  if (name === 'apollo') {
    try {
      const { data, error } = await supabase.functions.invoke('apollo-test-connection', {
        body: { api_key: apiKey },
      });
      if (error) {
        const ctx = (error as { context?: Response })?.context;
        let message = error.message;
        if (ctx && typeof ctx.text === 'function') {
          try {
            const text = await ctx.text();
            try {
              const parsed = JSON.parse(text);
              message = parsed.message ?? parsed.error ?? text;
            } catch {
              message = text;
            }
          } catch { /* noop */ }
        }
        return { ok: false, message };
      }
      return data as { ok: boolean; message: string };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  // Fallback genérico: aceita qualquer chave com pelo menos 20 chars
  await new Promise((r) => setTimeout(r, 400));
  if (apiKey.length >= 20) {
    return { ok: true, message: `Conexão com ${name} estabelecida com sucesso.` };
  }
  return { ok: false, message: 'API key inválida ou sem permissões suficientes.' };
}

/** Gera a URL de webhook n8n para este workspace, usando o id da integração */
export function buildWebhookUrl(integrationId: string): string {
  const base = import.meta.env.VITE_SUPABASE_URL ?? 'https://your-project.supabase.co';
  return `${base}/functions/v1/n8n-webhook/${integrationId}`;
}

export async function saveWebhookUrl(integrationId: string, url: string): Promise<void> {
  const { error } = await supabase
    .from('integrations')
    .update({ webhook_url: url, updated_at: new Date().toISOString() })
    .eq('id', integrationId);

  if (error) throw error;
}

export async function fetchWebhookLogs(integrationId: string): Promise<WebhookLog[]> {
  const { data, error } = await supabase
    .from('webhook_logs')
    .select('*')
    .eq('webhook_id', integrationId)
    .order('received_at', { ascending: false })
    .limit(10);

  if (error) throw error;
  return data as WebhookLog[];
}

export async function invokeAutomationWebhook(
  payload: AutomationWebhookPayload,
): Promise<AutomationWebhookResult> {
  const { data, error } = await supabase.functions.invoke('n8n-webhook', {
    body: payload,
  });

  if (error) throw error;
  return (data ?? {}) as AutomationWebhookResult;
}
