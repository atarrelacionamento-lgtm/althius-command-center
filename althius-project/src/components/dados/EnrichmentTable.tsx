import { useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  CheckCircle,
  Clock,
  Loader2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import { Contact, EnrichmentStatus } from "@/services/enrichmentService";

interface EnrichmentTableProps {
  contacts: Contact[];
  selected: string[];
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onEnrich: () => void;
  enriching: boolean;
}

const statusConfig: Record<EnrichmentStatus, { icon: React.ElementType; label: string; className: string }> = {
  pending:    { icon: Clock,        label: "Pendente",     className: "bg-muted text-muted-foreground border-border" },
  enriching:  { icon: Loader2,      label: "Enriquecendo", className: "bg-primary/10 text-primary border-primary/20" },
  done:       { icon: CheckCircle,  label: "Concluído",    className: "bg-green-500/10 text-green-500 border-green-500/20" },
  error:      { icon: XCircle,      label: "Erro",         className: "bg-red-500/10 text-red-500 border-red-500/20" },
};

const stageLabels: Record<string, string> = {
  lead:              "Lead",
  mql:               "MQL",
  sql:               "SQL",
  visita_agendada:   "Visita Agendada",
  visita_realizada:  "Visita Realizada",
  comprou:           "Comprou",
};

export function EnrichmentTable({
  contacts,
  selected,
  onToggle,
  onToggleAll,
  onEnrich,
  enriching,
}: EnrichmentTableProps) {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const allSelected = contacts.length > 0 && selected.length === contacts.length;

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.company ?? "").toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar lead..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-input bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <button
          onClick={onEnrich}
          disabled={selected.length === 0 || enriching}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          {enriching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Enriquecer{selected.length > 0 ? ` (${selected.length})` : ""}
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        {/* Head */}
        <div className="grid grid-cols-[40px_1fr_140px_120px_100px] gap-3 px-4 py-2.5 bg-secondary/50 border-b border-border text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={onToggleAll}
              className="h-4 w-4 rounded accent-primary cursor-pointer"
            />
          </div>
          <span>Lead</span>
          <span>Empresa / Cidade</span>
          <span>Estágio</span>
          <span>Status</span>
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            Nenhum lead encontrado.
          </div>
        ) : (
          filtered.map((contact, i) => {
            const status = contact.enrichment_status ?? "pending";
            const cfg = statusConfig[status];
            const StatusIcon = cfg.icon;
            const isExpanded = expandedId === contact.id;

            return (
              <motion.div
                key={contact.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02 }}
              >
                <div
                  className="grid grid-cols-[40px_1fr_140px_120px_100px] gap-3 px-4 py-3 border-b border-border hover:bg-secondary/30 transition-colors items-center cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : contact.id)}
                >
                  <div
                    className="flex items-center justify-center"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggle(contact.id);
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(contact.id)}
                      onChange={() => onToggle(contact.id)}
                      className="h-4 w-4 rounded accent-primary cursor-pointer"
                    />
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{contact.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{contact.email ?? "—"}</p>
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs text-foreground truncate">{contact.company ?? "—"}</p>
                    <p className="text-xs text-muted-foreground truncate">{contact.city ?? "—"}</p>
                  </div>

                  <Badge className="text-[10px] w-fit">
                    {stageLabels[contact.stage] ?? contact.stage}
                  </Badge>

                  <div className="flex items-center gap-1.5">
                    <Badge className={`text-[10px] flex items-center gap-1 ${cfg.className}`}>
                      <StatusIcon className={`h-3 w-3 ${status === "enriching" ? "animate-spin" : ""}`} />
                      {cfg.label}
                    </Badge>
                    {isExpanded ? (
                      <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="px-6 py-3 bg-secondary/20 border-b border-border grid grid-cols-2 md:grid-cols-4 gap-3"
                  >
                    {[
                      { label: "Telefone",  value: contact.phone },
                      { label: "Segmento",  value: contact.segment },
                      { label: "Cidade",    value: contact.city },
                      { label: "Empresa",   value: contact.company },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider">{label}</p>
                        <p className="text-xs font-medium text-foreground mt-0.5">{value ?? "—"}</p>
                      </div>
                    ))}
                  </motion.div>
                )}
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}