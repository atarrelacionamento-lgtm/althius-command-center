import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  Linkedin,
  MessageSquare,
  Phone,
  Plus,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Can } from "@/components/Can";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getCompanies, getContactsByCompany } from "@/services/crmService";
import { listSequences } from "@/services/sequencesService";
import { startCadenceForContacts } from "@/services/abmService";
import { inferPersonaFromRole, PERSONA_PLAYBOOK, PIPA_21_DAY_CADENCE } from "@/lib/pipaGtm";
import type { Contact, Sequence } from "@/types";

const CHANNEL_ICON = {
  whatsapp: MessageSquare,
  linkedin: Linkedin,
  phone: Phone,
  email: MessageSquare,
};

function ContactSelector({
  contacts,
  selectedIds,
  onToggle,
}: {
  contacts: Contact[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  if (contacts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
        <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
        <p className="text-sm">Nenhuma pessoa cadastrada para esta conta.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-2 md:grid-cols-2">
      {contacts.map((contact) => {
        const persona = inferPersonaFromRole(contact.role);
        const playbook = PERSONA_PLAYBOOK[persona];
        const checked = selectedIds.includes(contact.id);
        return (
          <button
            key={contact.id}
            type="button"
            onClick={() => onToggle(contact.id)}
            className={`rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted/40 ${checked ? "border-primary bg-primary/5" : ""}`}
          >
            <div className="flex items-start gap-3">
              <Checkbox checked={checked} className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold">{contact.name}</p>
                  <Badge variant="outline">{playbook.label}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{contact.role || "Cargo nao informado"}</p>
                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{playbook.pain}</p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function CadencePreview() {
  return (
    <div className="space-y-2">
      {PIPA_21_DAY_CADENCE.map((step) => {
        const Icon = CHANNEL_ICON[step.channel];
        return (
          <div key={`${step.day}-${step.label}-${step.channel}`} className="flex items-start gap-3 rounded-lg border bg-card p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">Dia {step.day}</Badge>
                <Badge variant="outline">Bloco {step.block}</Badge>
                <p className="text-sm font-medium">{step.label}</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {step.personas.map((persona) => PERSONA_PLAYBOOK[persona].label).join(", ")}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SequenceLibrary({ sequences, isLoading }: { sequences: Sequence[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-32 rounded-xl" />
        ))}
      </div>
    );
  }

  if (sequences.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
        <Workflow className="mx-auto mb-2 h-8 w-8 opacity-40" />
        <p className="text-sm">Nenhum template customizado criado.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {sequences.map((sequence) => (
        <Card key={sequence.id}>
          <CardContent className="p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{sequence.name}</p>
                <p className="text-xs text-muted-foreground">{sequence.steps?.length ?? 0} steps</p>
              </div>
              <Badge variant={sequence.active ? "default" : "secondary"}>
                {sequence.active ? "Ativa" : "Inativa"}
              </Badge>
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>{sequence.funnel?.name ?? "Sem funil"}</p>
              <p>{sequence.stage?.name ?? "Sem estagio"}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function SequenciasPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [companyId, setCompanyId] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);

  const { data: companies = [], isLoading: loadingCompanies } = useQuery({
    queryKey: ["companies"],
    queryFn: () => getCompanies(),
  });

  const selectedCompany = companies.find((company) => company.id === companyId) ?? null;

  const { data: contacts = [], isLoading: loadingContacts } = useQuery({
    queryKey: ["contacts-by-company", companyId],
    queryFn: () => getContactsByCompany(companyId),
    enabled: !!companyId,
  });

  const { data: sequences = [], isLoading: loadingSequences } = useQuery({
    queryKey: ["sequences"],
    queryFn: listSequences,
  });

  useEffect(() => {
    setSelectedContactIds([]);
  }, [companyId]);

  const selectedContacts = useMemo(
    () => contacts.filter((contact) => selectedContactIds.includes(contact.id)),
    [contacts, selectedContactIds],
  );

  const startMutation = useMutation({
    mutationFn: () =>
      startCadenceForContacts({
        companyId,
        companyName: selectedCompany?.name ?? "",
        contacts: selectedContacts.map((contact) => ({
          id: contact.id,
          name: contact.name,
          role: contact.role,
        })),
      }),
    onSuccess: (createdTasks) => {
      queryClient.invalidateQueries({ queryKey: ["daily-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["abm-stats"] });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast.success(`Sequencia iniciada com ${createdTasks} acoes.`);
      navigate("/hoje");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function toggleContact(id: string) {
    setSelectedContactIds((prev) =>
      prev.includes(id) ? prev.filter((contactId) => contactId !== id) : [...prev, id],
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Workflow className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">Sequencias</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadencias ABM por conta, com multiplas pessoas e execucao no Comando do Dia.
          </p>
        </div>
        <Can admin>
          <Button onClick={() => navigate("/sequencias/nova")} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo template
          </Button>
        </Can>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4 text-primary" />
                Conta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={companyId || "__none__"} onValueChange={(value) => setCompanyId(value === "__none__" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma conta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Selecione uma conta</SelectItem>
                  {loadingCompanies ? (
                    <SelectItem value="__loading__" disabled>
                      Carregando contas...
                    </SelectItem>
                  ) : (
                    companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4 text-primary" />
                  Pessoas da conta
                </CardTitle>
                <Badge variant={selectedContactIds.length >= 2 ? "default" : "secondary"}>
                  {selectedContactIds.length} selecionadas
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {!companyId ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
                  <Building2 className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  <p className="text-sm">Selecione uma conta para carregar as pessoas.</p>
                </div>
              ) : loadingContacts ? (
                <div className="grid gap-2 md:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-24 rounded-xl" />
                  ))}
                </div>
              ) : (
                <ContactSelector contacts={contacts} selectedIds={selectedContactIds} onToggle={toggleContact} />
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">Pronto para iniciar</p>
              <p className="text-sm text-muted-foreground">
                Conta + pelo menos 2 pessoas geram tarefas nos dias 1, 3, 4, 5, 8, 12, 15 e 21.
              </p>
            </div>
            <Button
              disabled={!companyId || selectedContactIds.length < 2 || startMutation.isPending}
              onClick={() => startMutation.mutate()}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              {startMutation.isPending ? "Iniciando..." : "Iniciar sequencia"}
            </Button>
          </div>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Cadencia padrao Pipa
              </h2>
            </div>
            <CadencePreview />
          </section>
        </section>

        <aside className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Regra operacional
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p className="rounded-lg bg-muted/40 p-3">Sequencia sempre nasce de uma conta.</p>
              <p className="rounded-lg bg-muted/40 p-3">A cadencia precisa de pessoas no plural para ser multipersona.</p>
              <p className="rounded-lg bg-muted/40 p-3">As tarefas entram no Comando do Dia com mensagem personalizada.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-primary" />
                Ritmo GTM
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {[
                ["50", "contas/semana"],
                ["7", "dias Fase 0"],
                ["21", "dias cadencia"],
                ["4", "contratos/mes"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xl font-bold">{value}</p>
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>

      <section className="mt-8 space-y-3">
        <div className="flex items-center gap-2">
          <Workflow className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Templates customizados
          </h2>
        </div>
        <SequenceLibrary sequences={sequences} isLoading={loadingSequences} />
      </section>
    </DashboardLayout>
  );
}
