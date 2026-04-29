import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Filter, ArrowUpDown, MoreHorizontal } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";

const data: { month: string; Direto: number; Indicação: number; Orgânico: number; Social: number; Outros: number }[] = [];

const darkColors: Record<string, string> = {
  Direto: "#FF8A00",
  Indicação: "#FFA940",
  Orgânico: "#CC6E00",
  Social: "#A0A0A0",
  Outros: "#4A4A4A",
};

const lightColors: Record<string, string> = {
  Direto: "#FF8A1E",
  Indicação: "#FFA940",
  Orgânico: "#003D2B",
  Social: "#A0A0A0",
  Outros: "#D1F2E6",
};

export function SalesOverviewChart() {
  const { theme } = useTheme();
  const COLORS = theme === "dark" ? darkColors : lightColors;
  const gridColor = theme === "dark" ? "#2A2A2A" : "#E0DDD8";
  const tickColor = theme === "dark" ? "#A0A0A0" : "#6B6B6B";
  const tooltipBg = theme === "dark" ? "#1C1C1C" : "#FFFFFF";
  const tooltipBorder = theme === "dark" ? "#2A2A2A" : "#E0DDD8";
  const tooltipColor = theme === "dark" ? "#FFFFFF" : "#003D2B";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="chart-card col-span-2"
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Visão de Vendas</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-secondary hover:text-primary transition-colors text-muted-foreground">
            <Filter className="h-3.5 w-3.5" /> Filtrar
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-secondary hover:text-primary transition-colors text-muted-foreground">
            <ArrowUpDown className="h-3.5 w-3.5" /> Ordenar
          </button>
          <button className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-primary">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex items-end gap-3 mb-4">
        <span className="text-3xl font-bold text-foreground">–</span>
      </div>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">
          Sem dados — métricas aparecerão conforme vendas forem registradas
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data} barGap={2} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: tickColor }} />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  background: tooltipBg,
                  border: `1px solid ${tooltipBorder}`,
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: tooltipColor,
                }}
                formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR")}`, ""]}
              />
              <Bar dataKey="Direto" stackId="a" fill={COLORS.Direto} radius={[0, 0, 0, 0]} />
              <Bar dataKey="Indicação" stackId="a" fill={COLORS.Indicação} radius={[0, 0, 0, 0]} />
              <Bar dataKey="Orgânico" stackId="a" fill={COLORS.Orgânico} radius={[0, 0, 0, 0]} />
              <Bar dataKey="Social" stackId="a" fill={COLORS.Social} radius={[0, 0, 0, 0]} />
              <Bar dataKey="Outros" stackId="a" fill={COLORS.Outros} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-5 mt-3">
            {Object.entries(COLORS).map(([key, color]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
                <span className="text-xs text-muted-foreground">{key}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </motion.div>
  );
}
