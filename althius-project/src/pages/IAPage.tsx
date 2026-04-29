import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import {
  Bot,
  Clock,
  CalendarCheck,
  Search,
  RefreshCw,
  Send,
  MousePointerClick,
  TrendingUp,
  Calendar,
  Filter,
  Sparkles,
} from "lucide-react";

const EMPTY_MSG = "Sem dados — métricas aparecerão conforme a PIPA for utilizada";

export default function IAPage() {
  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">PIPA — Inteligência Artificial</h1>
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

      {/* ══ PRÉ-VENDA ══ */}
      <div className="mb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          🤖 Performance PIPA — Pré-Venda
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Atendimentos pela PIPA" value="–" icon={Bot} delay={0} />
        <StatCard title="Tempo Médio de Resposta" value="–" icon={Clock} delay={0.05} />
        <StatCard title="Agendamentos pela PIPA" value="–" icon={CalendarCheck} delay={0.1} />
        <StatCard title="Objeções Mapeadas" value="–" icon={Search} delay={0.15} />
      </div>

      {/* Atendimentos + Objeções */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <div className="chart-card">
          <h3 className="text-sm font-semibold text-foreground mb-4">Atendimentos PIPA por Semana</h3>
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            {EMPTY_MSG}
          </div>
        </div>

        <div className="chart-card">
          <h3 className="text-sm font-semibold text-foreground mb-4">Objeções Mapeadas</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="pb-3 text-left font-medium uppercase tracking-wider text-[11px]">Objeção</th>
                  <th className="pb-3 text-left font-medium uppercase tracking-wider text-[11px]">Mapeadas</th>
                  <th className="pb-3 text-left font-medium uppercase tracking-wider text-[11px]">Tratadas</th>
                  <th className="pb-3 text-left font-medium uppercase tracking-wider text-[11px]">Taxa</th>
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
      </div>

      {/* ══ FOLLOW-UP & REATIVAÇÃO ══ */}
      <div className="mb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          🔄 Performance PIPA — Follow-up & Reativação
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Leads Reativados" value="–" icon={RefreshCw} delay={0.3} />
        <StatCard title="Follow-ups Enviados" value="–" icon={Send} delay={0.35} />
        <StatCard title="Engajamento pela PIPA" value="–" icon={MousePointerClick} delay={0.4} />
        <StatCard title="Conversões por Reativação" value="–" icon={TrendingUp} delay={0.45} />
      </div>

      {/* Conversão por Canal + Engajamento */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="chart-card col-span-2">
          <h3 className="text-sm font-semibold text-foreground mb-4">Conversão de Follow-up por Canal</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="pb-3 text-left font-medium uppercase tracking-wider text-[11px]">Canal</th>
                  <th className="pb-3 text-left font-medium uppercase tracking-wider text-[11px]">Enviados</th>
                  <th className="pb-3 text-left font-medium uppercase tracking-wider text-[11px]">Engajados</th>
                  <th className="pb-3 text-left font-medium uppercase tracking-wider text-[11px]">Convertidos</th>
                  <th className="pb-3 text-left font-medium uppercase tracking-wider text-[11px]">Taxa</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    Sem dados
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="chart-card">
          <h3 className="text-sm font-semibold text-foreground mb-4">Engajamento pela PIPA</h3>
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            Sem dados
          </div>
        </div>
      </div>

      {/* Influência da PIPA na Conversão */}
      <div className="chart-card">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Influência da PIPA na Conversão</h3>
        </div>
        <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
          {EMPTY_MSG}
        </div>
      </div>
    </DashboardLayout>
  );
}
