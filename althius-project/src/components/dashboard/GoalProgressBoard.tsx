import { Target, TrendingUp, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { GoalProgress } from "@/services/gtmMetricsService";

const HEALTH_STYLE: Record<GoalProgress["health"], string> = {
  good: "bg-green-500/10 text-green-600 border-green-500/20",
  attention: "bg-yellow-500/15 text-yellow-700 border-yellow-500/20",
  risk: "bg-red-500/10 text-red-600 border-red-500/20",
  neutral: "bg-muted text-muted-foreground border-border",
};

const HEALTH_LABEL: Record<GoalProgress["health"], string> = {
  good: "No ritmo",
  attention: "Atencao",
  risk: "Pressao",
  neutral: "Info",
};

export function GoalProgressBoard({ goals }: { goals: GoalProgress[] }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Metas do Mes
        </h2>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        {goals.map((goal) => (
          <Card key={goal.key}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{goal.label}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">{goal.detail}</p>
                </div>
                <Badge variant="outline" className={HEALTH_STYLE[goal.health]}>
                  {HEALTH_LABEL[goal.health]}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Realizado</p>
                  <p className="text-2xl font-bold">{goal.actualLabel}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Meta</p>
                  <p className="text-sm font-semibold">{goal.targetLabel}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{Math.min(goal.achievementPct, 999).toFixed(0)}% da meta</span>
                  <span>esperado {goal.expectedLabel}</span>
                </div>
                <Progress value={Math.max(0, Math.min(goal.achievementPct, 100))} className="h-2.5" />
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg bg-muted/40 p-3">
                  <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Zap className="h-3.5 w-3.5" />
                    Forcado
                  </div>
                  <p className="text-sm font-semibold">{goal.forcedLabel}</p>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Gap
                  </div>
                  <p className="text-sm font-semibold">{goal.remainingLabel}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
