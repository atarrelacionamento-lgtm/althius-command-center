import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import {
  Users,
  MousePointerClick,
  Eye,
  Target,
  TrendingUp,
  Megaphone,
  Calendar,
  Filter,
} from "lucide-react";

const EMPTY_MSG = "Sem dados — métricas aparecerão conforme leads forem importados";

export default function MarketingPage() {
  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Marketing</h1>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-border hover:bg-secondary transition-colors text-muted-foreground">
            <Calendar className="h-4 w-4" />
            Período
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-border hover:bg-secondary transition-colors text-muted-foreground">
            <Filter className="h-4 w-4" /> Filtrar
          </button>
        </div>
      </div>

      {/* KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Leads Gerados" value="–" icon={Users} delay={0} />
        <StatCard title="Leads por Origem" value="–" icon={Megaphone} delay={0.05} />
        <StatCard title="CPL Médio" value="–" icon={MousePointerClick} prefix="R$ " delay={0.1} />
        <StatCard title="Investimento em Mídia" value="–" icon={TrendingUp} prefix="R$ " delay={0.15} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard title="Taxa de Qualificação" value="–" icon={Target} delay={0.2} />
        <StatCard title="Leads Qualificados" value="–" icon={Eye} delay={0.25} />
        <StatCard title="Campanhas Ativas" value="–" icon={TrendingUp} delay={0.3} />
      </div>

      {/* Funil de Conversão */}
      <div className="chart-card mb-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Funil de Conversão
          </h3>
          <span className="text-xs text-muted-foreground">Lead time entre etapas</span>
        </div>
        <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
          {EMPTY_MSG}
        </div>
      </div>

      {/* Evolução de Leads + Leads por Canal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="chart-card col-span-2">
          <h3 className="text-sm font-semibold text-foreground mb-4">Evolução de Leads</h3>
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            {EMPTY_MSG}
          </div>
        </div>

        <div className="chart-card">
          <h3 className="text-sm font-semibold text-foreground mb-4">Leads por Canal</h3>
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            Sem dados
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
