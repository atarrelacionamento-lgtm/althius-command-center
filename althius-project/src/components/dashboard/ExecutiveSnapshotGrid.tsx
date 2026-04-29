import { Briefcase, LayoutDashboard, Rocket, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { ExecutiveStat } from "@/services/gtmMetricsService";

const TONE_STYLE: Record<ExecutiveStat["tone"], string> = {
  primary: "text-primary bg-primary/10",
  good: "text-green-600 bg-green-500/10",
  attention: "text-yellow-700 bg-yellow-500/15",
  neutral: "text-muted-foreground bg-muted",
};

const ICONS = [LayoutDashboard, Users, Briefcase, Rocket];

export function ExecutiveSnapshotGrid({ stats }: { stats: ExecutiveStat[] }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <LayoutDashboard className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Visao Executiva
        </h2>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat, index) => {
          const Icon = ICONS[index % ICONS.length];
          return (
            <Card key={stat.label}>
              <CardContent className="p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="mt-2 text-2xl font-bold">{stat.value}</p>
                  </div>
                  <div className={`rounded-lg p-2 ${TONE_STYLE[stat.tone]}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{stat.detail}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
