import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowUpDown,
  Building2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  DollarSign,
  Download,
  ExternalLink,
  Flame,
  Gauge,
  Handshake,
  Linkedin,
  Pencil,
  Plus,
  Rocket,
  Search,
  Snowflake,
  Sparkles,
  Thermometer,
  Trash2,
  TrendingUp,
  User,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { CompanyForm } from "@/components/crm/CompanyForm";
import { Can } from "@/components/Can";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Checkbox } from "@/components/ui/checkbox";
import { createDeal, deleteCompany, getCompaniesPage, getCompanyFilterOptions, getFunnels, type CompanySortKey } from "@/services/crmService";
import { enrichCompaniesBulk } from "@/services/apolloService";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import type { BuyingSignal, Company, CompanyStatus } from "@/types";
import { DEAL_STAGES } from "@/types";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const PAGE_SIZE = 25;

const STATUS_LABELS: Record<CompanyStatus, { label: string; color: string }> = {
  new: { label: "Nova", color: "bg-muted text-muted-foreground" },
  prospecting: { label: "Prospectando", color: "bg-blue-500/15 text-blue-600" },
  contacted: { label: "Contactada", color: "bg-purple-500/15 text-purple-600" },
  meeting_booked: { label: "Reuniao marcada", color: "bg-yellow-500/15 text-yellow-700" },
  proposal: { label: "Proposta", color: "bg-orange-500/15 text-orange-600" },
  customer: { label: "Cliente", color: "bg-green-500/15 text-green-600" },
  lost: { label: "Perdida", color: "bg-destructive/15 text-destructive" },
};

const STATUS_ORDER: CompanyStatus[] = [
  "new",
  "prospecting",
  "contacted",
  "meeting_booked",
  "proposal",
  "customer",
  "lost",
];

const SIGNAL_CONFIG: Record<
  BuyingSignal,
  { label: string; icon: React.ElementType; style: string; tier: string }
> = {
  hot: {
    label: "Burning",
    icon: Flame,
    style: "text-orange-500",
    tier: "bg-red-500/10 text-red-600 border-red-500/20",
  },
  warm: {
    label: "Morno",
    icon: Thermometer,
    style: "text-yellow-500",
    tier: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  },
  cold: {
    label: "Frio",
    icon: Snowflake,
    style: "text-blue-500",
    tier: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  },
};

function fmtMoneyCompact(value: number | null) {
  if (!value) return "-";
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`;
  return `R$ ${value.toLocaleString("pt-BR")}`;
}

const CSV_COLUMNS: Array<{ header: string; value: (c: Company) => string | number | null | undefined }> = [
  { header: "Nome", value: (c) => c.name },
  { header: "CNPJ", value: (c) => c.cnpj },
  { header: "Cidade", value: (c) => c.city },
  { header: "Estado", value: (c) => c.state },
  { header: "Segmento", value: (c) => c.segment },
  { header: "Status", value: (c) => STATUS_LABELS[c.status]?.label ?? c.status },
  { header: "Score ICP", value: (c) => c.icp_score },
  { header: "Tier", value: (c) => c.score_tier },
  { header: "Buying Signal", value: (c) => c.buying_signal },
  { header: "Modelo de vendas", value: (c) => c.sales_model },
  { header: "Lancamento ativo", value: (c) => (c.has_active_launch ? "Sim" : "Nao") },
  { header: "Lancamento previsto", value: (c) => (c.upcoming_launch ? "Sim" : "Nao") },
  { header: "Lancamentos no ano", value: (c) => c.launch_count_year },
  { header: "VGV projetado", value: (c) => c.vgv_projected },
  { header: "Midia mensal", value: (c) => c.monthly_media_spend },
  { header: "Funcionarios", value: (c) => c.employees_count },
  { header: "Fundacao", value: (c) => c.founded_year },
  { header: "Dominio", value: (c) => c.domain },
  { header: "Website", value: (c) => c.website },
  { header: "LinkedIn", value: (c) => c.linkedin_url },
  { header: "Instagram", value: (c) => c.instagram_url },
  { header: "Facebook", value: (c) => c.facebook_url },
  { header: "Responsavel", value: (c) => c.owner?.name },
  { header: "Ultima interacao", value: (c) => c.last_interaction_at },
  { header: "Criada em", value: (c) => c.created_at },
];

function csvEscape(value: unknown): string {
  if (value == null) return "";
  const str = String(value);
  if (/[",\n;]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function exportCompaniesCsv(companies: Company[]) {
  const header = CSV_COLUMNS.map((c) => csvEscape(c.header)).join(";");
  const rows = companies.map((c) => CSV_COLUMNS.map((col) => csvEscape(col.value(c))).join(";"));
  const csv = "\uFEFF" + [header, ...rows].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `contas-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const LOGO_SOURCES = (domain: string) => [
  `https://logo.clearbit.com/${domain}`,
  `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
];

function CompanyAvatar({ company }: { company: Company }) {
  const [attempt, setAttempt] = useState(0);
  const domain = company.domain || (() => {
    try {
      return company.website ? new URL(company.website).hostname.replace(/^www\./, '') : null;
    } catch {
      return null;
    }
  })();
  const sources = domain ? LOGO_SOURCES(domain) : [];
  const logoUrl = sources[attempt] ?? null;

  const initials = company.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border bg-muted overflow-hidden">
      {logoUrl ? (
        <img
          src={logoUrl}
          alt=""
          width={36}
          height={36}
          onError={() => setAttempt((a) => a + 1)}
          className="h-full w-full object-contain p-1"
        />
      ) : (
        <span className="text-xs font-bold text-muted-foreground">
          {initials || company.name.slice(0, 2).toUpperCase()}
        </span>
      )}
    </div>
  );
}

function ScoreBadge({ company }: { company: Company }) {
  const signal = company.buying_signal || "cold";
  const cfg = SIGNAL_CONFIG[signal];
  const Icon = cfg.icon;
  const signals: string[] = [];

  if (company.has_active_launch) signals.push("Lancamento ativo");
  if (company.upcoming_launch) signals.push("Lancamento previsto");
  if ((company.monthly_media_spend ?? 0) >= 20000) signals.push("Midia relevante");
  if (company.sales_model === "external" || company.sales_model === "hybrid") {
    signals.push("Corretores externos no modelo");
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`inline-flex cursor-default items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.tier}`}>
          <span>{company.score_tier || "C"}</span>
          <Icon className={`h-3 w-3 ${cfg.style}`} />
          <span>{cfg.label}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-64 p-3">
        <p className="mb-1 text-sm font-semibold">Score {company.icp_score || 0}/100</p>
        {signals.length > 0 ? (
          <div className="space-y-1">
            {signals.map((signalItem) => (
              <p key={signalItem} className="text-xs text-muted-foreground">
                {signalItem}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Sem sinais fortes registrados.</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

function AccountStats() {
  const { data, isLoading } = useQuery({
    queryKey: ["account-stats"],
    queryFn: async () => {
      const { data: stats } = await supabase.from("account_stats").select("*").single();
      return stats;
    },
  });

  const items = [
    { label: "Total de contas", value: data?.total_accounts, icon: Building2, color: "text-primary" },
    { label: "Burning", value: data?.burning_accounts, icon: Flame, color: "text-orange-500" },
    { label: "Lancamento ativo", value: data?.with_active_launch, icon: Rocket, color: "text-blue-500" },
    { label: "Em cadencia", value: data?.in_cadence, icon: TrendingUp, color: "text-green-500" },
  ];

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map(({ label, value, icon: Icon, color }) => (
        <div key={label} className="flex items-center gap-3 rounded-xl border bg-card p-4">
          <Icon className={`h-5 w-5 shrink-0 ${color}`} />
          <div>
            {isLoading ? <Skeleton className="mb-1 h-7 w-10" /> : <p className="text-2xl font-bold">{value ?? 0}</p>}
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Companies() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { profile } = useAuth();
  const [search, setSearch] = useState("");
  const [signalFilter, setSignalFilter] = useState("__all__");
  const [launchFilter, setLaunchFilter] = useState("__all__");
  const [statusFilter, setStatusFilter] = useState("__all__");
  const [cityFilter, setCityFilter] = useState("__all__");
  const [segmentFilter, setSegmentFilter] = useState("__all__");
  const [stateFilter, setStateFilter] = useState("__all__");
  const [sortBy, setSortBy] = useState<CompanySortKey>("icp_score");
  const [ascending, setAscending] = useState(false);
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [deleting, setDeleting] = useState<Company | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dealDialogOpen, setDealDialogOpen] = useState(false);
  const [dealFunnelId, setDealFunnelId] = useState<string>("");
  const [dealStage, setDealStage] = useState<string>(DEAL_STAGES[0]);

  const { data: filterOptions } = useQuery({
    queryKey: ["company-filter-options"],
    queryFn: getCompanyFilterOptions,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    setPage(1);
  }, [search, signalFilter, launchFilter, statusFilter, cityFilter, segmentFilter, stateFilter, sortBy, ascending]);

  const { data, isLoading } = useQuery({
    queryKey: ["companies-page", search, signalFilter, launchFilter, statusFilter, cityFilter, segmentFilter, stateFilter, sortBy, ascending, page],
    queryFn: () =>
      getCompaniesPage({
        search,
        signal: signalFilter,
        launch: launchFilter === "__all__" ? undefined : (launchFilter as "active" | "upcoming"),
        status: statusFilter,
        city: cityFilter,
        segment: segmentFilter,
        state: stateFilter,
        sortBy,
        ascending,
        page,
        pageSize: PAGE_SIZE,
      }),
  });

  const companies = data?.data ?? [];
  const count = data?.count ?? 0;
  const totalPages = Math.max(Math.ceil(count / PAGE_SIZE), 1);
  const firstRow = count === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastRow = Math.min(page * PAGE_SIZE, count);

  useEffect(() => {
    const channel = supabase
      .channel("companies-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "companies" }, () => {
        qc.invalidateQueries({ queryKey: ["companies-page"] });
        qc.invalidateQueries({ queryKey: ["companies"] });
        qc.invalidateQueries({ queryKey: ["account-stats"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "account_signals" }, () => {
        qc.invalidateQueries({ queryKey: ["companies-page"] });
        qc.invalidateQueries({ queryKey: ["companies"] });
        qc.invalidateQueries({ queryKey: ["account-stats"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCompany(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["companies-page"] });
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["account-stats"] });
      toast.success("Conta removida.");
      setDeleting(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const enrichMutation = useMutation({
    mutationFn: (ids: string[]) => enrichCompaniesBulk(ids, { maxContacts: 3, revealPhones: true }),
    onSuccess: ({ successes, failures }) => {
      const totalContacts = successes.reduce((acc, r) => acc + r.created, 0);
      const creditsUsed = successes.reduce((acc, r) => acc + (r.credits_used ?? 0), 0);
      if (successes.length) {
        toast.success(
          `Apollo: ${totalContacts} contato(s) enriquecido(s) em ${successes.length} empresa(s). ${creditsUsed} crédito(s) usado(s).`,
        );
      }
      if (failures.length) {
        toast.error(`Falha em ${failures.length} empresa(s). ${failures[0]?.error ?? ""}`);
      }
      setSelectedIds([]);
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["companies-page"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const { data: funnels = [] } = useQuery({
    queryKey: ["funnels"],
    queryFn: getFunnels,
    enabled: dealDialogOpen,
  });

  useEffect(() => {
    if (dealDialogOpen && !dealFunnelId && funnels.length > 0) {
      setDealFunnelId(funnels[0].id);
    }
  }, [dealDialogOpen, dealFunnelId, funnels]);

  const selectedCompanies = companies.filter((c) => selectedIds.includes(c.id));

  const createDealsMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.id) throw new Error("Sessão expirada.");
      const results = await Promise.allSettled(
        selectedCompanies.map((company) =>
          createDeal({
            title: `Negociação - ${company.name}`,
            value: company.vgv_projected ?? null,
            stage: dealStage,
            funnel_id: dealFunnelId || null,
            contact_id: null,
            company_id: company.id,
            owner_id: company.owner_id || profile.id,
            expected_close: null,
          }),
        ),
      );
      const created = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.length - created;
      return { created, failed };
    },
    onSuccess: ({ created, failed }) => {
      if (created > 0) toast.success(`${created} negociação(ões) criada(s) no pipeline.`);
      if (failed > 0) toast.error(`Falha ao criar ${failed} negociação(ões).`);
      setDealDialogOpen(false);
      setSelectedIds([]);
      qc.invalidateQueries({ queryKey: ["deals"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleExportCsv() {
    if (selectedCompanies.length === 0) return;
    exportCompaniesCsv(selectedCompanies);
    toast.success(`${selectedCompanies.length} conta(s) exportada(s).`);
  }

  function confirmDeleteCompany() {
    if (!deleting) return;
    deleteMutation.mutate(deleting.id);
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(company: Company, event: React.MouseEvent) {
    event.stopPropagation();
    setEditing(company);
    setFormOpen(true);
  }

  function goToCompany(company: Company) {
    navigate(`/crm/empresas/${company.id}`);
  }

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">Contas</h1>
          </div>
        </div>
        <Can admin>
          <Button onClick={openCreate} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Nova conta
          </Button>
        </Can>
      </div>

      <AccountStats />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar conta, cidade ou segmento"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={signalFilter} onValueChange={setSignalFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Score" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os scores</SelectItem>
            <SelectItem value="hot">Burning</SelectItem>
            <SelectItem value="warm">Morno</SelectItem>
            <SelectItem value="cold">Frio</SelectItem>
          </SelectContent>
        </Select>

        <Select value={launchFilter} onValueChange={setLaunchFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Lancamento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos lancamentos</SelectItem>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="upcoming">Previsto 6 meses</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos status</SelectItem>
            {STATUS_ORDER.map((status) => (
              <SelectItem key={status} value={status}>
                {STATUS_LABELS[status].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={cityFilter} onValueChange={setCityFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Cidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas as cidades</SelectItem>
            {(filterOptions?.cities ?? []).map((city) => (
              <SelectItem key={city} value={city}>{city}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={stateFilter} onValueChange={setStateFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os estados</SelectItem>
            {(filterOptions?.states ?? []).map((state) => (
              <SelectItem key={state} value={state}>{state}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={segmentFilter} onValueChange={setSegmentFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Segmento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos segmentos</SelectItem>
            {(filterOptions?.segments ?? []).map((seg) => (
              <SelectItem key={seg} value={seg}>{seg}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(value) => setSortBy(value as CompanySortKey)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="icp_score">Score ICP</SelectItem>
            <SelectItem value="name">Nome</SelectItem>
            <SelectItem value="vgv_projected">VGV projetado</SelectItem>
            <SelectItem value="monthly_media_spend">Midia mensal</SelectItem>
            <SelectItem value="created_at">Criacao</SelectItem>
          </SelectContent>
        </Select>

        <Button type="button" variant="outline" size="icon" onClick={() => setAscending((prev) => !prev)}>
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      </div>

      {selectedIds.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-medium">{selectedIds.length} conta(s) selecionada(s)</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="gap-1.5"
              disabled={enrichMutation.isPending}
              onClick={() => enrichMutation.mutate(selectedIds)}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {enrichMutation.isPending ? "Enriquecendo..." : "Enriquecer com Apollo"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setDealDialogOpen(true)}
            >
              <Handshake className="h-3.5 w-3.5" />
              Criar negociação
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={handleExportCsv}
            >
              <Download className="h-3.5 w-3.5" />
              Exportar CSV
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
              Limpar
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border/60 bg-muted/30 hover:bg-muted/30">
                <TableHead className="h-9 w-10 pl-4 pr-0">
                  <Checkbox
                    checked={selectedIds.length > 0 && selectedIds.length === companies.length}
                    onCheckedChange={(checked) => {
                      setSelectedIds(checked ? companies.map((c) => c.id) : []);
                    }}
                    aria-label="Selecionar todas"
                  />
                </TableHead>
                <TableHead className="h-9 text-xs font-medium text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" /> Conta
                  </div>
                </TableHead>
                <TableHead className="h-9 text-xs font-medium text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <CircleDot className="h-3.5 w-3.5" /> Status
                  </div>
                </TableHead>
                <TableHead className="h-9 text-xs font-medium text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Gauge className="h-3.5 w-3.5" /> Score
                  </div>
                </TableHead>
                <TableHead className="h-9 text-xs font-medium text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" /> Responsavel
                  </div>
                </TableHead>
                <TableHead className="h-9 text-xs font-medium text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5" /> VGV
                  </div>
                </TableHead>
                <TableHead className="h-9 text-xs font-medium text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Rocket className="h-3.5 w-3.5" /> Lancamentos recentes
                  </div>
                </TableHead>
                <TableHead className="h-9 text-xs font-medium text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" /> Qtd lancamentos
                  </div>
                </TableHead>
                <TableHead className="h-9 w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 8 }).map((_, index) => (
                  <TableRow key={index} className="border-b border-border/40">
                    {Array.from({ length: 9 }).map((__, cellIndex) => (
                      <TableCell key={cellIndex} className="py-2">
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}

              {!isLoading && companies.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-12 text-center text-muted-foreground">
                    <Building2 className="mx-auto mb-2 h-8 w-8 opacity-30" />
                    <p>Nenhuma conta encontrada.</p>
                  </TableCell>
                </TableRow>
              )}

              {companies.map((company) => {
                const status = company.status || "new";
                const statusCfg = STATUS_LABELS[status];
                const signal = company.buying_signal || "cold";
                const signalCfg = SIGNAL_CONFIG[signal];
                const isBurning = signal === "hot";
                const isSelected = selectedIds.includes(company.id);
                return (
                  <TableRow
                    key={company.id}
                    data-state={isSelected ? "selected" : undefined}
                    className="cursor-pointer border-b border-border/40 hover:bg-muted/40 data-[state=selected]:bg-primary/5"
                    onClick={() => goToCompany(company)}
                  >
                    <TableCell className="w-10 py-2 pl-4 pr-0" onClick={(event) => event.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => {
                          setSelectedIds((prev) =>
                            checked ? [...prev, company.id] : prev.filter((id) => id !== company.id),
                          );
                        }}
                        aria-label={`Selecionar ${company.name}`}
                      />
                    </TableCell>
                    <TableCell className="py-2">
                      <HoverCard openDelay={120} closeDelay={80}>
                        <HoverCardTrigger asChild>
                          <div className="flex items-center gap-2">
                            <CompanyAvatar company={company} />
                            <span className="truncate text-sm font-medium hover:underline">
                              {company.name}
                            </span>
                          </div>
                        </HoverCardTrigger>
                        <HoverCardContent
                          side="right"
                          align="start"
                          className="w-80 p-0"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <div className="flex items-start gap-3 border-b border-border/60 p-4">
                            <CompanyAvatar company={company} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <p className="truncate text-sm font-semibold">{company.name}</p>
                                {isBurning && (
                                  <span className="inline-block animate-flame text-base leading-none">🔥</span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {company.score_tier || "C"} · {signalCfg.label} · {company.icp_score || 0}/100
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Owned by <span className="font-medium text-foreground">{company.owner?.name || "Nao atribuido"}</span>
                              </p>
                            </div>
                          </div>
                          <div className="space-y-2 p-4 text-sm">
                            <div className="flex items-center justify-between gap-2">
                              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <CircleDot className="h-3.5 w-3.5" /> Status
                              </span>
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusCfg.color}`}>
                                {statusCfg.label}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Linkedin className="h-3.5 w-3.5" /> LinkedIn
                              </span>
                              {company.linkedin_url ? (
                                <a
                                  href={company.linkedin_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                >
                                  Abrir <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <ExternalLink className="h-3.5 w-3.5" /> Site
                              </span>
                              {company.website ? (
                                <a
                                  href={company.website}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                >
                                  {(() => {
                                    try {
                                      return new URL(company.website).hostname.replace(/^www\./, "");
                                    } catch {
                                      return "Abrir";
                                    }
                                  })()}
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <User className="h-3.5 w-3.5" /> Responsavel
                              </span>
                              <span className="text-xs">{company.owner?.name || "-"}</span>
                            </div>
                          </div>
                        </HoverCardContent>
                      </HoverCard>
                    </TableCell>
                    <TableCell className="py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusCfg.color}`}>
                        {statusCfg.label}
                      </span>
                    </TableCell>
                    <TableCell className="py-2" onClick={(event) => event.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        <ScoreBadge company={company} />
                        {isBurning && (
                          <span className="inline-block animate-flame text-base leading-none" title="Burning">
                            🔥
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      <span className="text-sm text-muted-foreground">{company.owner?.name || "-"}</span>
                    </TableCell>
                    <TableCell className="py-2">
                      <span className="text-sm tabular-nums">{fmtMoneyCompact(company.vgv_projected)}</span>
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="flex items-center gap-1.5 text-xs">
                        {company.has_active_launch && (
                          <span className="rounded-full bg-green-500/10 px-2 py-0.5 font-medium text-green-600">
                            Ativo
                          </span>
                        )}
                        {company.upcoming_launch && (
                          <span className="rounded-full bg-blue-500/10 px-2 py-0.5 font-medium text-blue-600">
                            Previsto
                          </span>
                        )}
                        {!company.has_active_launch && !company.upcoming_launch && (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      <span className="text-sm tabular-nums">{company.launch_count_year ?? 0}</span>
                    </TableCell>
                    <TableCell className="py-2 pr-3" onClick={(event) => event.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 hover:opacity-100">
                        <Can admin>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(event) => openEdit(company, event)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={(event) => {
                              event.stopPropagation();
                              setDeleting(company);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </Can>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {firstRow}-{lastRow} de {count} contas - 25 por pagina
        </p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((prev) => prev - 1)}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
          </Button>
          <span className="min-w-24 text-center text-sm text-muted-foreground">
            Pagina {page} de {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((prev) => prev + 1)}
          >
            Proxima <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>

      <CompanyForm open={formOpen} onOpenChange={setFormOpen} company={editing} />

      <Dialog open={dealDialogOpen} onOpenChange={setDealDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Criar negociação em lote</DialogTitle>
            <DialogDescription>
              Uma negociação será criada no pipeline para cada uma das {selectedCompanies.length} conta(s) selecionada(s).
              O VGV projetado da conta é usado como valor inicial.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Funil</Label>
              <Select value={dealFunnelId || "__none__"} onValueChange={(v) => setDealFunnelId(v === "__none__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um funil" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Sem funil —</SelectItem>
                  {funnels.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Estágio inicial</Label>
              <Select value={dealStage} onValueChange={setDealStage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEAL_STAGES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDealDialogOpen(false)} disabled={createDealsMutation.isPending}>
              Cancelar
            </Button>
            <Button
              onClick={() => createDealsMutation.mutate()}
              disabled={createDealsMutation.isPending || selectedCompanies.length === 0}
            >
              {createDealsMutation.isPending ? "Criando..." : `Criar ${selectedCompanies.length} negociação(ões)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover conta</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{deleting?.name}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={confirmDeleteCompany}
              disabled={deleteMutation.isPending || !deleting}
            >
              {deleteMutation.isPending ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
