import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

const data = [
  { name: "Site", value: 374.82, color: "#FF8A00" },
  { name: "App Mobile", value: 241.60, color: "#FFA940" },
  { name: "Outros", value: 213.42, color: "#A0A0A0" },
];

export function SalesDistribution() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="chart-card"
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-foreground">Distribuição de Vendas</span>
        <button className="flex items-center gap-1 text-xs font-medium text-muted-foreground border border-border rounded-lg px-2.5 py-1 hover:bg-secondary hover:text-primary transition-colors">
          Mensal <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-6 mb-4">
        {data.map((item) => (
          <div key={item.name} className="flex flex-col">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="h-2.5 w-2.5 rounded-sm" style={{ background: item.color }} />
              <span className="text-xs text-muted-foreground">{item.name}</span>
            </div>
            <span className="text-lg font-bold text-foreground">R$ {item.value.toFixed(2).replace('.', ',')}</span>
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={140}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={60}
            paddingAngle={3}
            dataKey="value"
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
