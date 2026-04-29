import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Copy, CheckCircle, XCircle, Loader2, RefreshCw, Link2 } from "lucide-react";
import { toast } from "sonner";
import {
  AUTOMATION_EVENT_BLUEPRINTS,
  Integration,
  IntegrationName,
  connectWebhookIntegration,
  saveIntegration,
  disconnectIntegration,
  testConnection,
  buildWebhookUrl,
  fetchWebhookLogs,
  WebhookLog,
} from "@/services/integrationService";

interface IntegrationModalProps {
  integration: Integration;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}

const WEBHOOK_INTEGRATIONS: IntegrationName[] = ["n8n", "whatsapp"];

export function IntegrationModal({ integration, userId, onClose, onSaved }: IntegrationModalProps) {
  const isWebhook = WEBHOOK_INTEGRATIONS.includes(integration.name as IntegrationName);

  const [apiKey, setApiKey] = useState("");
  const [endpointUrl, setEndpointUrl] = useState(integration.webhook_url ?? "");
  const [testState, setTestState] = useState<"idle" | "loading" | "ok" | "fail">("idle");
  const [testMessage, setTestMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const webhookUrl = buildWebhookUrl(integration.id);
  const webhookExamples = integration.name === "whatsapp"
    ? (["whatsapp_message"] as const)
    : (["whatsapp_message", "market_signal"] as const);

  useEffect(() => {
    if (isWebhook) {
      setLogsLoading(true);
      fetchWebhookLogs(integration.id)
        .then(setLogs)
        .catch(() => setLogs([]))
        .finally(() => setLogsLoading(false));
    }
    setEndpointUrl(integration.webhook_url ?? "");
  }, [integration.id, integration.webhook_url, isWebhook]);

  async function handleTest() {
    setTestState("loading");
    const result = await testConnection(integration.name as IntegrationName, apiKey);
    setTestState(result.ok ? "ok" : "fail");
    setTestMessage(result.message);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveIntegration(integration.name as IntegrationName, apiKey, userId);
      onSaved();
      onClose();
    } catch {
      /* handled upstream */
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    setSaving(true);
    try {
      await disconnectIntegration(integration.name as IntegrationName);
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleWebhookConnect() {
    setSaving(true);
    try {
      await connectWebhookIntegration(
        integration.id,
        userId,
        endpointUrl.trim() || null,
      );
      toast.success("Webhook ativado.");
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel ativar o webhook.");
    } finally {
      setSaving(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const logStatusColor = (s: WebhookLog["status"]) =>
    s === "processed"
      ? "text-green-500"
      : s === "error"
      ? "text-red-500"
      : "text-muted-foreground";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">
            Configurar integração
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {isWebhook
              ? "Ative o endpoint que recebe WhatsApp, sinais de mercado e atualiza o Sistemas sozinho."
              : "Informe a API key para ativar esta integração."}
          </p>
        </DialogHeader>

        {/* ── Webhook (n8n) ─────────────────────────────────── */}
        {isWebhook && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                URL do Webhook
              </label>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-secondary text-xs font-mono text-muted-foreground overflow-hidden">
                  <Link2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{webhookUrl}</span>
                </div>
                <button
                  onClick={handleCopy}
                  className="px-3 py-2 rounded-md border border-border hover:bg-secondary transition-colors text-muted-foreground text-xs flex items-center gap-1.5 shrink-0"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copied ? "Copiado!" : "Copiar"}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground/60 mt-1.5">
                Configure este endpoint no seu workflow n8n, provedor de WhatsApp ou middleware como destino de POST.
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                URL do workflow/origem (opcional)
              </label>
              <Input
                value={endpointUrl}
                onChange={(e) => setEndpointUrl(e.target.value)}
                placeholder="https://n8n.seudominio.com/webhook/..."
                className="text-xs"
              />
              <p className="text-[11px] text-muted-foreground/60 mt-1.5">
                Guarde aqui a URL do fluxo que dispara eventos para a Althius. Isso ajuda a auditar a integração ativa.
              </p>
            </div>

            {/* Logs */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Últimas 10 requisições
                </span>
                <button
                  onClick={() => {
                    setLogsLoading(true);
                    fetchWebhookLogs(integration.id)
                      .then(setLogs)
                      .catch(() => setLogs([]))
                      .finally(() => setLogsLoading(false));
                  }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${logsLoading ? "animate-spin" : ""}`} />
                </button>
              </div>
              <div className="rounded-md border border-border bg-secondary/30 divide-y divide-border max-h-52 overflow-y-auto">
                {logsLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : logs.length === 0 ? (
                  <div className="text-center py-6 text-xs text-muted-foreground">
                    Nenhuma requisição recebida ainda.
                  </div>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between px-3 py-2 gap-2">
                      <span className="text-[11px] text-muted-foreground font-mono truncate">
                        {new Date(log.received_at).toLocaleString("pt-BR")}
                      </span>
                      <Badge
                        className={`text-[10px] shrink-0 ${logStatusColor(log.status)} bg-transparent border-0 p-0`}
                      >
                        {log.status}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <span className="text-xs font-medium text-muted-foreground">
                  Eventos suportados
                </span>
                <p className="text-[11px] text-muted-foreground/60 mt-1">
                  O endpoint aceita tanto mensagens de WhatsApp quanto sinais de mercado. Troque os IDs de exemplo antes de testar.
                </p>
              </div>

              {webhookExamples.map((kind) => (
                <div key={kind} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {kind === "whatsapp_message" ? "WhatsApp" : "Sinal de mercado"}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {kind}
                    </Badge>
                  </div>
                  <Textarea
                    readOnly
                    value={JSON.stringify(AUTOMATION_EVENT_BLUEPRINTS[kind], null, 2)}
                    className="min-h-[160px] font-mono text-[11px]"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── API Key (outros) ──────────────────────────────── */}
        {!isWebhook && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                API Key
              </label>
              <Input
                type="password"
                placeholder="sk-..."
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setTestState("idle");
                }}
                className="font-mono text-sm"
              />
            </div>

            {testState !== "idle" && (
              <div
                className={`flex items-center gap-2 text-xs px-3 py-2 rounded-md border ${
                  testState === "ok"
                    ? "border-green-500/20 bg-green-500/10 text-green-600"
                    : testState === "fail"
                    ? "border-red-500/20 bg-red-500/10 text-red-500"
                    : "border-border bg-secondary/50 text-muted-foreground"
                }`}
              >
                {testState === "loading" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                ) : testState === "ok" ? (
                  <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 shrink-0" />
                )}
                {testState === "loading" ? "Testando conexão..." : testMessage}
              </div>
            )}

            <button
              onClick={handleTest}
              disabled={!apiKey || testState === "loading"}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-border hover:bg-secondary transition-colors text-muted-foreground disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {testState === "loading" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle className="h-3.5 w-3.5" />
              )}
              Testar conexão
            </button>
          </div>
        )}

        <DialogFooter className="gap-2">
          {integration.status === "connected" && (
            <button
              onClick={handleDisconnect}
              disabled={saving}
              className="flex-1 px-3 py-2 text-xs font-medium rounded-lg border border-red-500/30 hover:bg-red-500/10 transition-colors text-red-500 disabled:opacity-40"
            >
              Desconectar
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 text-xs font-medium rounded-lg border border-border hover:bg-secondary transition-colors text-muted-foreground"
          >
            Cancelar
          </button>
          {isWebhook && (
            <button
              onClick={handleWebhookConnect}
              disabled={saving}
              className="flex-1 px-3 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? "Salvando..." : integration.status === "connected" ? "Salvar ajustes" : "Ativar webhook"}
            </button>
          )}
          {!isWebhook && (
            <button
              onClick={handleSave}
              disabled={saving || !apiKey || testState === "fail"}
              className="flex-1 px-3 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
