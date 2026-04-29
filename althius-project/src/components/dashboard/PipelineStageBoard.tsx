import { ArrowRightLeft, CircleDollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PipelineStageMetric } from "@/services/gtmMetricsService";

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

export function PipelineStageBoard({ stages }: { stages: PipelineStageMetric[] }) {
  const maxCount = Math.max(...stages.map((stage) => stage.count), 1);

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <ArrowRightLeft className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Pipeline por Etapa
        </h2>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Quanto tem em cada etapa do pipeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {stages.map((stage) => (
            <div key={stage.label} className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{stage.label}</p>
                  <p className="text-xs text-muted-foreground">{stage.count} negócios</p>
                </div>
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  <CircleDollarSign className="h-4 w-4 text-primary" />
                  {formatMoney(stage.value)}
                </div>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.max((stage.count / maxCount) * 100, stage.count > 0 ? 8 : 0)}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
