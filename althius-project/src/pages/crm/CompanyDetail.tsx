import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft, Flame, Thermometer, Snowflake, Rocket, ExternalLink,
  Users, MessageSquare, Linkedin, Phone, Plus, Mail,
  TrendingUp, BarChart3, Globe, Instagram, Play, CheckCircle2,
  Zap, Clock, AlertCircle, Pencil,
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Can } from '@/components/Can';
import { ContactForm } from '@/components/crm/ContactForm';
import { LaunchForm } from '@/components/crm/LaunchForm';
import { SignalManager } from '@/components/crm/SignalManager';
import { WhatsAppTimeline } from '@/components/crm/WhatsAppTimeline';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getCompanyCadenceDay } from '@/lib/cadence';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { startCadenceForContacts, getInteractions, type Interaction } from '@/services/abmService';
import { invokeAutomationWebhook } from '@/services/integrationService';
import type { Company, Contact, CompanyLaunch, BuyingSignal } from '@/types';

// ── Helpers ──────────────────────────────────────────────

const SIGNAL_CFG: Record<BuyingSignal, { label: string; icon: React.ElementType; style: string }> = {
  hot:  { label: 'Burning — conta prioritária',  icon: Flame,       style: 'text-orange-500' },
  warm: { label: 'Aquecida — boa oportunidade',  icon: Thermometer, style: 'text-yellow-500' },
  cold: { label: 'Fria — sem sinais claros',     icon: Snowflake,   style: 'text-blue-400' },
};

function fmtVGV(v: number | null) {
  if (!v) return '—';
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(0)}M`;
  return `R$ ${(v / 1_000).toFixed(0)}k`;
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  const [year, month, day] = d.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
}

function toWhatsAppHref(value: string) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits.startsWith('55') ? digits : `55${digits}`}`;
}

// ── Launches Tab ─────────────────────────────────────────

function LaunchCard({
  launch,
  onEdit,
  canEdit,
}: {
  launch: CompanyLaunch;
  onEdit: (launch: CompanyLaunch) => void;
  canEdit: boolean;
}) {
  const statusColor: Record<string, string> = {
    active:    'bg-green-500/15 text-green-600',
    upcoming:  'bg-blue-500/15 text-blue-500',
    sold_out:  'bg-muted text-muted-foreground',
    cancelled: 'bg-destructive/15 text-destructive',
  };
  const statusLabel: Record<string, string> = {
    active: 'Ativo', upcoming: 'Previsto', sold_out: 'Esgotado', cancelled: 'Cancelado',
  };

  const pctSold = launch.units_total && launch.units_sold
    ? Math.round((launch.units_sold / launch.units_total) * 100)
    : null;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="font-semibold">{launch.name}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[launch.status]}`}>
                {statusLabel[launch.status]}
              </span>
            </div>
            {launch.neighborhood && (
              <p className="text-xs text-muted-foreground">{launch.neighborhood}{launch.city ? `, ${launch.city}` : ''}</p>
            )}
          </div>
          <div className="flex items-start gap-2 shrink-0">
            {launch.vgv && (
              <div className="text-right shrink-0">
                <p className="font-bold text-sm">{fmtVGV(launch.vgv)}</p>
                <p className="text-xs text-muted-foreground">VGV</p>
              </div>
            )}
            {canEdit && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label="Editar lançamento"
                onClick={() => onEdit(launch)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs mb-3">
          <div>
            <p className="text-muted-foreground">Unidades</p>
            <p className="font-medium">{launch.units_total ?? '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Lançamento</p>
            <p className="font-medium">{fmtDate(launch.launch_date)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Entrega</p>
            <p className="font-medium">{fmtDate(launch.delivery_date)}</p>
          </div>
        </div>

        {pctSold !== null && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">Vendas</span>
              <span className="font-medium">{pctSold}% vendido</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pctSold}%` }} />
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {launch.website_url && (
            <a href={launch.website_url} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                <Globe className="h-3 w-3" /> Site
              </Button>
            </a>
          )}
          {launch.landing_page_url && (
            <a href={launch.landing_page_url} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                <ExternalLink className="h-3 w-3" /> Landing Page
              </Button>
            </a>
          )}
          {launch.instagram_url && (
            <a href={launch.instagram_url} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                <Instagram className="h-3 w-3" /> Instagram
              </Button>
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Contacts Tab ─────────────────────────────────────────

function ContactRow({ contact }: { contact: Contact }) {
  const whatsappHref = contact.whatsapp ? toWhatsAppHref(contact.whatsapp) : null;

  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-primary">{contact.name.slice(0, 2).toUpperCase()}</span>
        </div>
        <div>
          <p className="text-sm font-medium">{contact.name}</p>
          <p className="text-xs text-muted-foreground">{contact.role || '—'}</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
          Sugerido
        </Badge>
        {whatsappHref && (
          <a href={whatsappHref} target="_blank" rel="noreferrer">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-green-500">
              <MessageSquare className="h-3.5 w-3.5" />
            </Button>
          </a>
        )}
        {contact.email && (
          <a href={`mailto:${contact.email}`}>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <Mail className="h-3.5 w-3.5" />
            </Button>
          </a>
        )}
      </div>
    </div>
  );
}

// ── Cadence Tab ──────────────────────────────────────────

function CadenceTimeline({ company, contacts }: { company: Company; contacts: Contact[] }) {
  const qc = useQueryClient();
  const startMutation = useMutation({
    mutationFn: () => startCadenceForContacts({
      companyId: company.id,
      companyName: company.name,
      contacts: contacts.map((contact) => ({
        id: contact.id,
        name: contact.name,
        role: contact.role,
      })),
    }),
    onSuccess: (createdTasks) => {
      qc.invalidateQueries({ queryKey: ['company', company.id] });
      qc.invalidateQueries({ queryKey: ['daily-tasks'] });
      toast.success(`Cadência iniciada com ${createdTasks} ações. Acesse "Comando do Dia".`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const steps = [
    { day: 1,  block: 1, label: 'Diagnóstico + primeiro contato',    channels: ['WhatsApp', 'LinkedIn'],  personas: ['CMO', 'Dir. Comercial'] },
    { day: 3,  block: 1, label: 'Envio do vídeo Loom (diagnóstico)', channels: ['WhatsApp'],              personas: ['CMO', 'Dir. Comercial'] },
    { day: 4,  block: 1, label: 'Ligação de follow-up',              channels: ['Telefone'],              personas: ['CMO', 'Dir. Comercial'] },
    { day: 5,  block: 2, label: 'Escalada para o Sócio',             channels: ['WhatsApp', 'LinkedIn'],  personas: ['Sócio / CEO'] },
    { day: 8,  block: 2, label: 'Diagnóstico interativo + calculadora', channels: ['WhatsApp'],           personas: ['Todos'] },
    { day: 12, block: 3, label: 'Case de sucesso',                   channels: ['WhatsApp'],              personas: ['Todos'] },
    { day: 15, block: 3, label: 'Follow-up persistência (foco Sócio)', channels: ['WhatsApp', 'Telefone'], personas: ['Sócio / CEO'] },
    { day: 21, block: 3, label: 'Break-up de integridade',           channels: ['WhatsApp'],              personas: ['Todos'] },
  ];

  const blockColors: Record<number, string> = {
    1: 'border-blue-500 bg-blue-500',
    2: 'border-purple-500 bg-purple-500',
    3: 'border-orange-500 bg-orange-500',
  };
  const blockLabels: Record<number, string> = {
    1: 'Bloco 1 — Cerco Operacional',
    2: 'Bloco 2 — Escalada C-Level',
    3: 'Bloco 3 — Prova + Fechamento',
  };

  const isActive = company.cadence_status === 'active';
  const currentDay = getCompanyCadenceDay(company);
  const hasPeople = contacts.length >= 2;

  if (company.cadence_status === 'not_started' || !company.cadence_status) {
    return (
      <div className="text-center py-10">
        <Zap className="h-10 w-10 text-primary mx-auto mb-3" />
        <p className="font-semibold mb-1">Cadência não iniciada</p>
        <p className="text-sm text-muted-foreground mb-4 max-w-xs mx-auto">
          Cadências da Pipa sempre rodam por conta e por pessoas. Cadastre pelo menos 2 pessoas-chave.
        </p>
        <Button onClick={() => startMutation.mutate()} disabled={startMutation.isPending || !hasPeople}>
          {startMutation.isPending ? 'Iniciando…' : hasPeople ? 'Iniciar com pessoas-chave' : 'Adicione pessoas primeiro'}
        </Button>
      </div>
    );
  }

  let lastBlock = 0;
  return (
    <div className="space-y-1">
      {isActive && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4 p-3 rounded-lg bg-muted/40">
          <Clock className="h-4 w-4 text-primary" />
          <span>Dia <strong className="text-foreground">{currentDay}</strong> de 21 — cadência ativa</span>
        </div>
      )}
      {steps.map((step) => {
        const showBlockLabel = step.block !== lastBlock;
        lastBlock = step.block;
        const isDone = currentDay > step.day;
        const isCurrent = currentDay === step.day;

        return (
          <div key={step.day}>
            {showBlockLabel && (
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-4 mb-2">
                {blockLabels[step.block]}
              </p>
            )}
            <div className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${isCurrent ? 'bg-primary/5 border border-primary/20' : 'hover:bg-muted/30'}`}>
              {/* Step indicator */}
              <div className={`h-7 w-7 rounded-full border-2 flex items-center justify-center shrink-0 text-xs font-bold ${blockColors[step.block]} text-white`}>
                {isDone ? <CheckCircle2 className="h-4 w-4" /> : step.day}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`text-sm font-medium ${isDone ? 'line-through text-muted-foreground' : ''}`}>
                    {step.label}
                  </p>
                  {isCurrent && <Badge className="text-xs bg-primary/15 text-primary border-0">Hoje</Badge>}
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {step.channels.map(ch => (
                    <span key={ch} className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{ch}</span>
                  ))}
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">{step.personas.join(', ')}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Interactions Tab ─────────────────────────────────────

function InteractionFeed({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const { data: interactions = [], isLoading } = useQuery({
    queryKey: ['interactions', companyId],
    queryFn: () => getInteractions(companyId),
  });

  useEffect(() => {
    const channel = supabase
      .channel(`company-interactions-${companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'interactions',
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ['interactions', companyId] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, qc]);

  const typeIcon: Record<string, React.ElementType> = {
    whatsapp_sent: MessageSquare, whatsapp_received: MessageSquare,
    call_made: Phone, call_received: Phone,
    linkedin_sent: Linkedin, linkedin_received: Linkedin,
    meeting: Users, note: AlertCircle,
    phase0_test: BarChart3, cadence_step: Zap,
  };

  const typeLabel: Record<string, string> = {
    whatsapp_sent: 'WhatsApp enviado', whatsapp_received: 'WhatsApp recebido',
    call_made: 'Ligação feita', call_received: 'Ligação recebida',
    linkedin_sent: 'LinkedIn enviado', linkedin_received: 'LinkedIn recebido',
    meeting: 'Reunião', note: 'Nota',
    phase0_test: 'Lead oculto (Fase 0)', cadence_step: 'Passo de cadência',
  };

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (interactions.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Nenhuma interação registrada.</p>
        <p className="text-xs mt-1">As interações aparecem conforme você executa a cadência.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {interactions.map((i: Interaction) => {
        const Icon = typeIcon[i.interaction_type] || MessageSquare;
        return (
          <div key={i.id} className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium">{typeLabel[i.interaction_type] || i.interaction_type}</p>
                {i.contact?.name && <span className="text-xs text-muted-foreground">→ {i.contact.name}</span>}
                {(typeof i.metadata?.source === 'string' || typeof i.metadata?.provider === 'string') && (
                  <Badge variant="outline" className="text-[10px] h-5">
                    {String(i.metadata?.source || i.metadata?.provider)}
                  </Badge>
                )}
              </div>
              {i.content && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{i.content}</p>}
              {i.summary && <p className="text-xs text-primary mt-0.5 italic">{i.summary}</p>}
              <p className="text-xs text-muted-foreground/60 mt-1">
                {new Date(i.created_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────

export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [launchFormOpen, setLaunchFormOpen] = useState(false);
  const [editingLaunch, setEditingLaunch] = useState<CompanyLaunch | null>(null);
  const [signalManagerOpen, setSignalManagerOpen] = useState(false);
  const [contactFormOpen, setContactFormOpen] = useState(false);

  const { data: company, isLoading } = useQuery({
    queryKey: ['company', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*, owner:profiles(id, name)')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as Company;
    },
    enabled: !!id,
  });

  const refreshAutomationQueries = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['company', id] }),
      qc.invalidateQueries({ queryKey: ['companies'] }),
      qc.invalidateQueries({ queryKey: ['account-signals', id] }),
      qc.invalidateQueries({ queryKey: ['interactions', id] }),
      qc.invalidateQueries({ queryKey: ['daily-tasks'] }),
      qc.invalidateQueries({ queryKey: ['abm-stats'] }),
      qc.invalidateQueries({ queryKey: ['account-stats'] }),
    ]);

  const simulateReplyMutation = useMutation({
    mutationFn: async () => {
      if (!company) throw new Error('Conta nao carregada.');
      const primaryContact = contacts[0];
      if (!primaryContact) {
        throw new Error('Adicione pelo menos 1 pessoa-chave para testar o reply automatico.');
      }

      return invokeAutomationWebhook({
        kind: 'whatsapp_message',
        integration_name: 'whatsapp',
        source: 'whatsapp',
        external_event_id: `sim-whatsapp-${company.id}-${Date.now()}`,
        timestamp: new Date().toISOString(),
        company_id: company.id,
        contact_id: primaryContact.id,
        whatsapp: {
          direction: 'inbound',
          phone: primaryContact.whatsapp || '+55 11 99999-0000',
          message: 'Oi Renan, vi seu diagnostico. Podemos falar na semana que vem?',
          contact_name: primaryContact.name,
          contact_role: primaryContact.role || 'Diretor Comercial',
          summary: 'Lead respondeu pelo WhatsApp e pediu continuidade da conversa na proxima semana.',
          next_step: 'Responder hoje com 2 opcoes de horario para uma call de 15 min.',
          create_followup_task: true,
          signal_hints: ['vgv_pressure'],
        },
      });
    },
    onSuccess: async () => {
      await refreshAutomationQueries();
      toast.success('Reply automatico processado na conta.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const simulateSignalMutation = useMutation({
    mutationFn: async () => {
      if (!company) throw new Error('Conta nao carregada.');
      return invokeAutomationWebhook({
        kind: 'market_signal',
        integration_name: 'n8n',
        source: 'n8n',
        external_event_id: `sim-signal-${company.id}-${Date.now()}`,
        timestamp: new Date().toISOString(),
        company_id: company.id,
        company: {
          name: company.name,
          domain: company.domain || undefined,
        },
        market_signal: {
          type: 'new_launch',
          source: 'news',
          confidence: 0.91,
          description: `${company.name} sinalizou um novo lancamento previsto para os proximos 90 dias.`,
          create_followup_task: true,
          metadata: {
            channel: 'demo',
          },
        },
        company_updates: {
          upcoming_launch: true,
          domain: company.domain || undefined,
        },
      });
    },
    onSuccess: async () => {
      await refreshAutomationQueries();
      toast.success('Sinal de mercado processado automaticamente.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const { data: launches = [] } = useQuery({
    queryKey: ['launches', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('company_launches')
        .select('*')
        .eq('company_id', id!)
        .order('status');
      return (data || []) as CompanyLaunch[];
    },
    enabled: !!id,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts-by-company', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('contacts')
        .select('*')
        .eq('company_id', id!)
        .in('role', ['Dir. Comercial', 'Diretor Comercial', 'Gerente de Vendas', 'CMO', 'Sócio', 'CEO', 'Co-Founder', 'Founder']);
      return (data || []) as Contact[];
    },
    enabled: !!id,
  });

  const { data: signals = [] } = useQuery({
    queryKey: ['account-signals', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('account_signals')
        .select('*')
        .eq('company_id', id!)
        .order('detected_at', { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`company-score-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'companies',
          filter: `id=eq.${id}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ['company', id] });
          qc.invalidateQueries({ queryKey: ['companies'] });
          qc.invalidateQueries({ queryKey: ['account-stats'] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, qc]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-32 w-full" />
      </DashboardLayout>
    );
  }

  if (!company) {
    return (
      <DashboardLayout>
        <p className="text-muted-foreground">Conta não encontrada.</p>
      </DashboardLayout>
    );
  }

  const signal = company.buying_signal || 'cold';
  const signalCfg = SIGNAL_CFG[signal];
  const SignalIcon = signalCfg.icon;

  function handleAddLaunch() {
    setEditingLaunch(null);
    setLaunchFormOpen(true);
  }

  function handleEditLaunch(launch: CompanyLaunch) {
    setEditingLaunch(launch);
    setLaunchFormOpen(true);
  }

  function handleLaunchFormOpenChange(open: boolean) {
    setLaunchFormOpen(open);
    if (!open) setEditingLaunch(null);
  }

  return (
    <DashboardLayout>
      {/* Back */}
      <button onClick={() => navigate('/crm/empresas')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Voltar para Contas
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-lg font-bold text-primary">{company.name.slice(0, 2).toUpperCase()}</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold">{company.name}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`flex items-center gap-1 text-sm font-medium ${signalCfg.style}`}>
                <SignalIcon className="h-4 w-4" /> {signalCfg.label}
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="text-sm text-muted-foreground">{company.segment || 'Incorporadora'}</span>
              {company.city && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-sm text-muted-foreground">{company.city}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Can admin>
            <Button variant="outline" size="sm" className="gap-1" onClick={() => setSignalManagerOpen(true)}>
              <Zap className="h-3.5 w-3.5" /> Sinais
            </Button>
          </Can>
          {company.website && (
            <a href={company.website} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm" className="gap-1">
                <Globe className="h-3.5 w-3.5" /> Site
              </Button>
            </a>
          )}
          {company.linkedin_url && (
            <a href={company.linkedin_url} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm" className="gap-1">
                <Linkedin className="h-3.5 w-3.5" /> LinkedIn
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'VGV Projetado', value: fmtVGV(company.vgv_projected), icon: TrendingUp },
          { label: 'Score', value: `${company.score_tier || 'C'} · ${company.icp_score || 0}/100`, icon: BarChart3 },
          { label: 'Lançamentos', value: `${launches.length}`, icon: Rocket },
          { label: 'Contatos', value: `${contacts.length}`, icon: Users },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Pessoas-chave</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">Conta primeiro, pessoas logo abaixo.</p>
                </div>
                <Can admin>
                  <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => setContactFormOpen(true)}>
                    <Plus className="h-4 w-4" /> Adicionar contato
                  </Button>
                </Can>
              </div>
            </CardHeader>
            <CardContent>
              {contacts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhuma pessoa-chave encontrada.</p>
                  <p className="text-xs mt-1">Adicione diretor comercial, CMO, CEO ou sócio.</p>
                </div>
              ) : (
                <div>{contacts.map(c => <ContactRow key={c.id} contact={c} />)}</div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Lançamentos</h2>
                <p className="text-sm text-muted-foreground">Visão direta dos empreendimentos da conta.</p>
              </div>
              <Can admin>
                <Button type="button" size="sm" className="gap-1.5" onClick={handleAddLaunch}>
                  <Plus className="h-4 w-4" /> Adicionar lançamento
                </Button>
              </Can>
            </div>

            {launches.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  <Rocket className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhum lançamento cadastrado.</p>
                </CardContent>
              </Card>
            ) : (
              launches.map((launch) => (
                <LaunchCard
                  key={launch.id}
                  launch={launch}
                  onEdit={handleEditLaunch}
                  canEdit={isAdmin}
                />
              ))
            )}
          </div>

          <WhatsAppTimeline
            companyId={company.id}
            compact
            storageKey={`whatsapp-company-${company.id}`}
            title="WhatsApp"
            description="Historico capturado pela extensao, com mensagens, audio e transcricao quando existir."
          />

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Interações recentes</CardTitle>
            </CardHeader>
            <CardContent>
              <InteractionFeed companyId={company.id} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Cadência</CardTitle>
            </CardHeader>
            <CardContent>
              <CadenceTimeline company={company} contacts={contacts} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Contexto da conta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Modelo comercial</p>
                <p className="text-sm font-medium">{company.sales_model || 'Não informado'}</p>
              </div>
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Mídia mensal</p>
                <p className="text-sm font-medium">{fmtVGV(company.monthly_media_spend)}</p>
              </div>
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Sinais registrados</p>
                <p className="text-sm font-medium">{signals.length}</p>
              </div>
              <Can admin>
                <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={() => setSignalManagerOpen(true)}>
                  <Zap className="h-4 w-4" /> Gerenciar sinais
                </Button>
              </Can>
            </CardContent>
          </Card>

          <Can admin>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Automações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Teste o pipeline automático desta conta: evento bruto → interação → sinal/tarefa → atualização do CRM.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5"
                  onClick={() => simulateReplyMutation.mutate()}
                  disabled={simulateReplyMutation.isPending}
                >
                  <Play className="h-4 w-4" />
                  {simulateReplyMutation.isPending ? 'Processando reply…' : 'Simular reply no WhatsApp'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5"
                  onClick={() => simulateSignalMutation.mutate()}
                  disabled={simulateSignalMutation.isPending}
                >
                  <Zap className="h-4 w-4" />
                  {simulateSignalMutation.isPending ? 'Processando sinal…' : 'Simular sinal de mercado'}
                </Button>
              </CardContent>
            </Card>
          </Can>
        </div>
      </div>

      {isAdmin && (
        <LaunchForm
          open={launchFormOpen}
          onOpenChange={handleLaunchFormOpenChange}
          companyId={company.id}
          launch={editingLaunch}
        />
      )}
      {isAdmin && (
        <SignalManager
          open={signalManagerOpen}
          onOpenChange={setSignalManagerOpen}
          companyId={company.id}
        />
      )}
      <ContactForm
        open={contactFormOpen}
        onOpenChange={setContactFormOpen}
        defaultCompanyId={company.id}
      />
    </DashboardLayout>
  );
}
