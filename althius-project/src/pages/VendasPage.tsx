import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import {
  DollarSign,
  TrendingUp,
  Clock,
  Users,
  Target,
  Handshake,
  Calendar,
  Filter,
} from "lucide-react";

const EMPTY_MSG = "Sem dados — métricas aparecerão conforme vendas forem registradas";

export default function VendasPage() {
  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Vendas</h1>
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

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Receita Total" value="–" icon={DollarSign} prefix="R$ " delay={0} />
        <StatCard title="Ticket Médio" value="–" icon={TrendingUp} prefix="R$ " delay={0.05} />
        <StatCard title="Ciclo Médio" value="–" icon={Clock} delay={0.1} />
        <StatCard title="Taxa de Conversão" value="–" icon={Target} delay={0.15} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard title="Negócios Ativos" value="–" icon={Handshake} delay={0.2} />
        <StatCard title="Novos Clientes" value="–" icon={Users} delay={0.25} />
        <StatCard title="Giro de Estoque" value="–" icon={Clock} delay={0.3} />
      </div>

      {/* Pipeline + Receita */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="chart-card">
          <h3 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wider">
            Pipeline de Vendas
          </h3>
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            {EMPTY_MSG}
          </div>
        </div>

        <div className="chart-card">
          <h3 className="text-sm font-semibold text-foreground mb-4">Receita Mensal</h3>
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            {EMPTY_MSG}
          </div>
        </div>
      </div>

      {/* Top Vendedores + Vendas por Produto */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="chart-card">
          <h3 className="text-sm font-semibold text-foreground mb-4">Top Vendedores</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="pb-3 text-left font-medium uppercase tracking-wider text-[11px]">Vendedor</th>
                  <th className="pb-3 text-left font-medium uppercase tracking-wider text-[11px]">Vendas</th>
                  <th className="pb-3 text-left font-medium uppercase tracking-wider text-[11px]">Receita</th>
                  <th className="pb-3 text-left font-medium uppercase tracking-wider text-[11px]">Conversão</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                    Sem dados
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="chart-card">
          <h3 className="text-sm font-semibold text-foreground mb-4">Vendas por Produto</h3>
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            {EMPTY_MSG}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
