import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BR_2026_CALENDAR_SOURCE,
  formatDatePtBr,
  getMonthDays,
  getMonthWorkingDays,
  getOperationalCalendarInsights,
  getUpcomingEvents,
  MONTH_LABELS,
  WEEKDAY_LABELS,
} from "@/lib/brCalendar";
import { PIPA_GTM_CONTEXT } from "@/lib/pipaGtm";

const EVENT_STYLE = {
  national_holiday: "bg-red-500/10 text-red-600 border-red-500/20",
  optional_point: "bg-yellow-500/15 text-yellow-700 border-yellow-500/20",
  partial_optional: "bg-blue-500/10 text-blue-600 border-blue-500/20",
};

const EVENT_LABEL = {
  national_holiday: "Feriado",
  optional_point: "Ponto facultativo",
  partial_optional: "Meio periodo",
};

const PRESSURE_STYLE = {
  normal: "",
  accelerate: "ring-1 ring-orange-400/50 bg-orange-500/5",
  recover: "ring-1 ring-blue-400/40 bg-blue-500/5",
  blocked: "bg-muted/70 text-muted-foreground",
};

function monthTitle(year: number, monthIndex: number) {
  return `${MONTH_LABELS[monthIndex]} ${year}`;
}

export default function CalendarPage() {
  const today = new Date();
  const [cursor, setCursor] = useState(() => new Date(2026, today.getMonth(), 1));

  const year = cursor.getFullYear();
  const monthIndex = cursor.getMonth();
  const days = useMemo(() => getMonthDays(year, monthIndex), [year, monthIndex]);
  const monthEvents = days.flatMap((day) => (day.inMonth ? day.events : []));
  const workingDays = getMonthWorkingDays(year, monthIndex);
  const insights = getOperationalCalendarInsights(today);
  const upcomingEvents = getUpcomingEvents(6, today);
  const requiredPhase0 = Math.ceil(
    PIPA_GTM_CONTEXT.commercialGoal.monthlyAccountsInPhase0 / Math.max(workingDays, 1),
  );

  function moveMonth(delta: number) {
    setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">Calendário</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Brasil 2026. Foco em feriados, dias úteis e ritmo de execução.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="icon" onClick={() => moveMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-40 rounded-lg border bg-card px-4 py-2 text-center text-sm font-semibold">
            {monthTitle(year, monthIndex)}
          </div>
          <Button type="button" variant="outline" size="icon" onClick={() => moveMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
        <div className="rounded-full border bg-card px-3 py-1.5 text-muted-foreground">
          <strong className="text-foreground">{workingDays}</strong> dias úteis no mês
        </div>
        <div className="rounded-full border bg-card px-3 py-1.5 text-muted-foreground">
          <strong className="text-foreground">{monthEvents.length}</strong> datas críticas
        </div>
        <div className="rounded-full border bg-card px-3 py-1.5 text-muted-foreground">
          <strong className="text-foreground">{requiredPhase0}/dia</strong> ritmo Fase 0
        </div>
        <div className="rounded-full border bg-card px-3 py-1.5 text-muted-foreground">
          <strong className="text-foreground">{insights.remainingWorkingDays}</strong> dias úteis restantes
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="grid grid-cols-7 border-b bg-muted/40">
            {WEEKDAY_LABELS.map((weekday) => (
              <div key={weekday} className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">
                {weekday}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {days.map((day) => (
              <div
                key={day.date}
                className={[
                  "min-h-28 border-b border-r p-2 transition-colors last:border-r-0",
                  day.inMonth ? "bg-card" : "bg-muted/20 text-muted-foreground/50",
                  day.isToday ? "outline outline-2 outline-primary outline-offset-[-2px]" : "",
                  PRESSURE_STYLE[day.pressure],
                ].join(" ")}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className={day.isToday ? "font-bold text-primary" : "text-sm font-medium"}>
                    {day.dayOfMonth}
                  </span>
                  {day.pressure !== "normal" && day.inMonth && <span className="h-2 w-2 rounded-full bg-primary/70" />}
                </div>

                <div className="space-y-1">
                  {day.events.map((event) => (
                    <div
                      key={`${day.date}-${event.name}`}
                      className={`rounded-md border px-2 py-1 text-[11px] leading-tight ${EVENT_STYLE[event.kind]}`}
                    >
                      <p className="font-semibold">{EVENT_LABEL[event.kind]}</p>
                      <p>{event.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-xl border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Próximas datas</h2>
            </div>
            <div className="space-y-2">
              {upcomingEvents.map((event) => (
                <div key={event.date} className="rounded-lg border px-3 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{event.name}</p>
                      <p className="text-xs text-muted-foreground">{formatDatePtBr(event.date)}</p>
                    </div>
                    <Badge variant="outline" className={EVENT_STYLE[event.kind]}>
                      {EVENT_LABEL[event.kind]}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
            <p>
              {PIPA_GTM_CONTEXT.commercialGoal.weeklyAccountsInPhase0} contas novas por semana.
            </p>
            <p className="mt-2">
              Acelerar no dia útil anterior ao feriado e retomar no próximo útil.
            </p>
          </div>

          <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
            Fonte: {BR_2026_CALENDAR_SOURCE}
          </p>
        </aside>
      </div>
    </DashboardLayout>
  );
}
