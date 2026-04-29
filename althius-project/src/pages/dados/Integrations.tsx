import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { IntegrationCard } from "@/components/dados/IntegrationCard";
import { IntegrationModal } from "@/components/dados/IntegrationModal";
import { useAuth } from "@/hooks/useAuth";
import { fetchIntegrations, Integration } from "@/services/integrationService";
import { motion } from "framer-motion";
import {
  Search,
  Zap,
  Globe,
  Webhook,
  Database,
  MessageCircle,
  Mail,
  Brain,
  LucideIcon,
} from "lucide-react";

interface IntegrationMeta {
  name: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

const INTEGRATION_META: IntegrationMeta[] = [
  { name: "apollo",     label: "Apollo API",        description: "Prospecção e enriquecimento de contatos B2B.", icon: Search },
  { name: "search_api", label: "Search API",         description: "Dados de empresas e contatos via web search.", icon: Globe },
  { name: "n8n",        label: "n8n Webhook",        description: "Recebe WhatsApp, sinais de mercado e eventos automáticos do seu stack.", icon: Webhook },
  { name: "briary",     label: "Briary Data",        description: "Dados imobiliários e segmentação avançada.", icon: Database },
  { name: "whatsapp",   label: "WhatsApp",           description: "Entrada e saída de mensagens com atualização automática do CRM.", icon: MessageCircle },
  { name: "email",      label: "Email",              description: "Disparos e sequências de e-mail marketing.", icon: Mail },
  { name: "openai",     label: "OpenAI / Anthropic", description: "Modelos de linguagem para IA no CRM.", icon: Brain },
];

export default function Integrations() {
  const { isAdmin, session } = useAuth();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [configuring, setConfiguring] = useState<Integration | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await fetchIntegrations();
      setIntegrations(data);
    } finally {
      setLoading(false);
    }
  }

  const getIntegration = (name: string) =>
    integrations.find((i) => i.name === name);

  const connected = integrations.filter((i) => i.status === "connected").length;

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Integrações</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {connected} de {INTEGRATION_META.length} integrações ativas
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
            <Zap className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium text-primary">Modo Admin</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : (
        <>
          {/* Connected banner */}
          {connected > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl border border-green-500/20 bg-green-500/5"
            >
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse shrink-0" />
              <span className="text-sm text-green-600 font-medium">
                {connected} integração{connected > 1 ? "ões" : ""} ativa{connected > 1 ? "s" : ""} e funcionando
              </span>
            </motion.div>
          )}

          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {INTEGRATION_META.map((meta, i) => {
              const integration = getIntegration(meta.name);
              const status = integration?.status ?? "disconnected";

              return (
                <IntegrationCard
                  key={meta.name}
                  name={meta.name}
                  label={meta.label}
                  description={meta.description}
                  icon={meta.icon}
                  status={status}
                  isAdmin={isAdmin && !!integration}
                  delay={i * 0.05}
                  onConfigure={() => integration && setConfiguring(integration)}
                />
              );
            })}
          </div>

          {!isAdmin && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-6 text-center text-xs text-muted-foreground"
            >
              Apenas administradores podem configurar integrações.
            </motion.p>
          )}
        </>
      )}

      {/* Modal */}
      {configuring && session && (
        <IntegrationModal
          integration={configuring}
          userId={session.user.id}
          onClose={() => setConfiguring(null)}
          onSaved={load}
        />
      )}
    </DashboardLayout>
  );
}
