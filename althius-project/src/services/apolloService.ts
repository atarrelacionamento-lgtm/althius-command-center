import { supabase } from '@/lib/supabase';

export interface ApolloEnrichedContact {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  linkedin_url: string | null;
  seniority: string | null;
}

export interface EnrichCompanyResponse {
  ok: boolean;
  company_id: string;
  created: number;
  credits_used: number;
  contacts: ApolloEnrichedContact[];
}

export interface EnrichCompanyOptions {
  maxContacts?: number;
  revealPhones?: boolean;
}

async function extractFunctionError(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response })?.context;
  if (ctx && typeof ctx.text === 'function') {
    try {
      const text = await ctx.text();
      try {
        const parsed = JSON.parse(text);
        return parsed.error ?? parsed.message ?? text;
      } catch {
        return text;
      }
    } catch {
      /* noop */
    }
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

export async function enrichCompany(
  companyId: string,
  options: EnrichCompanyOptions = {},
): Promise<EnrichCompanyResponse> {
  const { data, error } = await supabase.functions.invoke('apollo-enrich-company', {
    body: {
      company_id: companyId,
      max_contacts: options.maxContacts ?? 5,
      reveal_phones: options.revealPhones ?? true,
    },
  });

  if (error) {
    throw new Error(await extractFunctionError(error));
  }
  if (!data?.ok) throw new Error(data?.error ?? 'Falha ao enriquecer empresa.');
  return data as EnrichCompanyResponse;
}

export async function enrichCompaniesBulk(
  companyIds: string[],
  options: EnrichCompanyOptions = {},
): Promise<{ successes: EnrichCompanyResponse[]; failures: Array<{ companyId: string; error: string }> }> {
  const successes: EnrichCompanyResponse[] = [];
  const failures: Array<{ companyId: string; error: string }> = [];
  for (const id of companyIds) {
    try {
      successes.push(await enrichCompany(id, options));
    } catch (err) {
      failures.push({ companyId: id, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return { successes, failures };
}

export interface EnrichmentJob {
  id: string;
  company_id: string;
  stage: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  credits_used: number;
  error_message: string | null;
  created_at: string;
  response_payload: Record<string, unknown> | null;
}

export interface RevealPhoneResponse {
  ok: boolean;
  phone: string | null;
  email: string | null;
  waterfall_pending: boolean;
  message: string;
}

export async function revealContactPhone(contactId: string): Promise<RevealPhoneResponse> {
  const { data, error } = await supabase.functions.invoke('apollo-reveal-phone', {
    body: { contact_id: contactId },
  });
  if (error) throw new Error(await extractFunctionError(error));
  if (!data?.ok) throw new Error(data?.error ?? 'Falha ao buscar telefone.');
  return data as RevealPhoneResponse;
}

export async function listEnrichmentJobs(companyId: string): Promise<EnrichmentJob[]> {
  const { data, error } = await supabase
    .from('enrichment_jobs')
    .select('id, company_id, stage, status, credits_used, error_message, created_at, response_payload')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) throw error;
  return (data ?? []) as EnrichmentJob[];
}
