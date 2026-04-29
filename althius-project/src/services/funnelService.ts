import { supabase } from '@/lib/supabase';

export interface Funnel {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
}

export interface Stage {
  id: string;
  funnel_id: string;
  name: string;
  order: number;
  created_at: string;
}

export interface Deal {
  id: string;
  title: string;
  value: number | null;
  stage_id: string | null;
  funnel_id: string | null;
  contact_id: string | null;
  company_id: string | null;
  owner_id: string;
  expected_close: string | null;
  created_at: string;
}

// ── Funnels ──────────────────────────────────────────────────

export async function getFunnels(): Promise<Funnel[]> {
  const { data, error } = await supabase
    .from('funnels')
    .select('*')
    .order('created_at');
  if (error) throw error;
  return data ?? [];
}

export async function createFunnel(name: string): Promise<Funnel> {
  const { data, error } = await supabase
    .from('funnels')
    .insert({ name })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateFunnel(id: string, name: string): Promise<void> {
  const { error } = await supabase
    .from('funnels')
    .update({ name })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteFunnel(id: string): Promise<void> {
  const { error } = await supabase.from('funnels').delete().eq('id', id);
  if (error) throw error;
}

// ── Stages ───────────────────────────────────────────────────

export async function getStages(funnelId: string): Promise<Stage[]> {
  const { data, error } = await supabase
    .from('stages')
    .select('*')
    .eq('funnel_id', funnelId)
    .order('order');
  if (error) throw error;
  return data ?? [];
}

export async function createStage(
  funnelId: string,
  name: string,
  order: number
): Promise<Stage> {
  const { data, error } = await supabase
    .from('stages')
    .insert({ funnel_id: funnelId, name, order })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateStage(
  id: string,
  name: string,
  order: number
): Promise<void> {
  const { error } = await supabase
    .from('stages')
    .update({ name, order })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteStage(id: string): Promise<void> {
  const { error } = await supabase.from('stages').delete().eq('id', id);
  if (error) throw error;
}

export async function reorderStages(orderedIds: string[]): Promise<void> {
  const updates = orderedIds.map((id, index) =>
    supabase.from('stages').update({ order: index }).eq('id', id)
  );
  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

// ── Deals ────────────────────────────────────────────────────

export async function getDeals(funnelId: string): Promise<Deal[]> {
  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .eq('funnel_id', funnelId);
  if (error) throw error;
  return data ?? [];
}

// ── Stage automations ────────────────────────────────────────

export interface StageAutomation {
  id: string;
  from_stage: string;
  to_funnel: string;
  to_stage: string;
  active: boolean;
  created_at: string;
}

export async function getAutomationsForFunnel(funnelId: string): Promise<StageAutomation[]> {
  const { data, error } = await supabase
    .from('stage_automations')
    .select('*, from:stages!stage_automations_from_stage_fkey(funnel_id)')
    .eq('from.funnel_id', funnelId);
  if (error) throw error;
  return (data ?? []) as StageAutomation[];
}

export async function getAutomationForStage(stageId: string): Promise<StageAutomation | null> {
  const { data, error } = await supabase
    .from('stage_automations')
    .select('*')
    .eq('from_stage', stageId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertAutomation(params: {
  from_stage: string;
  to_funnel: string;
  to_stage: string;
  active?: boolean;
}): Promise<StageAutomation> {
  const { data, error } = await supabase
    .from('stage_automations')
    .upsert(
      {
        from_stage: params.from_stage,
        to_funnel: params.to_funnel,
        to_stage: params.to_stage,
        active: params.active ?? true,
      },
      { onConflict: 'from_stage' },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAutomation(fromStageId: string): Promise<void> {
  const { error } = await supabase
    .from('stage_automations')
    .delete()
    .eq('from_stage', fromStageId);
  if (error) throw error;
}

// ── Move deal between stages ─────────────────────────────────

export async function moveDeal(
  dealId: string,
  fromStageId: string | null,
  toStageId: string,
  userId: string
): Promise<void> {
  const { error: updateError } = await supabase
    .from('deals')
    .update({ stage_id: toStageId })
    .eq('id', dealId);
  if (updateError) throw updateError;

  const { error: historyError } = await supabase
    .from('deal_history')
    .insert({
      deal_id: dealId,
      from_stage: fromStageId,
      to_stage: toStageId,
      moved_by: userId,
    });
  if (historyError) throw historyError;

  // Evento para futura integração com automações
  window.dispatchEvent(
    new CustomEvent('stage_changed', {
      detail: { dealId, fromStageId, toStageId, userId },
    })
  );
}