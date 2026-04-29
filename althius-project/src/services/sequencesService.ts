import { supabase } from '@/lib/supabase';
import type { Funnel, FunnelStage, Sequence, SequenceStep } from '@/types';

// ── Funnels & Stages ─────────────────────────────────────

export async function listFunnels(): Promise<Funnel[]> {
  const { data, error } = await supabase
    .from('funnels')
    .select('id, name, created_at')
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function listStages(funnelId: string): Promise<FunnelStage[]> {
  const { data, error } = await supabase
    .from('stages')
    .select('id, funnel_id, name, "order"')
    .eq('funnel_id', funnelId)
    .order('order');
  if (error) throw error;

  type StageRow = Omit<FunnelStage, 'position'> & { order: number };

  // normalize: map 'order' → 'position' for type compatibility
  return ((data ?? []) as StageRow[]).map(({ order, ...stage }) => ({ ...stage, position: order }));
}

// ── Sequences ────────────────────────────────────────────

export async function listSequences(): Promise<Sequence[]> {
  const { data, error } = await supabase
    .from('sequences')
    .select(`
      id, name, funnel_id, stage_id, active, created_at,
      funnel:funnels(id, name),
      stage:stages(id, name),
      steps:sequence_steps(id, sequence_id, position, channel, delay_days, template)
    `)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Sequence[];
}

export async function getSequence(id: string): Promise<Sequence> {
  const { data, error } = await supabase
    .from('sequences')
    .select(`
      id, name, funnel_id, stage_id, active, created_at,
      funnel:funnels(id, name),
      stage:stages(id, name),
      steps:sequence_steps(id, sequence_id, position, channel, delay_days, template)
    `)
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as Sequence;
}

export interface UpsertSequencePayload {
  id?: string;
  name: string;
  funnel_id: string;
  stage_id: string;
  active?: boolean;
  steps: Omit<SequenceStep, 'id' | 'sequence_id'>[];
}

export async function upsertSequence(payload: UpsertSequencePayload): Promise<Sequence> {
  const { steps, ...sequenceData } = payload;

  // Validate: at least one step
  if (!steps.length) throw new Error('A sequência precisa ter ao menos 1 step.');
  if (!sequenceData.funnel_id) throw new Error('Selecione um funil.');
  if (!sequenceData.stage_id) throw new Error('Selecione um estágio.');

  // Upsert the sequence header
  const { data: seq, error: seqErr } = await supabase
    .from('sequences')
    .upsert({ ...sequenceData, active: sequenceData.active ?? true })
    .select('id')
    .single();
  if (seqErr) throw seqErr;

  const sequenceId: string = seq.id;

  // Replace steps: delete existing, insert new
  const { error: delErr } = await supabase
    .from('sequence_steps')
    .delete()
    .eq('sequence_id', sequenceId);
  if (delErr) throw delErr;

  const stepsToInsert = steps.map((s, i) => ({
    sequence_id: sequenceId,
    position: i,
    channel: s.channel,
    delay_days: s.delay_days,
    template: s.template,
  }));

  const { error: stepsErr } = await supabase
    .from('sequence_steps')
    .insert(stepsToInsert);
  if (stepsErr) throw stepsErr;

  return getSequence(sequenceId);
}

export async function toggleSequenceActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase
    .from('sequences')
    .update({ active })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteSequence(id: string): Promise<void> {
  const { error } = await supabase.from('sequences').delete().eq('id', id);
  if (error) throw error;
}

// ── B-AUT-002: troca automática ao mover card ─────────────

/**
 * Chamado pelo módulo de funis quando um deal é movido para outro estágio.
 * Busca a sequência ativa para o novo funil+estágio e registra em deal_sequences.
 */
export async function onStageChanged(dealId: string, funnelId: string, stageId: string): Promise<void> {
  // Find active sequence for this funnel + stage
  const { data: seqs, error } = await supabase
    .from('sequences')
    .select('id')
    .eq('funnel_id', funnelId)
    .eq('stage_id', stageId)
    .eq('active', true)
    .limit(1);
  if (error) throw error;

  if (!seqs || seqs.length === 0) return; // no active sequence for this stage

  const sequenceId = seqs[0].id;

  // Upsert into deal_sequences (replaces any previous sequence for this deal)
  await supabase.from('deal_sequences').delete().eq('deal_id', dealId);
  const { error: insErr } = await supabase
    .from('deal_sequences')
    .insert({ deal_id: dealId, sequence_id: sequenceId });
  if (insErr) throw insErr;
}
