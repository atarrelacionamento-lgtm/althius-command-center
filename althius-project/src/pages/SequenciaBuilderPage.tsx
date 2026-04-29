import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Plus,
  Trash2,
  MessageSquare,
  Mail,
  GripVertical,
  Save,
  Loader2,
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  listFunnels,
  listStages,
  getSequence,
  upsertSequence,
} from '@/services/sequencesService';
import type { Funnel, FunnelStage, SequenceChannel, SequenceStep } from '@/types';

// Local draft step (without DB ids)
interface DraftStep {
  _key: string; // local unique key for React
  channel: SequenceChannel;
  delay_days: number;
  template: string;
}

function newStep(): DraftStep {
  return { _key: crypto.randomUUID(), channel: 'whatsapp', delay_days: 1, template: '' };
}

function fromSequenceStep(s: SequenceStep): DraftStep {
  return { _key: s.id, channel: s.channel, delay_days: s.delay_days, template: s.template };
}

const CHANNEL_LABELS: Record<SequenceChannel, string> = {
  whatsapp: 'WhatsApp',
  email: 'E-mail',
};

export default function SequenciaBuilderPage() {
  const { id } = useParams<{ id?: string }>();
  const isEditing = !!id && id !== 'nova';
  const navigate = useNavigate();
  const { toast } = useToast();

  // Form state
  const [name, setName] = useState('');
  const [funnelId, setFunnelId] = useState('');
  const [stageId, setStageId] = useState('');
  const [steps, setSteps] = useState<DraftStep[]>([newStep()]);

  // Data
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [stages, setStages] = useState<FunnelStage[]>([]);
  const [loadingPage, setLoadingPage] = useState(true);
  const [saving, setSaving] = useState(false);

  // Drag-and-drop state
  const dragIndex = useRef<number | null>(null);

  // Load funnels + existing sequence (if editing)
  useEffect(() => {
    async function load() {
      try {
        const funnelList = await listFunnels();
        setFunnels(funnelList);

        if (isEditing) {
          const seq = await getSequence(id!);
          setName(seq.name);
          setFunnelId(seq.funnel_id);
          setStageId(seq.stage_id);
          setSteps(seq.steps?.map(fromSequenceStep) ?? [newStep()]);

          const stageList = await listStages(seq.funnel_id);
          setStages(stageList);
        }
      } catch {
        toast({ title: 'Erro ao carregar dados', variant: 'destructive' });
      } finally {
        setLoadingPage(false);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload stages when funnel changes
  async function handleFunnelChange(newFunnelId: string) {
    setFunnelId(newFunnelId);
    setStageId('');
    try {
      const stageList = await listStages(newFunnelId);
      setStages(stageList);
    } catch {
      toast({ title: 'Erro ao carregar estágios', variant: 'destructive' });
    }
  }

  // Step helpers
  function updateStep(key: string, patch: Partial<DraftStep>) {
    setSteps((prev) => prev.map((s) => (s._key === key ? { ...s, ...patch } : s)));
  }

  function removeStep(key: string) {
    setSteps((prev) => prev.filter((s) => s._key !== key));
  }

  // Drag-and-drop reorder
  function handleDragStart(index: number) {
    dragIndex.current = index;
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (dragIndex.current === null || dragIndex.current === index) return;
    setSteps((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex.current!, 1);
      next.splice(index, 0, moved);
      dragIndex.current = index;
      return next;
    });
  }

  function handleDragEnd() {
    dragIndex.current = null;
  }

  // Save
  async function handleSave() {
    if (!name.trim()) {
      toast({ title: 'Informe o nome da sequência', variant: 'destructive' });
      return;
    }
    if (!funnelId) {
      toast({ title: 'Selecione um funil', variant: 'destructive' });
      return;
    }
    if (!stageId) {
      toast({ title: 'Selecione um estágio', variant: 'destructive' });
      return;
    }
    if (steps.length === 0) {
      toast({ title: 'Adicione ao menos 1 step', variant: 'destructive' });
      return;
    }
    const emptyTemplate = steps.find((s) => !s.template.trim());
    if (emptyTemplate) {
      toast({ title: 'Preencha o template de todos os steps', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      await upsertSequence({
        ...(isEditing ? { id } : {}),
        name: name.trim(),
        funnel_id: funnelId,
        stage_id: stageId,
        steps: steps.map((s, i) => ({
          position: i,
          channel: s.channel,
          delay_days: s.delay_days,
          template: s.template,
        })),
      });
      toast({ title: isEditing ? 'Sequência atualizada!' : 'Sequência criada!' });
      navigate('/sequencias');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar';
      toast({ title: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  if (loadingPage) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/crm/negocios?tab=automacoes')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isEditing ? 'Editar template' : 'Novo template'}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Monte do zero os passos, canais e mensagens do template
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: metadata */}
        <div className="chart-card flex flex-col gap-5 xl:col-span-1 h-fit">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Configuração
          </h2>

          <div className="flex flex-col gap-2">
            <Label htmlFor="seq-name">Nome da sequência</Label>
            <Input
              id="seq-name"
              placeholder="Ex: Boas-vindas Qualificação"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Funil</Label>
            <Select value={funnelId} onValueChange={handleFunnelChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um funil" />
              </SelectTrigger>
              <SelectContent>
                {funnels.length === 0 ? (
                  <SelectItem value="__none__" disabled>
                    Nenhum funil cadastrado
                  </SelectItem>
                ) : (
                  funnels.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Estágio</Label>
            <Select value={stageId} onValueChange={setStageId} disabled={!funnelId}>
              <SelectTrigger>
                <SelectValue placeholder={funnelId ? 'Selecione um estágio' : 'Selecione um funil primeiro'} />
              </SelectTrigger>
              <SelectContent>
                {stages.length === 0 ? (
                  <SelectItem value="__none__" disabled>
                    {funnelId ? 'Nenhum estágio neste funil' : 'Selecione um funil'}
                  </SelectItem>
                ) : (
                  stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Right: timeline of steps */}
        <div className="xl:col-span-2 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Steps ({steps.length})
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSteps((prev) => [...prev, newStep()])}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Adicionar step
            </Button>
          </div>

          <AnimatePresence initial={false}>
            {steps.map((step, index) => (
              <motion.div
                key={step._key}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.18 }}
                className="flex gap-3"
              >
                {/* Timeline indicator */}
                <div className="flex flex-col items-center pt-4">
                  <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-[11px] font-bold text-primary-foreground shrink-0">
                    {index + 1}
                  </div>
                  {index < steps.length - 1 && (
                    <div className="flex-1 w-px bg-border mt-2" />
                  )}
                </div>

                {/* Step card */}
                <div
                  className="chart-card flex-1 flex flex-col gap-4 mb-3"
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                >
                  {/* Step header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                      <span className="text-sm font-medium text-foreground">Step {index + 1}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => removeStep(step._key)}
                      disabled={steps.length === 1}
                      title="Remover step"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Channel + Delay */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs">Canal</Label>
                      <Select
                        value={step.channel}
                        onValueChange={(v) => updateStep(step._key, { channel: v as SequenceChannel })}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(['whatsapp', 'email'] as SequenceChannel[]).map((ch) => (
                            <SelectItem key={ch} value={ch}>
                              <span className="flex items-center gap-2">
                                {ch === 'whatsapp' ? (
                                  <MessageSquare className="h-3.5 w-3.5 text-green-500" />
                                ) : (
                                  <Mail className="h-3.5 w-3.5 text-blue-500" />
                                )}
                                {CHANNEL_LABELS[ch]}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs">Delay (dias)</Label>
                      <Input
                        type="number"
                        min={0}
                        className="h-9"
                        value={step.delay_days}
                        onChange={(e) =>
                          updateStep(step._key, { delay_days: Math.max(0, Number(e.target.value)) })
                        }
                      />
                    </div>
                  </div>

                  {/* Template */}
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Template de mensagem</Label>
                    <Textarea
                      placeholder={
                        step.channel === 'whatsapp'
                          ? 'Olá {{nome}}, tudo bem? Passando para...'
                          : 'Assunto: Olá {{nome}}\n\nCorpo do e-mail...'
                      }
                      value={step.template}
                      onChange={(e) => updateStep(step._key, { template: e.target.value })}
                      rows={4}
                      className="text-sm resize-none"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Use {'{{nome}}'}, {'{{empresa}}'} como variáveis dinâmicas.
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {steps.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
              <p className="text-muted-foreground text-sm">Nenhum step ainda</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSteps([newStep()])}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Adicionar step
              </Button>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
