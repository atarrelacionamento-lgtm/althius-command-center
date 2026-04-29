import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

export function TotalSubscriberChart() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="chart-card"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-muted-foreground">Total de Leads</span>
        <button className="flex items-center gap-1 text-xs font-medium text-muted-foreground border border-border rounded-lg px-2.5 py-1 hover:bg-secondary hover:text-primary transition-colors">
          Semanal <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex items-end gap-3 mb-4">
        <span className="text-3xl font-bold text-foreground">–</span>
      </div>

      <div className="flex items-center justify-center h-[140px] text-sm text-muted-foreground">
        Sem dados
      </div>
    </motion.div>
  );
}
