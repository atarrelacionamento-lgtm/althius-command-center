import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

const stages: { label: string; value: number; width: string }[] = [];

export function FunnelOverview() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="chart-card col-span-2"
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-foreground">Funil Geral</span>
        <button className="flex items-center gap-1 text-xs font-medium text-muted-foreground border border-border rounded-lg px-2.5 py-1 hover:bg-secondary hover:text-primary transition-colors">
          Mensal <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      {stages.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
          Sem dados — registros aparecerão conforme forem importados
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {stages.map((stage, i) => {
              const convRate = i > 0 ? ((stage.value / stages[i - 1].value) * 100).toFixed(1) : null;
              return (
                <motion.div
                  key={stage.label}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 * i }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-muted-foreground">{stage.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">{stage.value.toLocaleString("pt-BR")}</span>
                      {convRate && (
                        <span className="text-[10px] text-muted-foreground">({convRate}%)</span>
                      )}
                    </div>
                  </div>
                  <div className="h-6 w-full rounded-md bg-muted/40 overflow-hidden">
                    <motion.div
                      className="h-full rounded-md"
                      style={{
                        width: stage.width,
                        background: i === stages.length - 1
                          ? "hsl(var(--primary))"
                          : `hsl(var(--primary) / ${1 - i * 0.15})`,
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: stage.width }}
                      transition={{ duration: 0.8, delay: 0.15 * i, ease: "easeOut" }}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Conversão geral</span>
            <span className="text-sm font-bold text-primary">
              {((stages[stages.length - 1].value / stages[0].value) * 100).toFixed(1)}%
            </span>
          </div>
        </>
      )}
    </motion.div>
  );
}
