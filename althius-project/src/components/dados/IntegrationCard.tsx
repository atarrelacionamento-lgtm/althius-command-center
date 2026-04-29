import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Settings, LucideIcon } from "lucide-react";
import { IntegrationStatus } from "@/services/integrationService";

interface IntegrationCardProps {
  name: string;
  label: string;
  description: string;
  icon: LucideIcon;
  status: IntegrationStatus;
  isAdmin: boolean;
  delay?: number;
  onConfigure: () => void;
}

const statusConfig: Record<IntegrationStatus, { label: string; className: string }> = {
  connected:    { label: "Conectado",     className: "bg-green-500/10 text-green-500 border-green-500/20" },
  disconnected: { label: "Desconectado",  className: "bg-muted text-muted-foreground border-border" },
  error:        { label: "Erro",          className: "bg-red-500/10 text-red-500 border-red-500/20" },
  coming_soon:  { label: "Em breve",      className: "bg-primary/10 text-primary border-primary/20" },
};

export function IntegrationCard({
  label,
  description,
  icon: Icon,
  status,
  isAdmin,
  delay = 0,
  onConfigure,
}: IntegrationCardProps) {
  const cfg = statusConfig[status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="chart-card flex flex-col gap-4"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>
        <Badge className={`text-[10px] shrink-0 ${cfg.className}`}>{cfg.label}</Badge>
      </div>

      {/* Status dot */}
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${
            status === "connected"
              ? "bg-green-500"
              : status === "error"
              ? "bg-red-500"
              : "bg-muted-foreground/40"
          }`}
        />
        <span className="text-xs text-muted-foreground">
          {status === "connected"
            ? "Integração ativa"
            : status === "coming_soon"
            ? "Disponível em breve"
            : "Não configurado"}
        </span>
      </div>

      {/* Action */}
      {isAdmin && (
        <button
          onClick={onConfigure}
          disabled={status === "coming_soon"}
          className="flex items-center justify-center gap-2 w-full px-3 py-2 text-xs font-medium rounded-lg border border-border hover:bg-secondary transition-colors text-muted-foreground disabled:opacity-40 disabled:cursor-not-allowed mt-auto"
        >
          <Settings className="h-3.5 w-3.5" />
          Configurar
        </button>
      )}
    </motion.div>
  );
}