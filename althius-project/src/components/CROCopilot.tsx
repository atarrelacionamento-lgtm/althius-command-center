import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { Brain, Send, X, Sparkles, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { supabase } from "@/lib/supabase";
import { getOperationalCalendarInsights } from "@/lib/brCalendar";
import { PIPA_GTM_CONTEXT } from "@/lib/pipaGtm";
import { getGtmMetrics } from "@/services/gtmMetricsService";

// ── Types ────────────────────────────────────────────────

interface Message {
  role: "user" | "assistant";
  content: string;
}

// ── Quick prompts ────────────────────────────────────────

const QUICK_PROMPTS = [
  "Qual conta devo priorizar hoje?",
  "O que esta travando meu GTM agora?",
  "Me ajuda a escrever uma abertura com lead oculto",
  "Como responder uma objeção de 'já temos CRM'?",
  "Analisa o risco de nao bater a meta do mes",
  "Qual proxima acao para esta conta?",
];

async function getRouteContext(pathname: string) {
  const metrics = await getGtmMetrics();
  const calendar = getOperationalCalendarInsights();
  const companyMatch = pathname.match(/\/crm\/empresas\/([^/]+)/);

  if (!companyMatch) {
    return {
      pathname,
      gtm: PIPA_GTM_CONTEXT,
      calendar,
      metrics,
      company: null,
    };
  }

  const companyId = companyMatch[1];
  const [company, contacts, launches, signals, interactions] = await Promise.all([
    supabase.from("companies").select("*").eq("id", companyId).maybeSingle(),
    supabase.from("contacts").select("id, name, role, email, whatsapp").eq("company_id", companyId).order("name"),
    supabase.from("company_launches").select("*").eq("company_id", companyId).order("created_at", { ascending: false }),
    supabase.from("account_signals").select("*").eq("company_id", companyId).order("detected_at", { ascending: false }),
    supabase.from("interactions").select("*").eq("company_id", companyId).order("created_at", { ascending: false }).limit(10),
  ]);

  return {
    pathname,
    gtm: PIPA_GTM_CONTEXT,
    calendar,
    metrics,
    company: {
      data: company.data,
      contacts: contacts.data ?? [],
      launches: launches.data ?? [],
      signals: signals.data ?? [],
      recentInteractions: interactions.data ?? [],
    },
  };
}

function localGuidance(question: string, context: Awaited<ReturnType<typeof getRouteContext>>) {
  const company = context.company?.data as { name?: string; buying_signal?: string; cadence_status?: string } | null;
  const hasCompany = Boolean(company?.name);
  const nextBlocked = context.calendar.nextBlocked;
  const pending = context.metrics.presales.find((metric) => metric.label === "Acoes pendentes")?.value ?? "0";
  const hot = context.metrics.presales.find((metric) => metric.label === "Contas em base")?.detail ?? "";

  if (hasCompany) {
    return [
      `Minha leitura rapida da conta ${company?.name}:`,
      "",
      `1. Prioridade: ${company?.buying_signal === "hot" ? "alta, a conta esta burning" : "validar urgencia antes de insistir"}.`,
      `2. Cadencia: ${company?.cadence_status === "active" ? "ja esta ativa, revise tarefas pendentes no Comando do Dia" : "ainda precisa iniciar com pelo menos 2 pessoas da conta"}.`,
      "3. Melhor proxima acao: conectar a dor a VGV parado, resposta lenta ou falta de follow-up, usando o diagnostico de lead oculto.",
      "",
      `Pergunta recebida: ${question}`,
    ].join("\n");
  }

  return [
    "Minha leitura rapida do GTM:",
    "",
    `1. Acoes pendentes: ${pending}. Limpe o Comando do Dia antes de abrir novas frentes.`,
    `2. Priorizacao: ${hot || "procure contas com lancamento ativo, midia relevante e sinais recentes"}.`,
    `3. Calendario: ${nextBlocked ? `${nextBlocked.name} em ${nextBlocked.date}. Antecipe Fase 0 e follow-ups.` : "sem bloqueio comercial imediato."}`,
    "4. Meta: manter 50 contas novas por semana em Fase 0 para sustentar 4 contratos no mes.",
    "",
    `Pergunta recebida: ${question}`,
  ].join("\n");
}

// ── Message bubble ───────────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
          <Brain className="h-3.5 w-3.5 text-primary" />
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted text-foreground rounded-bl-sm"
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────

export function CROCopilot() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: context } = useQuery({
    queryKey: ["cro-copilot-context", location.pathname],
    queryFn: () => getRouteContext(location.pathname),
    enabled: open,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open && messages.length === 0) {
      // Welcome message
      setMessages([
        {
          role: "assistant",
          content: `Olá, Renan. Sou seu CRO Copilot.\n\nVou olhar o GTM da Althius pelo prisma certo: conta, pessoas, sinais, calendário, lead oculto, cadência e VGV. O que precisa destravar agora?`,
        },
      ]);
    }
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, messages.length]);

  async function sendMessage(text?: string) {
    const content = (text ?? input).trim();
    if (!content || isLoading) return;

    const userMsg: Message = { role: "user", content };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("cro-copilot", {
        body: {
          messages: nextMessages,
          context,
        },
      });

      if (error) throw error;

      const assistantContent = data?.content || "Não consegui processar sua mensagem. Tente novamente.";
      setMessages((prev) => [...prev, { role: "assistant", content: assistantContent }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: context
            ? localGuidance(content, context)
            : `Nao consegui carregar o contexto completo agora: ${String(err)}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function reset() {
    setMessages([]);
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full border bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-transform hover:scale-105"
        title="CRO Copilot (IA)"
      >
        <Brain className="h-5 w-5" />
        <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-green-400 ring-2 ring-background" />
      </button>

      {/* Sheet panel */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" hideClose className="w-full sm:max-w-md flex flex-col p-0 gap-0">
          {/* Header */}
          <SheetHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center">
                <Brain className="h-4 w-4 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-sm font-semibold leading-tight">CRO Copilot</SheetTitle>
                <p className="text-xs text-muted-foreground">Meta R$ 50k · ABM Intelligence</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={reset} title="Nova conversa">
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </SheetHeader>

          {/* Stats strip */}
          {context && (
            <div className="flex items-center gap-4 px-4 py-2 bg-muted/30 border-b text-xs text-muted-foreground">
              <span><strong className="text-foreground">{context.metrics.calendar.remainingWorkingDays}</strong> dias uteis</span>
              <span><strong className="text-orange-500">{context.metrics.calendar.requiredPhase0PerWorkingDay}</strong> Fase 0/dia</span>
              <span><strong className="text-primary">{context.company?.data ? "conta" : "geral"}</strong> contexto</span>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} />
            ))}

            {isLoading && (
              <div className="flex gap-2 justify-start">
                <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                  <Brain className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2.5">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick prompts — only before first user message */}
          {messages.filter(m => m.role === "user").length === 0 && !isLoading && (
            <div className="px-4 pb-2 space-y-1.5">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Ações rápidas
              </p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    className="text-xs px-2.5 py-1.5 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors border border-border text-left"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="px-4 py-3 border-t bg-card">
            <div className="flex gap-2 items-end">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pergunte sobre contas, estratégia, mensagens…"
                className="min-h-[44px] max-h-32 resize-none text-sm"
                rows={1}
                disabled={isLoading}
              />
              <Button
                size="icon"
                className="h-11 w-11 shrink-0"
                onClick={() => sendMessage()}
                disabled={!input.trim() || isLoading}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground/50 mt-1.5 text-center">
              Enter para enviar · Shift+Enter para nova linha
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
