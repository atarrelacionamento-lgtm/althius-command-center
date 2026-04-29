import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare, Linkedin, Phone, Mail, CheckCircle2,
  SkipForward, Flame, Thermometer, Snowflake, Copy,
  Sparkles, TrendingUp, Target, Zap, ChevronDown, ChevronUp,
  Clock, AlertTriangle, CalendarDays
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardLayout } from "@/components/DashboardLayout";
import { getDailyTasks, completeTask, skipTask, getABMStats, type DailyTask, type TaskType, type Urgency } from "@/services/abmService";
import { formatDatePtBr, getOperationalCalendarInsights } from "@/lib/brCalendar";
import { supabase } from "@/lib/supabase";

// ── Helpers ──────────────────────────────────────────────

const TASK_LABELS: Record<TaskType, { label: string; icon: React.ElementType; color: string }> = {
  send_whatsapp: { label: "WhatsApp",  icon: MessageSquare, color: "text-green-500" },
  send_linkedin: { label: "LinkedIn",  icon: Linkedin,      color: "text-blue-500" },
  make_call:     { label: "Ligar",     icon: Phone,         color: "text-purple-500" },
  send_email:    { label: "E-mail",    icon: Mail,          color: "text-orange-500" },
  followup:      { label: "Follow-up", icon: MessageSquare, color: "text-yellow-500" },
};

const PERSONA_LABELS: Record<string, string> = {
  cmo:           "CMO",
  dir_comercial: "Dir. Comercial",
  socio:         "Sócio / CEO",
  ceo:           "CEO",
  other:         "Outro",
};

const SIGNAL_ICON: Record<string, React.ElementType> = {
  hot:  Flame,
  warm: Thermometer,
  cold: Snowflake,
};

const SIGNAL_STYLE: Record<string, string> = {
  hot:  "text-red-500 bg-red-500/10 border-red-500/20",
  warm: "text-orange-500 bg-orange-500/10 border-orange-500/20",
  cold: "text-blue-400 bg-blue-400/10 border-blue-400/20",
};

const URGENCY_STYLE: Record<Urgency, string> = {
  urgent: "border-l-red-500",
  today:  "border-l-yellow-500",
  normal: "border-l-muted",
};

function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  if (urgency === "urgent") return (
    <Badge variant="destructive" className="text-xs gap-1">
      <AlertTriangle className="h-3 w-3" /> Atrasado
    </Badge>
  );
  if (urgency === "today") return (
    <Badge className="text-xs gap-1 bg-yellow-500/20 text-yellow-600 hover:bg-yellow-500/30 border-yellow-500/30">
      <Clock className="h-3 w-3" /> Hoje
    </Badge>
  );
  return null;
}

// ── Task Card ────────────────────────────────────────────

function TaskCard({ task, onDone, onSkip }: {
  task: DailyTask;
  onDone: (id: string) => void;
  onSkip: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const config = TASK_LABELS[task.task_type];
  const Icon = config.icon;
  const signal = task.company?.buying_signal || "cold";
  const SignalIcon = SIGNAL_ICON[signal];

  function copyMessage() {
    if (task.generated_message) {
      navigator.clipboard.writeText(task.generated_message);
      toast.success("Mensagem copiada!");
    }
  }

  return (
    <Card className={`border-l-4 ${URGENCY_STYLE[task.urgency]} transition-all`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Canal icon */}
          <div className={`mt-0.5 rounded-lg p-2 bg-muted ${config.color}`}>
            <Icon className="h-4 w-4" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm truncate">
                {task.company?.name || "Empresa"}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${SIGNAL_STYLE[signal]} flex items-center gap-1`}>
                <SignalIcon className="h-3 w-3" />
                {signal === "hot" ? "Quente" : signal === "warm" ? "Morno" : "Frio"}
              </span>
              <UrgencyBadge urgency={task.urgency} />
            </div>

            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span>{config.label}</span>
              {task.persona_type && (
                <>
                  <span>·</span>
                  <span>{PERSONA_LABELS[task.persona_type]}</span>
                </>
              )}
              {task.cadence_day && (
                <>
                  <span>·</span>
                  <span>Dia {task.cadence_day} — Bloco {task.block_number}</span>
                </>
              )}
              {task.contact?.name && (
                <>
                  <span>·</span>
                  <span>{task.contact.name}</span>
                </>
              )}
            </div>

            {/* Mensagem gerada */}
            {task.generated_message && (
              <div className="mt-3">
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="text-xs text-primary flex items-center gap-1 hover:underline"
                >
                  <Sparkles className="h-3 w-3" />
                  Mensagem gerada pela IA
                  {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
                {expanded && (
                  <div className="mt-2 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap border">
                    {task.generated_message}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {task.generated_message && (
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={copyMessage} title="Copiar mensagem">
                <Copy className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => onSkip(task.id)} title="Pular">
              <SkipForward className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-green-500" onClick={() => onDone(task.id)} title="Marcar como feito">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Stats Bar ────────────────────────────────────────────

function StatsBar() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["abm-stats"],
    queryFn: getABMStats,
  });

  const items = [
    { label: "A fazer hoje",      value: stats?.pendingToday,    icon: Zap,        color: "text-yellow-500" },
    { label: "Feitas hoje",       value: stats?.doneToday,       icon: CheckCircle2, color: "text-green-500" },
    { label: "Contas quentes",    value: stats?.hotAccounts,     icon: Flame,      color: "text-red-500" },
    { label: "Cadências ativas",  value: stats?.activeCadences,  icon: Target,     color: "text-primary" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {items.map(({ label, value, icon: Icon, color }) => (
        <Card key={label}>
          <CardContent className="p-4 flex items-center gap-3">
            <Icon className={`h-5 w-5 shrink-0 ${color}`} />
            <div>
              {isLoading
                ? <Skeleton className="h-6 w-8 mb-1" />
                : <p className="text-xl font-bold">{value ?? 0}</p>
              }
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────

function HojePageContent() {
  const queryClient = useQueryClient();
  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const calendar = getOperationalCalendarInsights();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["daily-tasks"],
    queryFn: () => getDailyTasks(),
    refetchInterval: 60_000,
  });

  const doneMutation = useMutation({
    mutationFn: completeTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["abm-stats"] });
      toast.success("Marcado como feito!");
    },
  });

  const skipMutation = useMutation({
    mutationFn: skipTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-tasks"] });
      toast.info("Ação pulada.");
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("daily-tasks-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "daily_tasks" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["daily-tasks"] });
          queryClient.invalidateQueries({ queryKey: ["abm-stats"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Agrupar por tipo
  const byType = tasks.reduce<Record<TaskType, DailyTask[]>>((acc, t) => {
    if (!acc[t.task_type]) acc[t.task_type] = [];
    acc[t.task_type].push(t);
    return acc;
  }, {} as Record<TaskType, DailyTask[]>);

  const taskOrder: TaskType[] = ["send_whatsapp", "make_call", "send_linkedin", "send_email", "followup"];

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Missão do Dia</h1>
        </div>
        <p className="text-muted-foreground capitalize text-sm">{today}</p>
      </div>

      {/* Stats */}
      <Card className="mb-6">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <CalendarDays className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold">
                {calendar.isBlockedToday ? "Condições Climáticas Adversas" : "Janela de Lançamento Ativa"}
              </p>
              <p className="text-xs text-muted-foreground">
                {calendar.nextBlocked
                  ? `Proxima data critica: ${calendar.nextBlocked.name}, ${formatDatePtBr(calendar.nextBlocked.date)}`
                  : "Sem feriado nacional proximo no calendario de 2026."}
              </p>
            </div>
          </div>
          <Badge variant="outline">{calendar.remainingWorkingDays} dias uteis restantes</Badge>
        </CardContent>
      </Card>

      <StatsBar />

      {/* Tasks */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-3" />
            <p className="font-semibold">Tudo em dia!</p>
            <p className="text-sm text-muted-foreground mt-1">
              Nenhuma ação pendente. Adicione empresas à cadência para gerar tarefas.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {taskOrder.map((type) => {
            const group = byType[type];
            if (!group?.length) return null;
            const config = TASK_LABELS[type];
            const Icon = config.icon;
            return (
              <div key={type}>
                <div className={`flex items-center gap-2 mb-3 ${config.color}`}>
                  <Icon className="h-4 w-4" />
                  <h2 className="text-sm font-semibold uppercase tracking-wide">
                    {config.label} <span className="text-muted-foreground font-normal normal-case">({group.length})</span>
                  </h2>
                </div>
                <div className="space-y-2">
                  {group.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onDone={(id) => doneMutation.mutate(id)}
                      onSkip={(id) => skipMutation.mutate(id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function HojePage() {
  return (
    <DashboardLayout>
      <HojePageContent />
    </DashboardLayout>
  );
}
