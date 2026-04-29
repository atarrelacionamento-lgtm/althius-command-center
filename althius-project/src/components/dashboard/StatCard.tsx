import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  change?: number;
  icon: LucideIcon;
  prefix?: string;
  delay?: number;
}

export function StatCard({ title, value, change, icon: Icon, prefix = "", delay = 0 }: StatCardProps) {
  const isPositive = (change ?? 0) >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="stat-card"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="h-4 w-4" />
          <span className="text-[10px] font-bold uppercase tracking-widest">{title}</span>
        </div>
        <button className="text-muted-foreground hover:text-foreground transition-colors">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
            <path d="M12 16v-4m0-4h.01" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="flex items-end gap-3">
        <span className="text-2xl font-bold text-foreground tracking-tight">{prefix}{value}</span>
        {change !== undefined && (
          <span className={isPositive ? "badge-success" : "badge-destructive"}>
            {isPositive ? "↗" : "↘"} {Math.abs(change)}%
          </span>
        )}
      </div>
    </motion.div>
  );
}
