import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, Cell } from "recharts";
import { useTheme } from "@/hooks/use-theme";

const data: { nome: string; orcado: number; realizado: number }[] = [];

function formatValue(value: number) {
  if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
  return `R$ ${(value / 1000).toFixed(0)}k`;
}

export function VGVProgress() {
  const { theme } = useTheme();
  const tickColor = theme === "dark" ? "#A0A0A0" : "#6B6B6B";
  const tooltipBg = theme === "dark" ? "#1C1C1C" : "#FFFFFF";
  const tooltipBorder = theme === "dark" ? "#2A2A2A" : "#E0DDD8";
  const tooltipColor = theme === "dark" ? "#FFFFFF" : "#003D2B";
  const orcadoColor = theme === "dark" ? "#4A4A4A" : "#D1D5DB";

  const totalOrcado = data.reduce((s, e) => s + e.orcado, 0);
  const totalRealizado = data.reduce((s, e) => s + e.realizado, 0);
  const pctGeral = totalOrcado > 0 ? ((totalRealizado / totalOrcado) * 100).toFixed(1) : "–";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="chart-card"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-semibold text-foreground">VGV — Orçado vs Realizado</span>
        <span className="text-xs font-medium text-primary">{pctGeral}% realizado</span>
      </div>
      <p className="text-[10px] text-muted-foreground mb-3">Por empreendimento</p>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-[240px] text-sm text-muted-foreground">
          Sem dados
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data} barGap={2} barCategoryGap="20%">
              <XAxis dataKey="nome" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: tickColor }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: tickColor }} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} width={40} />
              <Tooltip
                contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: "8px", fontSize: "12px", color: tooltipColor }}
                labelStyle={{ color: tooltipColor }}
                formatter={(value: number, name: string) => [formatValue(value), name === "orcado" ? "Orçado (VGV)" : "Realizado"]}
              />
              <Legend formatter={(value: string) => (value === "orcado" ? "Orçado (VGV)" : "Realizado")} wrapperStyle={{ fontSize: "11px" }} />
              <Bar dataKey="orcado" fill={orcadoColor} radius={[4, 4, 0, 0]} barSize={20} />
              <Bar dataKey="realizado" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 pt-3 border-t border-border flex gap-6">
            <div className="flex items-center justify-between text-xs text-muted-foreground flex-1">
              <span>VGV Total</span>
              <span className="font-bold text-foreground">{formatValue(totalOrcado)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground flex-1">
              <span>Realizado</span>
              <span className="font-bold text-primary">{formatValue(totalRealizado)}</span>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}
