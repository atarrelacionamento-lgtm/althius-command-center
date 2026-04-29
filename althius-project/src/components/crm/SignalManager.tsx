import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Trash2, Zap } from 'lucide-react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase';

type SignalType =
  | 'new_launch'
  | 'hiring_sales'
  | 'hiring_marketing'
  | 'running_ads'
  | 'slow_response'
  | 'no_followup'
  | 'vgv_pressure'
  | 'competitor_change'
  | 'funding'
  | 'custom';

interface AccountSignal {
  id: string;
  company_id: string;
  signal_type: SignalType;
  description: string | null;
  detected_at: string;
  source: string;
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
}

const SIGNAL_OPTIONS: { value: SignalType; label: string }[] = [
  { value: 'new_launch', label: 'Novo lançamento previsto' },
  { value: 'hiring_sales', label: 'Contratando time comercial' },
  { value: 'hiring_marketing', label: 'Contratando time de marketing' },
  { value: 'running_ads', label: 'Rodando mídia paga (Google/Meta)' },
  { value: 'slow_response', label: 'Lead oculto: resposta lenta (>1h)' },
  { value: 'no_followup', label: 'Lead oculto: sem follow-up em 5 dias' },
  { value: 'vgv_pressure', label: 'VGV parado / pressão de caixa' },
  { value: 'competitor_change', label: 'Mudando de ferramenta/parceiro' },
  { value: 'funding', label: 'Captação / investimento recente' },
  { value: 'custom', label: 'Sinal personalizado' },
];

const SIGNAL_LABELS = SIGNAL_OPTIONS.reduce<Record<SignalType, string>>((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {} as Record<SignalType, string>);

function formatSignalDate(value: string) {
  return new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SignalManager({ open, onOpenChange, companyId }: Props) {
  const qc = useQueryClient();
  const [signalType, setSignalType] = useState<SignalType>('new_launch');
  const [description, setDescription] = useState('');

  const { data: signals = [], isLoading } = useQuery({
    queryKey: ['account-signals', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('account_signals')
        .select('id, company_id, signal_type, description, detected_at, source, created_at')
        .eq('company_id', companyId)
        .order('detected_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as AccountSignal[];
    },
    enabled: open && !!companyId,
  });

  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel(`account-signals-${companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'account_signals',
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ['account-signals', companyId] });
          qc.invalidateQueries({ queryKey: ['company', companyId] });
          qc.invalidateQueries({ queryKey: ['companies'] });
          qc.invalidateQueries({ queryKey: ['account-stats'] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, qc]);

  const refreshCompanyScore = async () => {
    const { error } = await supabase.rpc('recalculate_buying_signal', { p_company_id: companyId });
    if (error) throw error;

    await Promise.all([
      qc.invalidateQueries({ queryKey: ['account-signals', companyId] }),
      qc.invalidateQueries({ queryKey: ['company', companyId] }),
      qc.invalidateQueries({ queryKey: ['companies'] }),
      qc.invalidateQueries({ queryKey: ['account-stats'] }),
    ]);
  };

  const addMutation = useMutation({
    mutationFn: async () => {
      const trimmedDescription = description.trim();
      if (signalType === 'custom' && !trimmedDescription) {
        throw new Error('Descreva o sinal personalizado.');
      }

      const { error } = await supabase
        .from('account_signals')
        .insert({
          company_id: companyId,
          signal_type: signalType,
          description: trimmedDescription || null,
          source: 'manual',
        });

      if (error) throw error;
      await refreshCompanyScore();
    },
    onSuccess: () => {
      toast.success('Sinal adicionado.');
      setSignalType('new_launch');
      setDescription('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeMutation = useMutation({
    mutationFn: async (signalId: string) => {
      const { error } = await supabase
        .from('account_signals')
        .delete()
        .eq('id', signalId)
        .eq('company_id', companyId);

      if (error) throw error;
      await refreshCompanyScore();
    },
    onSuccess: () => toast.success('Sinal removido.'),
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Sinais de compra</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 py-6">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              addMutation.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label>Tipo de sinal</Label>
              <Select value={signalType} onValueChange={(value) => setSignalType(value as SignalType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SIGNAL_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="signal-description">
                {signalType === 'custom' ? 'Descrição do sinal *' : 'Descrição'}
              </Label>
              <Textarea
                id="signal-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Ex: abriu vagas para SDRs, lançou campanha de tráfego, resposta demorou 2h..."
              />
            </div>

            <Button type="submit" disabled={addMutation.isPending} className="w-full gap-1.5">
              <Zap className="h-4 w-4" />
              {addMutation.isPending ? 'Adicionando…' : 'Adicionar sinal'}
            </Button>
          </form>

          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Sinais adicionados</h3>
              <p className="text-xs text-muted-foreground">
                A pontuação da conta é recalculada sempre que a lista muda.
              </p>
            </div>

            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : signals.length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-center text-muted-foreground">
                <Zap className="mx-auto mb-2 h-6 w-6 opacity-40" />
                <p className="text-sm">Nenhum sinal cadastrado.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {signals.map((signal) => (
                  <div key={signal.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{SIGNAL_LABELS[signal.signal_type] ?? signal.signal_type}</p>
                      {signal.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{signal.description}</p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground/70">
                        {formatSignalDate(signal.detected_at)} · {signal.source}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                      disabled={removeMutation.isPending}
                      aria-label="Remover sinal"
                      onClick={() => removeMutation.mutate(signal.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <SheetFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
