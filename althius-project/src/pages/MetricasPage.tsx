import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  Gauge,
  LineChart,
  Loader2,
  Rocket,
  Target,
  TrendingUp,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { GoalProgressBoard } from "@/components/dashboard/GoalProgressBoard";
import { ExecutiveSnapshotGrid } from "@/components/dashboard/ExecutiveSnapshotGrid";
import { PipelineStageBoard } from "@/components/dashboard/PipelineStageBoard";
import { getGtmMetrics, type MetricCard } from "@/services/gtmMetricsService";
import { PIPA_GTM_CONTEXT } from "@/lib/pipaGtm";

const HEALTH_STYLE: Record<MetricCard["health"], string> = {
  good: "bg-green-500/10 text-green-600 border-green-500/20",
  attention: "bg-yellow-500/15 text-yellow-700 border-yellow-500/20",
  risk: "bg-red-500/10 text-red-600 border-red-500/20",
  neutral: "bg-muted text-muted-foreground border-border",
};

const HEALTH_LABEL: Record<MetricCard["health"], string> = {
  good: "Bom",
  attention: "Atencao",
  risk: "Risco",
  neutral: "Info",
};

function MetricTile({ metric }: { metric: MetricCard }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">{metric.label}</p>
          <Badge variant="outline" className={HEALTH_STYLE[metric.health]}>
            {HEALTH_LABEL[metric.health]}
          </Badge>
        </div>
        <p className="text-2xl font-bold">{metric.value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{metric.detail}</p>
      </CardContent>
    </Card>
  );
}

function MetricSection({
  title,
  icon: Icon,
  metrics,
}: {
  title: string;
  icon: React.ElementType;
  metrics: MetricCard[];
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricTile key={`${title}-${metric.label}`} metric={metric} />
        ))}
      </div>
    </section>
  );
}

function LoadingGrid() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <Skeleton key={index} className="h-32 rounded-xl" />
      ))}
    </div>
  );
}

export default function MetricasPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["gtm-metrics"],
    queryFn: getGtmMetrics,
    refetchInterval: 60_000,
  });

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">Metricas GTM</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Pre-vendas, vendas, expansao e eficiencia alinhadas ao GTM da Pipa.
          </p>
        </div>
        <div className="grid min-w-72 grid-cols-3 gap-2">
          <div className="rounded-lg border bg-card px-3 py-2">
            <p className="text-lg font-bold">{PIPA_GTM_CONTEXT.commercialGoal.monthlyAccountsInPhase0}</p>
            <p className="text-[11px] text-muted-foreground">Contas/mês</p>
          </div>
          <div className="rounded-lg border bg-card px-3 py-2">
            <p className="text-lg font-bold">{PIPA_GTM_CONTEXT.commercialGoal.monthlyNewContracts * 10}</p>
            <p className="text-[11px] text-muted-foreground">Reuniões/mês</p>
          </div>
          <div className="rounded-lg border bg-card px-3 py-2">
            <p className="text-lg font-bold">R$ 30k</p>
            <p className="text-[11px] text-muted-foreground">MRR novo</p>
          </div>
        </div>
      </div>

      {isError && (
        <Card className="mb-6 border-destructive/30">
          <CardContent className="flex items-center gap-3 p-4 text-sm text-destructive">
            <Loader2 className="h-4 w-4" />
            Nao foi possivel carregar algumas metricas agora.
          </CardContent>
        </Card>
      )}

      {isLoading || !data ? (
        <LoadingGrid />
      ) : (
        <div className="space-y-7">
          <GoalProgressBoard goals={data.goals} />
          <ExecutiveSnapshotGrid stats={data.executive} />
          <PipelineStageBoard stages={data.pipeline} />

          <div className="grid gap-3 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarClock className="h-4 w-4 text-primary" />
                  Calendario
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-xl font-bold">{data.calendar.remainingWorkingDays}</p>
                  <p className="text-[11px] text-muted-foreground">Dias uteis</p>
                </div>
                <div>
                  <p className="text-xl font-bold">{data.calendar.requiredPhase0PerWorkingDay}</p>
                  <p className="text-[11px] text-muted-foreground">Contas/dia</p>
                </div>
                <div>
                  <p className="text-xl font-bold">{data.calendar.requiredMeetingsPerWorkingDay}</p>
                  <p className="text-[11px] text-muted-foreground">Reunioes/dia</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-4 w-4 text-primary" />
                  Funil reverso
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {[
                  [String(PIPA_GTM_CONTEXT.commercialGoal.monthlyAccountsInPhase0), "contas prospectadas"],
                  [String(PIPA_GTM_CONTEXT.commercialGoal.monthlyNewContracts * 10), "reunioes agendadas"],
                  [String(PIPA_GTM_CONTEXT.commercialGoal.monthlyNewContracts * 2), "propostas enviadas"],
                  [String(PIPA_GTM_CONTEXT.commercialGoal.monthlyNewContracts), "contratos fechados"],
                ].map(([value, label]) => (
                  <div key={label} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                    <span className="text-muted-foreground">{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Foco de decisao
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p className="rounded-lg bg-muted/40 px-3 py-2">Priorizar contas com lancamento ativo ou previsto.</p>
                <p className="rounded-lg bg-muted/40 px-3 py-2">Atacar resposta lenta e falta de follow-up como dor economica.</p>
                <p className="rounded-lg bg-muted/40 px-3 py-2">Medir VGV e midia como narrativa principal de ROI.</p>
              </CardContent>
            </Card>
          </div>

          <MetricSection title="Pre-vendas" icon={Gauge} metrics={data.presales} />
          <MetricSection title="Vendas" icon={Briefcase} metrics={data.sales} />
          <MetricSection title="Expansao de conta" icon={Rocket} metrics={data.expansion} />
          <MetricSection title="Eficiencia GTM" icon={TrendingUp} metrics={data.efficiency} />

          <div className="rounded-xl border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <LineChart className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Leitura executiva</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
                Pre-vendas mede prospeccao real: quantas contas entraram no mes, quantas foram tocadas e qual o ritmo forcado restante.
              </p>
              <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
                Vendas mede conversao real: reuniao, proposta, pipeline aberto e contratos ganhos.
              </p>
              <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
                Expansao mede profundidade de conta: lancamentos, cobertura de pessoas, VGV e sinais de compra.
              </p>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
