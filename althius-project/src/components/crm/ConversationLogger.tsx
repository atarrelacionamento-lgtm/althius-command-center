import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare, Sparkles, Loader2, Copy, CheckCircle2,
  AlertTriangle, TrendingUp, ChevronDown, ChevronUp,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { PersonaType } from "@/services/abmService";

// ── Types ────────────────────────────────────────────────

interface ConversationAnalysis {
  summary: string;
  sentiment: "positive" | "neutral" | "negative" | "objecting";
  interest_level: "high" | "medium" | "low" | "none";
  objections: string[];
  next_steps: string[];
  suggested_reply: string;
  signal_recommendation: "hot" | "warm" | "cold";
  key_insights: string[];
  cadence_guidance: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companyName: string;
  contactId?: string | null;
  contactName?: string | null;
  cadenceDay?: number | null;
}

// ── Helpers ──────────────────────────────────────────────

const SENTIMENT_CFG = {
  positive:  { label: "Positivo",   color: "bg-green-500/15 text-green-600 border-green-500/20" },
  neutral:   { label: "Neutro",     color: "bg-muted text-muted-foreground" },
  negative:  { label: "Negativo",   color: "bg-destructive/15 text-destructive border-destructive/20" },
  objecting: { label: "Objeções",   color: "bg-yellow-500/15 text-yellow-600 border-yellow-500/20" },
};

const INTEREST_CFG = {
  high:   { label: "Alto interesse",   color: "text-green-600" },
  medium: { label: "Interesse médio",  color: "text-yellow-600" },
  low:    { label: "Baixo interesse",  color: "text-orange-500" },
  none:   { label: "Sem interesse",    color: "text-destructive" },
};

const SIGNAL_CFG = {
  hot:  { label: "🔥 Burning — mover para prioridade máxima", color: "bg-red-500/15 text-red-500" },
  warm: { label: "♨️ Morno — manter cadência",               color: "bg-yellow-500/15 text-yellow-600" },
  cold: { label: "❄️ Frio — reavaliar abordagem",            color: "bg-blue-400/15 text-blue-400" },
};

const PERSONA_OPTIONS: { value: PersonaType; label: string }[] = [
  { value: "cmo",           label: "CMO / Marketing" },
  { value: "dir_comercial", label: "Dir. Comercial" },
  { value: "socio",         label: "Sócio / Fundador" },
  { value: "ceo",           label: "CEO" },
  { value: "other",         label: "Outro" },
];

// ── Analysis Result ──────────────────────────────────────

function AnalysisResult({ analysis, onCopyReply }: {
  analysis: ConversationAnalysis;
  onCopyReply: () => void;
}) {
  const [showReply, setShowReply] = useState(false);
  const sentiment = SENTIMENT_CFG[analysis.sentiment] ?? SENTIMENT_CFG.neutral;
  const interest = INTEREST_CFG[analysis.interest_level] ?? INTEREST_CFG.low;
  const signal = SIGNAL_CFG[analysis.signal_recommendation] ?? SIGNAL_CFG.cold;

  return (
    <div className="space-y-4 mt-4 pt-4 border-t">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold">Análise da IA</p>
      </div>

      {/* Summary */}
      <div className="p-3 rounded-lg bg-muted/40 border">
        <p className="text-sm leading-relaxed">{analysis.summary}</p>
      </div>

      {/* Signals row */}
      <div className="flex flex-wrap gap-2">
        <span className={`text-xs px-2 py-1 rounded-full border font-medium ${sentiment.color}`}>
          {sentiment.label}
        </span>
        <span className={`text-xs font-medium ${interest.color}`}>
          {interest.label}
        </span>
        <span className={`text-xs px-2 py-1 rounded-lg font-medium ${signal.color}`}>
          {signal.label}
        </span>
      </div>

      {/* Objections */}
      {analysis.objections.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Objeções identificadas
          </p>
          <ul className="space-y-1">
            {analysis.objections.map((o, i) => (
              <li key={i} className="text-xs text-foreground bg-yellow-500/5 border border-yellow-500/15 rounded px-2 py-1.5">
                {o}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Next steps */}
      {analysis.next_steps.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
            <TrendingUp className="h-3 w-3" /> Próximos passos
          </p>
          <ul className="space-y-1">
            {analysis.next_steps.map((s, i) => (
              <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0 mt-0.5" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Key insights */}
      {analysis.key_insights?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1.5">Insights chave</p>
          <ul className="space-y-0.5">
            {analysis.key_insights.map((insight, i) => (
              <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                <span className="h-1 w-1 rounded-full bg-primary mt-1.5 shrink-0" />
                {insight}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Cadence guidance */}
      {analysis.cadence_guidance && (
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
          <p className="text-xs font-semibold text-primary mb-0.5">Guia de cadência</p>
          <p className="text-xs text-foreground">{analysis.cadence_guidance}</p>
        </div>
      )}

      {/* Suggested reply */}
      {analysis.suggested_reply && (
        <div>
          <button
            onClick={() => setShowReply(!showReply)}
            className="flex items-center gap-1 text-xs text-primary hover:underline font-medium"
          >
            <MessageSquare className="h-3 w-3" />
            Resposta sugerida pela IA
            {showReply ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          {showReply && (
            <div className="mt-2 p-3 rounded-lg bg-muted/50 border text-xs text-foreground whitespace-pre-wrap leading-relaxed">
              {analysis.suggested_reply}
              <Button
                size="sm"
                variant="outline"
                className="mt-2 h-7 gap-1 text-xs w-full"
                onClick={onCopyReply}
              >
                <Copy className="h-3 w-3" /> Copiar resposta
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────

export function ConversationLogger({ open, onOpenChange, companyId, companyName, contactId, contactName, cadenceDay }: Props) {
  const qc = useQueryClient();
  const [rawText, setRawText] = useState("");
  const [personaType, setPersonaType] = useState<PersonaType>("dir_comercial");
  const [analysis, setAnalysis] = useState<ConversationAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  function handleClose(newOpen: boolean) {
    if (!newOpen) {
      setRawText("");
      setAnalysis(null);
    }
    onOpenChange(newOpen);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Save conversation to DB
      const { data: conv, error } = await supabase
        .from("whatsapp_conversations")
        .insert({
          company_id:     companyId,
          contact_id:     contactId ?? null,
          raw_text:       rawText,
          source:         "manual",
          cadence_day:    cadenceDay ?? null,
          persona_type:   personaType,
          analyzed:       false,
        })
        .select("id")
        .single();

      if (error) throw error;

      // Trigger AI analysis via Edge Function
      setAnalyzing(true);
      const { data: result, error: fnErr } = await supabase.functions.invoke("analyze-conversation", {
        body: {
          conversation_id: conv.id,
          raw_text:        rawText,
          company_name:    companyName,
          contact_name:    contactName ?? null,
          cadence_day:     cadenceDay ?? null,
          persona_type:    personaType,
        },
      });
      setAnalyzing(false);

      if (fnErr) {
        toast.warning("Conversa salva, mas a análise de IA falhou. Verifique a ANTHROPIC_API_KEY.");
      } else {
        setAnalysis(result as ConversationAnalysis);
      }

      return conv;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wa-conversations", companyId] });
      qc.invalidateQueries({ queryKey: ["interactions", companyId] });
      qc.invalidateQueries({ queryKey: ["company", companyId] });
      qc.invalidateQueries({ queryKey: ["companies"] });
      toast.success("Conversa registrada e analisada!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function copyReply() {
    if (analysis?.suggested_reply) {
      navigator.clipboard.writeText(analysis.suggested_reply);
      toast.success("Resposta copiada!");
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0 gap-0 overflow-y-auto">
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-green-500" />
            Registrar conversa — {companyName}
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            Cole o texto da conversa do WhatsApp. A IA vai analisar e sugerir próximos passos.
          </p>
        </SheetHeader>

        <div className="flex-1 px-4 py-4 space-y-4 overflow-y-auto">
          {/* Persona */}
          <div className="space-y-1.5">
            <Label>Persona</Label>
            <Select value={personaType} onValueChange={(v) => setPersonaType(v as PersonaType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERSONA_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Conversation text */}
          <div className="space-y-1.5">
            <Label htmlFor="conv-text">
              Conversa do WhatsApp
              <span className="text-muted-foreground ml-1 font-normal">(cole o texto aqui)</span>
            </Label>
            <Textarea
              id="conv-text"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={12}
              className="font-mono text-xs resize-none"
              placeholder={`[10:30] Renan: Olá João, sou o Renan da Althius Driven...
[10:45] João: Oi Renan, tudo bem?
[10:45] João: Interessante, pode me contar mais?
...`}
            />
            <p className="text-xs text-muted-foreground">
              Dica: no WhatsApp Web, selecione as mensagens → Exportar conversa, ou copie e cole diretamente.
            </p>
          </div>

          {/* Analysis result */}
          {analyzing && (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Analisando conversa com IA…
            </div>
          )}
          {analysis && !analyzing && (
            <AnalysisResult analysis={analysis} onCopyReply={copyReply} />
          )}
        </div>

        <SheetFooter className="px-4 py-3 border-t gap-2">
          <Button type="button" variant="outline" onClick={() => handleClose(false)}>
            {analysis ? "Fechar" : "Cancelar"}
          </Button>
          {!analysis && (
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!rawText.trim() || saveMutation.isPending || analyzing}
              className="gap-1.5"
            >
              {saveMutation.isPending || analyzing
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando…</>
                : <><Sparkles className="h-3.5 w-3.5" /> Salvar e analisar</>
              }
            </Button>
          )}
          {analysis && (
            <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
              <CheckCircle2 className="h-3 w-3 mr-1" /> Registrada
            </Badge>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
