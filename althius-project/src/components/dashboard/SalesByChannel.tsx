import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { useTheme } from "@/hooks/use-theme";

const data: { canal: string; vendas: number; receita: number }[] = [];

const darkBarColors = ["#FF8A00", "#FFA940", "#CC6E00", "#A0A0A0", "#4A4A4A"];
const lightBarColors = ["#FF8A1E", "#FFA940", "#003D2B", "#A0A0A0", "#D1F2E6"];

export function SalesByChannel() {
  const { theme } = useTheme();
  const colors = theme === "dark" ? darkBarColors : lightBarColors;
  const tickColor = theme === "dark" ? "#A0A0A0" : "#6B6B6B";
  const tooltipBg = theme === "dark" ? "#1C1C1C" : "#FFFFFF";
  const tooltipBorder = theme === "dark" ? "#2A2A2A" : "#E0DDD8";
  const tooltipColor = theme === "dark" ? "#FFFFFF" : "#003D2B";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="chart-card"
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-foreground">Vendas por Canal</span>
      </div>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground">
          Sem dados
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} layout="vertical" barSize={18}>
              <XAxis type="number" hide />
              <YAxis
                dataKey="canal"
                type="category"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: tickColor }}
                width={80}
              />
              <Tooltip
                contentStyle={{
                  background: tooltipBg,
                  border: `1px solid ${tooltipBorder}`,
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: tooltipColor,
                }}
                labelStyle={{ color: tooltipColor }}
                formatter={(value: number, name: string) => {
                  if (name === "vendas") return [`${value} vendas`, "Vendas"];
                  return [`R$ ${(value / 1000).toFixed(0)}k`, "Receita"];
                }}
              />
              <Bar dataKey="vendas" radius={[0, 6, 6, 0]}>
                {data.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 pt-3 border-t border-border">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Total de vendas</span>
              <span className="font-bold text-foreground">
                {data.reduce((s, d) => s + d.vendas, 0)}
              </span>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}
