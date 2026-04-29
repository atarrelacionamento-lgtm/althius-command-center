import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft, Building2, Mail, Phone, MessageCircle, Linkedin,
  Sparkles, Pencil, ExternalLink, User, Calendar, Briefcase, Loader2,
  AlertCircle, X, RotateCcw,
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ContactForm } from '@/components/crm/ContactForm';
import { Can } from '@/components/Can';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getContact } from '@/services/crmService';
import { revealContactPhone } from '@/services/apolloService';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const WATERFALL_TIMEOUT_MS = 90 * 1000;

function toWhatsAppHref(value: string) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits.startsWith('55') ? digits : `55${digits}`}`;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

const SENIORITY_LABEL: Record<string, string> = {
  owner: 'Sócio / Dono',
  founder: 'Founder',
  c_suite: 'C-Level',
  vp: 'VP',
  head: 'Head',
  director: 'Diretor',
  manager: 'Gerente',
  senior: 'Sênior',
  entry: 'Pleno/Júnior',
  intern: 'Estagiário',
};

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [waterfallUntil, setWaterfallUntil] = useState<number | null>(null);
  const [waterfallStartedAt, setWaterfallStartedAt] = useState<number | null>(null);
  const [waterfallResult, setWaterfallResult] = useState<'not_found' | null>(null);
  const [now, setNow] = useState(Date.now());

  const { data: contact, isLoading, refetch } = useQuery({
    queryKey: ['contact', id],
    queryFn: () => getContact(id!),
    enabled: !!id,
  });

  const revealPhoneMutation = useMutation({
    mutationFn: () => revealContactPhone(id!),
    onSuccess: (res) => {
      if (res.phone) {
        toast.success(`Telefone encontrado: ${res.phone}`);
        qc.invalidateQueries({ queryKey: ['contact', id] });
        qc.invalidateQueries({ queryKey: ['contacts'] });
      } else if (res.waterfall_pending) {
        const start = Date.now();
        setWaterfallStartedAt(start);
        setWaterfallUntil(start + WATERFALL_TIMEOUT_MS);
        setWaterfallResult(null);
      } else {
        toast.warning(res.message);
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  useEffect(() => {
    if (!waterfallUntil) return;
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [waterfallUntil]);

  useEffect(() => {
    if (waterfallUntil && now >= waterfallUntil) {
      setWaterfallUntil(null);
      setWaterfallStartedAt(null);
      setWaterfallResult('not_found');
    }
  }, [now, waterfallUntil]);

  useEffect(() => {
    if (!waterfallUntil || !id) return;
    const ch = supabase
      .channel(`contact-${id}-waterfall`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'contacts', filter: `id=eq.${id}` },
        (payload) => {
          const n = payload.new as { phone?: string | null; whatsapp?: string | null; email?: string | null };
          if (n.phone || n.whatsapp || n.email) {
            toast.success('Dados do contato atualizados via waterfall!');
            setWaterfallUntil(null);
            setWaterfallStartedAt(null);
            setWaterfallResult(null);
            qc.invalidateQueries({ queryKey: ['contact', id] });
            qc.invalidateQueries({ queryKey: ['contacts'] });
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [waterfallUntil, id, qc]);

  const waitingSeconds = waterfallUntil ? Math.max(0, Math.ceil((waterfallUntil - now) / 1000)) : 0;
  const waitingLabel = waterfallUntil
    ? `${Math.floor(waitingSeconds / 60)}:${String(waitingSeconds % 60).padStart(2, '0')}`
    : null;
  const waitingProgress = waterfallUntil && waterfallStartedAt
    ? Math.min(100, Math.max(0, 100 * ((now - waterfallStartedAt) / WATERFALL_TIMEOUT_MS)))
    : 0;

  if (isLoading) {
    return (
      <DashboardLayout>
        {/* Back button */}
        <Skeleton className="mb-4 h-8 w-24" />

        {/* Header card */}
        <div className="mb-6 flex flex-col gap-4 rounded-xl border bg-card p-5 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4 flex-1">
            <Skeleton className="h-14 w-14 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-7 w-56" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <Skeleton className="h-8 w-20" />
        </div>

        {/* 2-col grid */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg border bg-background px-3 py-2.5">
                  <Skeleton className="mt-0.5 h-4 w-4 shrink-0 rounded" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-28" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (!contact) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <User className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <h1 className="text-lg font-semibold">Contato não encontrado</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pode ter sido removido.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/crm/contatos')}>
            Voltar para contatos
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const waHref = contact.whatsapp ? toWhatsAppHref(contact.whatsapp) : null;
  const phoneHref = contact.phone ? toWhatsAppHref(contact.phone) : null;
  const canEnrich = !!(contact.apollo_person_id || contact.linkedin_url || contact.email);

  return (
    <DashboardLayout>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/crm/contatos')}
        className="mb-4 -ml-2 h-8 gap-1.5 text-muted-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar
      </Button>

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 rounded-xl border bg-card p-5 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
            {initials(contact.name)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-bold">{contact.name}</h1>
              {contact.enrichment_source && (
                <Badge variant="outline" className="gap-1 border-primary/40 text-primary">
                  <Sparkles className="h-3 w-3" />
                  {contact.enrichment_source === 'apollo' ? 'Apollo' :
                   contact.enrichment_source === 'apollo_waterfall' ? 'Apollo + waterfall' :
                   contact.enrichment_source}
                </Badge>
              )}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {contact.role || 'Cargo não informado'}
              {contact.seniority && (
                <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">
                  {SENIORITY_LABEL[contact.seniority] ?? contact.seniority}
                </span>
              )}
            </p>
            {contact.company && (
              <button
                type="button"
                onClick={() => navigate(`/crm/empresas/${contact.company!.id}`)}
                className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary hover:underline"
              >
                <Building2 className="h-3.5 w-3.5" />
                {contact.company.name}
                <ExternalLink className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
        <Can admin>
          <Button size="sm" variant="outline" onClick={() => setEditOpen(true)} className="gap-1.5">
            <Pencil className="h-3.5 w-3.5" /> Editar
          </Button>
        </Can>
      </div>

      {waterfallUntil && (
        <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                Enriquecendo contato via Apollo waterfall…
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Datagma / Cognism buscando telefone e e-mail. Isso costuma levar até 60s.
              </p>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-primary/10">
                <div
                  className="h-full bg-primary transition-[width] duration-1000 ease-linear"
                  style={{ width: `${waitingProgress}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs font-medium tabular-nums text-primary">
                {waitingLabel} restantes
              </p>
            </div>
          </div>
        </div>
      )}

      {waterfallResult === 'not_found' && !waterfallUntil && (
        <div className="mb-4 rounded-lg border border-amber-300/60 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                Não encontramos dados adicionais
              </p>
              <p className="mt-0.5 text-xs text-amber-800/80 dark:text-amber-300/80">
                Datagma/Cognism não retornaram telefone ou e-mail para este contato.
                Você pode tentar novamente mais tarde — as bases são atualizadas com frequência.
              </p>
              <div className="mt-2.5 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setWaterfallResult(null);
                    revealPhoneMutation.mutate();
                  }}
                  disabled={revealPhoneMutation.isPending}
                  className="h-7 gap-1.5 border-amber-400 bg-white text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-transparent dark:text-amber-200"
                >
                  <RotateCcw className="h-3 w-3" /> Tentar novamente
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setWaterfallResult(null)}
                  className="h-7 gap-1.5 text-amber-800 hover:bg-amber-100 dark:text-amber-300"
                >
                  <X className="h-3 w-3" /> Fechar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Contato */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Phone className="h-4 w-4 text-primary" /> Canais de contato
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ContactRow
              icon={Mail}
              label="E-mail"
              value={contact.email}
              href={contact.email ? `mailto:${contact.email}` : null}
              canEnrich={canEnrich}
              enriching={revealPhoneMutation.isPending}
              onEnrich={() => revealPhoneMutation.mutate()}
              waitingLabel={waitingLabel}
            />
            <ContactRow
              icon={MessageCircle}
              label="WhatsApp"
              value={contact.whatsapp ?? contact.phone}
              href={waHref ?? phoneHref}
              hrefLabel="Abrir conversa"
              canEnrich={canEnrich}
              enriching={revealPhoneMutation.isPending}
              onEnrich={() => revealPhoneMutation.mutate()}
              waitingLabel={waitingLabel}
            />
            <ContactRow
              icon={Linkedin}
              label="LinkedIn"
              value={contact.linkedin_url}
              href={contact.linkedin_url}
              hrefLabel="Abrir perfil"
              external
            />
          </CardContent>
        </Card>

        {/* Meta */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Briefcase className="h-4 w-4 text-primary" /> Metadados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <MetaRow label="Empresa" value={contact.company?.name ?? '—'} />
            <MetaRow label="Cargo" value={contact.role ?? '—'} />
            <MetaRow label="Senioridade" value={contact.seniority ? (SENIORITY_LABEL[contact.seniority] ?? contact.seniority) : '—'} />
            <MetaRow label="Departamentos" value={contact.departments?.length ? contact.departments.join(', ') : '—'} />
            <MetaRow label="Responsável" value={contact.owner?.name ?? '—'} />
            <MetaRow label="Origem" value={contact.source ?? '—'} />
            <MetaRow
              label="Criado em"
              value={format(new Date(contact.created_at), "dd/MM/yyyy", { locale: ptBR })}
            />
            {contact.enriched_at && (
              <MetaRow
                label="Enriquecido em"
                icon={Calendar}
                value={format(new Date(contact.enriched_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <ContactForm
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) refetch();
        }}
        contact={contact}
      />
    </DashboardLayout>
  );
}

function ContactRow({
  icon: Icon,
  label,
  value,
  href,
  hrefLabel = 'Abrir',
  external,
  canEnrich,
  enriching,
  onEnrich,
  waitingLabel,
}: {
  icon: React.ElementType;
  label: string;
  value: string | null | undefined;
  href?: string | null;
  hrefLabel?: string;
  external?: boolean;
  canEnrich?: boolean;
  enriching?: boolean;
  onEnrich?: () => void;
  waitingLabel?: string | null;
}) {
  const hasValue = !!value;
  const isWaiting = !hasValue && !!waitingLabel;
  const showEnrichButton = !hasValue && canEnrich && !!onEnrich && !isWaiting;
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-background px-3 py-2.5">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${hasValue ? 'text-primary' : 'text-muted-foreground/40'}`} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={`truncate text-sm ${hasValue ? 'font-medium' : 'text-muted-foreground'}`}>
          {value ?? (isWaiting ? 'Buscando na waterfall…' : 'Não informado')}
        </p>
      </div>
      {hasValue && href && (
        <a
          href={href}
          target={external ? '_blank' : undefined}
          rel={external ? 'noreferrer' : undefined}
          className="shrink-0 text-xs text-primary hover:underline"
        >
          {hrefLabel}
        </a>
      )}
      {isWaiting && (
        <div
          className="shrink-0 inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary"
          title="Apollo waterfall em andamento"
        >
          <Loader2 className="h-3 w-3 animate-spin" />
          <span className="tabular-nums">{waitingLabel}</span>
        </div>
      )}
      {showEnrichButton && (
        <button
          type="button"
          onClick={onEnrich}
          disabled={enriching}
          title="Enriquecer com Apollo"
          className="shrink-0 rounded-md p-1.5 text-primary transition hover:bg-primary/10 disabled:opacity-50"
        >
          {enriching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
        </button>
      )}
    </div>
  );
}

function MetaRow({ label, value, icon: Icon }: { label: string; value: string; icon?: React.ElementType }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}
