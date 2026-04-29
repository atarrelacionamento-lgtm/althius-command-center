/**
 * ALTHIUS GTM Engineering — Propulsion Panel
 *
 * Interface de Propulsão: exibe recomendações de Próximo Passo
 * geradas pelo nextStepService, com estética SpaceX (Black & White).
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  generateNextStep,
  markNextStepExecuted,
  type NextStepRecommendation,
  type RecommendationChannel,
} from '@/services/nextStepService';
import {
  triggerAutoEnrichmentForCompany,
  fetchAutoEnrichmentQueue,
} from '@/services/enrichmentService';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

// ─── Ícones inline (sem dependência externa) ─────────────────────────────────

function IconRocket({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  );
}

function IconZap({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function IconAlertTriangle({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function IconCopy({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function IconCheck({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PROPULSION_LABELS: Record<string, { label: string; className: string }> = {
  critical: { label: 'CRÍTICO', className: 'bg-white text-black font-bold' },
  high: { label: 'ALTO', className: 'bg-zinc-200 text-black' },
  medium: { label: 'MÉDIO', className: 'bg-zinc-700 text-white' },
  low: { label: 'BAIXO', className: 'bg-zinc-900 text-zinc-400 border border-zinc-700' },
};

const CHANNEL_LABELS: Record<RecommendationChannel, string> = {
  whatsapp: 'WhatsApp',
  linkedin: 'LinkedIn',
  phone: 'Ligação',
  email: 'E-mail',
  meeting: 'Reunião',
};

const TACTIC_LABELS: Record<string, string> = {
  timing_leverage: 'Alavancagem de Timing',
  roi_anchor: 'Âncora de ROI',
  pain_amplification: 'Amplificação de Dor',
  competitor_displacement: 'Deslocamento de Concorrente',
  social_proof: 'Prova Social',
  executive_escalation: 'Escalada Executiva',
  direct_ask: 'Pedido Direto',
  urgency_signal: 'Urgência por Sinal',
};

// ─── Componente Principal ─────────────────────────────────────────────────────

interface PropulsionPanelProps {
  companyId: string;
  className?: string;
}

export function PropulsionPanel({ companyId, className = '' }: PropulsionPanelProps) {
  const queryClient = useQueryClient();
  const [messageCopied, setMessageCopied] = useState(false);

  const {
    data: recommendation,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['next-step', companyId],
    queryFn: () => generateNextStep(companyId),
    staleTime: 2 * 60 * 1000, // 2 minutos
    retry: 1,
  });

  const executeMutation = useMutation({
    mutationFn: ({
      channel,
      persona,
      notes,
    }: {
      channel: RecommendationChannel;
      persona: string;
      notes?: string;
    }) => markNextStepExecuted(companyId, channel, persona, notes),
    onSuccess: () => {
      toast.success('Ação registrada com sucesso');
      queryClient.invalidateQueries({ queryKey: ['next-step', companyId] });
      queryClient.invalidateQueries({ queryKey: ['interactions', companyId] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao registrar ação: ${err.message}`);
    },
  });

  const enrichMutation = useMutation({
    mutationFn: () => triggerAutoEnrichmentForCompany(companyId),
    onSuccess: (result) => {
      if (result.triggered) {
        toast.success(result.reason);
        queryClient.invalidateQueries({ queryKey: ['next-step', companyId] });
        queryClient.invalidateQueries({ queryKey: ['contacts', companyId] });
      } else {
        toast.info(result.reason);
      }
    },
    onError: (err: Error) => {
      toast.error(`Erro no enriquecimento: ${err.message}`);
    },
  });

  const handleCopyMessage = useCallback(async (message: string) => {
    await navigator.clipboard.writeText(message);
    setMessageCopied(true);
    setTimeout(() => setMessageCopied(false), 2000);
    toast.success('Mensagem copiada');
  }, []);

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="flex items-center gap-3 text-zinc-400">
          <IconRocket className="w-5 h-5 animate-pulse" />
          <span className="text-sm font-mono">Calculando propulsão...</span>
        </div>
      </div>
    );
  }

  if (error || !recommendation) {
    return (
      <div className={`p-4 border border-zinc-800 rounded-lg ${className}`}>
        <p className="text-zinc-500 text-sm">Não foi possível gerar recomendação.</p>
        <Button variant="ghost" size="sm" onClick={() => refetch()} className="mt-2 text-zinc-400">
          Tentar novamente
        </Button>
      </div>
    );
  }

  const propulsionStyle = PROPULSION_LABELS[recommendation.propulsionLevel];

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header: Nível de Propulsão */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <IconRocket className="w-5 h-5 text-white" />
          <span className="text-sm font-mono text-zinc-400 uppercase tracking-widest">
            Propulsão
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-white font-mono">
            {recommendation.score}
          </span>
          <span className="text-zinc-600 font-mono">/100</span>
          <Badge className={`ml-2 text-xs font-mono ${propulsionStyle.className}`}>
            {propulsionStyle.label}
          </Badge>
        </div>
      </div>

      {/* Alertas */}
      {recommendation.alerts.length > 0 && (
        <div className="space-y-1">
          {recommendation.alerts.map((alert, i) => (
            <div
              key={i}
              className="flex items-start gap-2 p-2 bg-zinc-900 border border-zinc-700 rounded text-xs text-zinc-300 font-mono"
            >
              <IconAlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-zinc-400" />
              <span>{alert}</span>
            </div>
          ))}
        </div>
      )}

      {/* Análise do Momento */}
      <Card className="bg-zinc-950 border-zinc-800">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-xs font-mono text-zinc-500 uppercase tracking-widest">
            Análise do Momento
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 space-y-1">
          <p className="text-sm text-zinc-300">{recommendation.momentAnalysis.summary}</p>
          {recommendation.momentAnalysis.urgencyReason && (
            <p className="text-xs text-zinc-500 font-mono">
              {recommendation.momentAnalysis.urgencyReason}
            </p>
          )}
          {recommendation.momentAnalysis.windowOpportunity && (
            <p className="text-xs text-white font-mono font-semibold">
              {recommendation.momentAnalysis.windowOpportunity}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Ação Principal */}
      <Card className="bg-black border-white/20">
        <CardHeader className="pb-2 pt-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-mono text-zinc-400 uppercase tracking-widest">
              Próximo Passo
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-mono border-zinc-700 text-zinc-400">
                {CHANNEL_LABELS[recommendation.primaryAction.channel]}
              </Badge>
              <Badge variant="outline" className="text-xs font-mono border-zinc-700 text-zinc-400">
                {TACTIC_LABELS[recommendation.primaryAction.tactic]}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-3 space-y-3">
          <div>
            <p className="text-xs text-zinc-500 font-mono mb-1">
              Para: {recommendation.primaryAction.persona}
            </p>
            <p className="text-sm text-white leading-relaxed">
              {recommendation.primaryAction.message}
            </p>
          </div>

          <p className="text-xs text-zinc-600 font-mono italic">
            {recommendation.primaryAction.rationale}
          </p>

          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 border-zinc-700 text-zinc-300 hover:bg-zinc-900 font-mono text-xs"
              onClick={() => handleCopyMessage(recommendation.primaryAction.message)}
            >
              {messageCopied ? (
                <IconCheck className="w-3.5 h-3.5 mr-1.5" />
              ) : (
                <IconCopy className="w-3.5 h-3.5 mr-1.5" />
              )}
              {messageCopied ? 'Copiado' : 'Copiar mensagem'}
            </Button>
            <Button
              size="sm"
              className="flex-1 bg-white text-black hover:bg-zinc-200 font-mono text-xs font-bold"
              onClick={() =>
                executeMutation.mutate({
                  channel: recommendation.primaryAction.channel,
                  persona: recommendation.primaryAction.persona,
                })
              }
              disabled={executeMutation.isPending}
            >
              <IconZap className="w-3.5 h-3.5 mr-1.5" />
              Marcar como feito
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Ações Secundárias */}
      {recommendation.secondaryActions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-mono text-zinc-600 uppercase tracking-widest">
            Ações Complementares
          </p>
          {recommendation.secondaryActions.map((action, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-3 bg-zinc-950 border border-zinc-800 rounded-lg"
            >
              <Badge
                variant="outline"
                className="text-xs font-mono border-zinc-700 text-zinc-500 flex-shrink-0 mt-0.5"
              >
                {CHANNEL_LABELS[action.channel]}
              </Badge>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-zinc-500 font-mono">{action.persona}</p>
                <p className="text-sm text-zinc-300 mt-0.5">{action.action}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sinais de Suporte */}
      {recommendation.supportingSignals.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-mono text-zinc-600 uppercase tracking-widest">
            Sinais Detectados
          </p>
          <div className="space-y-1">
            {recommendation.supportingSignals.map((signal, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2 bg-zinc-950 border border-zinc-800 rounded text-xs"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0"
                    style={{ opacity: signal.confidence }}
                  />
                  <span className="text-zinc-300 font-mono">{signal.type}</span>
                  {signal.description && (
                    <span className="text-zinc-600 truncate max-w-[200px]">
                      — {signal.description}
                    </span>
                  )}
                </div>
                <span className="text-zinc-600 font-mono flex-shrink-0">
                  +{signal.weight}pts
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status da Cadência */}
      {recommendation.cadenceStatus && (
        <div className="space-y-2">
          <p className="text-xs font-mono text-zinc-600 uppercase tracking-widest">
            Cadência
          </p>
          <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-zinc-400">
                Dia {recommendation.cadenceStatus.day}/21
              </span>
              <span className="text-xs font-mono text-zinc-500">
                {recommendation.cadenceStatus.blockLabel}
              </span>
            </div>
            {/* Barra de progresso */}
            <div className="w-full bg-zinc-900 rounded-full h-1">
              <div
                className="bg-white h-1 rounded-full transition-all"
                style={{ width: `${(recommendation.cadenceStatus.day / 21) * 100}%` }}
              />
            </div>
            <div className="flex gap-4 text-xs font-mono">
              <span className="text-zinc-500">
                Contatados:{' '}
                <span className="text-white">
                  {recommendation.cadenceStatus.personasContacted.join(', ') || '—'}
                </span>
              </span>
              <span className="text-zinc-500">
                Pendentes:{' '}
                <span className="text-zinc-400">
                  {recommendation.cadenceStatus.personasPending.join(', ') || '—'}
                </span>
              </span>
            </div>
          </div>
        </div>
      )}

      <Separator className="bg-zinc-800" />

      {/* Ações de Enriquecimento */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-zinc-600">
          Gerado em {new Date(recommendation.generatedAt).toLocaleTimeString('pt-BR')}
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="text-xs font-mono text-zinc-500 hover:text-white"
            onClick={() => refetch()}
          >
            Atualizar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-xs font-mono text-zinc-500 hover:text-white"
            onClick={() => enrichMutation.mutate()}
            disabled={enrichMutation.isPending}
          >
            {enrichMutation.isPending ? 'Enriquecendo...' : 'Enriquecer decisores'}
          </Button>
        </div>
      </div>
    </div>
  );
}
