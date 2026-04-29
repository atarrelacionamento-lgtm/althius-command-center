import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { BarChart3, Briefcase, Gauge, LayoutDashboard, Rocket, TrendingUp } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GoalProgressBoard } from "@/components/dashboard/GoalProgressBoard";
import { ExecutiveSnapshotGrid } from "@/components/dashboard/ExecutiveSnapshotGrid";
import { PipelineStageBoard } from "@/components/dashboard/PipelineStageBoard";
import { getGtmMetrics, type MetricCard } from "@/services/gtmMetricsService";

function MetricGrid({ metrics }: { metrics: MetricCard[] }) {
  if (!metrics || metrics.length === 0) return null;
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <Card key={metric.label}>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{metric.label}</p>
            <p className="mt-2 text-2xl font-bold">{metric.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{metric.detail}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function Index() {
  const [params, setParams] = useSearchParams();
  const activeView = params.get("view") ?? "overview";

  const { data, isLoading } = useQuery({
    queryKey: ["gtm-metrics"],
    queryFn: getGtmMetrics,
    refetchInterval: 60_000,
  });

  function setView(view: string) {
    const next = new URLSearchParams(params);
    next.set("view", view);
    setParams(next);
  }

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground uppercase tracking-widest">Centro de Comando</h1>
          </div>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Monitoramento de Missão e Telemetria Comercial
          </p>
        </div>
      </div>

      <Tabs value={activeView} onValueChange={setView}>
        <TabsList className="mb-4">
          <TabsTrigger value="overview" className="gap-1.5 text-[10px] font-bold uppercase tracking-widest"><LayoutDashboard className="h-4 w-4" /> Status</TabsTrigger>
          <TabsTrigger value="gtm" className="gap-1.5 text-[10px] font-bold uppercase tracking-widest"><Gauge className="h-4 w-4" /> Telemetria</TabsTrigger>
          <TabsTrigger value="sales" className="gap-1.5 text-[10px] font-bold uppercase tracking-widest"><Briefcase className="h-4 w-4" /> Propulsão</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {isLoading || !data ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-xl" />)}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {(data.efficiency || []).slice(0, 4).map((metric) => (
                <Card key={metric.label}>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">{metric.label}</p>
                    <p className="mt-2 text-2xl font-bold">{metric.value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{metric.detail}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!isLoading && data && <ExecutiveSnapshotGrid stats={data.executive} />}
          {!isLoading && data && <GoalProgressBoard goals={data.goals} />}
          {!isLoading && data && data.pipeline && data.pipeline.length > 0 && <PipelineStageBoard stages={data.pipeline} />}
        </TabsContent>

        <TabsContent value="gtm" className="space-y-6">
          {isLoading || !data ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-xl" />)}
            </div>
          ) : (
            <>
              <div className="grid gap-3 lg:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="h-4 w-4 text-primary" /> Ritmo</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-3 gap-2">
                    <div><p className="text-xl font-bold">{data.calendar.remainingWorkingDays}</p><p className="text-[11px] text-muted-foreground">Dias úteis</p></div>
                    <div><p className="text-xl font-bold">{data.calendar.requiredPhase0PerWorkingDay}</p><p className="text-[11px] text-muted-foreground">Fase 0/dia</p></div>
                    <div><p className="text-xl font-bold">{data.calendar.requiredMeetingsPerWorkingDay}</p><p className="text-[11px] text-muted-foreground">Reuniões/dia</p></div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base"><Rocket className="h-4 w-4 text-primary" /> Expansão</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p className="rounded-lg bg-muted/40 px-3 py-2">Priorizar contas com lançamento ativo ou previsto.</p>
                    <p className="rounded-lg bg-muted/40 px-3 py-2">Medir VGV e mídia como narrativa principal de ROI.</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4 text-primary" /> Funil reverso</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {[
                      ["200", "contas em Fase 0"],
                      ["40", "reuniões agendadas"],
                      ["8", "propostas enviadas"],
                      ["4", "contratos fechados"],
                    ].map(([value, label]) => (
                      <div key={label} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                        <span className="text-muted-foreground">{label}</span>
                        <strong>{value}</strong>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              <GoalProgressBoard goals={data.goals} />
              <ExecutiveSnapshotGrid stats={data.executive} />
              <MetricGrid metrics={data.presales} />
              <MetricGrid metrics={data.expansion} />
              <MetricGrid metrics={data.efficiency} />
            </>
          )}
        </TabsContent>

        <TabsContent value="sales" className="space-y-6">
          {isLoading || !data ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-xl" />)}
            </div>
          ) : (
            <>
              <GoalProgressBoard goals={data.goals} />
              <ExecutiveSnapshotGrid stats={data.executive} />
              <MetricGrid metrics={data.sales} />
            </>
          )}

          {!isLoading && data && data.pipeline && data.pipeline.length > 0 && <PipelineStageBoard stages={data.pipeline} />}
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
