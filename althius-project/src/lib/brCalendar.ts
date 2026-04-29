export type CalendarEventKind = "national_holiday" | "optional_point" | "partial_optional";
export type CalendarPressure = "normal" | "accelerate" | "recover" | "blocked";

export interface BrCalendarEvent {
  date: string;
  name: string;
  kind: CalendarEventKind;
  startsAfter?: string;
}

export interface CalendarDay {
  date: string;
  dayOfMonth: number;
  weekday: number;
  inMonth: boolean;
  isWeekend: boolean;
  isToday: boolean;
  isWorkingDay: boolean;
  pressure: CalendarPressure;
  events: BrCalendarEvent[];
}

const SOURCE =
  "Portaria MGI n. 11.460/2025, calendario oficial de feriados nacionais e pontos facultativos de 2026.";

export const BR_2026_CALENDAR_SOURCE = SOURCE;

export const BR_2026_EVENTS: BrCalendarEvent[] = [
  { date: "2026-01-01", name: "Confraternizacao Universal", kind: "national_holiday" },
  { date: "2026-02-16", name: "Carnaval", kind: "optional_point" },
  { date: "2026-02-17", name: "Carnaval", kind: "optional_point" },
  { date: "2026-02-18", name: "Quarta-Feira de Cinzas", kind: "partial_optional", startsAfter: "14:00" },
  { date: "2026-04-03", name: "Paixao de Cristo", kind: "national_holiday" },
  { date: "2026-04-20", name: "Ponte de Tiradentes", kind: "optional_point" },
  { date: "2026-04-21", name: "Tiradentes", kind: "national_holiday" },
  { date: "2026-05-01", name: "Dia Mundial do Trabalho", kind: "national_holiday" },
  { date: "2026-06-04", name: "Corpus Christi", kind: "optional_point" },
  { date: "2026-06-05", name: "Ponte de Corpus Christi", kind: "optional_point" },
  { date: "2026-09-07", name: "Independencia do Brasil", kind: "national_holiday" },
  { date: "2026-10-12", name: "Nossa Senhora Aparecida", kind: "national_holiday" },
  { date: "2026-10-28", name: "Dia do Servidor Publico federal", kind: "optional_point" },
  { date: "2026-11-02", name: "Finados", kind: "national_holiday" },
  { date: "2026-11-15", name: "Proclamacao da Republica", kind: "national_holiday" },
  { date: "2026-11-20", name: "Dia Nacional de Zumbi e da Consciencia Negra", kind: "national_holiday" },
  { date: "2026-12-24", name: "Vespera do Natal", kind: "partial_optional", startsAfter: "13:00" },
  { date: "2026-12-25", name: "Natal", kind: "national_holiday" },
  { date: "2026-12-31", name: "Vespera do Ano Novo", kind: "partial_optional", startsAfter: "13:00" },
];

export const MONTH_LABELS = [
  "Janeiro",
  "Fevereiro",
  "Marco",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function toDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDateKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatDatePtBr(key: string) {
  return parseDateKey(key).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    weekday: "short",
  });
}

export function getEventsForDate(dateKey: string) {
  return BR_2026_EVENTS.filter((event) => event.date === dateKey);
}

export function isBusinessBlocked(events: BrCalendarEvent[]) {
  return events.some((event) => event.kind === "national_holiday" || event.kind === "optional_point");
}

export function isWorkingDay(date: Date) {
  const weekday = date.getDay();
  const events = getEventsForDate(toDateKey(date));
  return weekday !== 0 && weekday !== 6 && !isBusinessBlocked(events);
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function pressureForDay(date: Date, events: BrCalendarEvent[]): CalendarPressure {
  if (isBusinessBlocked(events)) return "blocked";

  const prev = addDays(date, -1);
  const next = addDays(date, 1);
  const prevEvents = getEventsForDate(toDateKey(prev));
  const nextEvents = getEventsForDate(toDateKey(next));

  if (isBusinessBlocked(nextEvents)) return "accelerate";
  if (isBusinessBlocked(prevEvents)) return "recover";
  return "normal";
}

export function getMonthDays(year: number, monthIndex: number): CalendarDay[] {
  const todayKey = toDateKey(new Date());
  const first = new Date(year, monthIndex, 1);
  const start = addDays(first, -first.getDay());
  const days: CalendarDay[] = [];

  for (let i = 0; i < 42; i += 1) {
    const date = addDays(start, i);
    const dateKey = toDateKey(date);
    const events = getEventsForDate(dateKey);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

    days.push({
      date: dateKey,
      dayOfMonth: date.getDate(),
      weekday: date.getDay(),
      inMonth: date.getMonth() === monthIndex,
      isWeekend,
      isToday: dateKey === todayKey,
      isWorkingDay: !isWeekend && !isBusinessBlocked(events),
      pressure: pressureForDay(date, events),
      events,
    });
  }

  return days;
}

export function countWorkingDays(startKey: string, endKey: string) {
  const start = parseDateKey(startKey);
  const end = parseDateKey(endKey);
  let count = 0;
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    if (isWorkingDay(cursor)) count += 1;
  }
  return count;
}

export function getMonthWorkingDays(year: number, monthIndex: number) {
  const start = `${year}-${pad(monthIndex + 1)}-01`;
  const endDate = new Date(year, monthIndex + 1, 0);
  return countWorkingDays(start, toDateKey(endDate));
}

export function getRemainingWorkingDaysInMonth(baseDate = new Date()) {
  const start = toDateKey(baseDate);
  const end = toDateKey(new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0));
  return countWorkingDays(start, end);
}

export function getUpcomingEvents(limit = 5, baseDate = new Date()) {
  const baseKey = toDateKey(baseDate);
  return BR_2026_EVENTS.filter((event) => event.date >= baseKey)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit);
}

export function getOperationalCalendarInsights(baseDate = new Date()) {
  const todayKey = toDateKey(baseDate);
  const todayEvents = getEventsForDate(todayKey);
  const upcoming = getUpcomingEvents(3, baseDate);
  const remainingWorkingDays = getRemainingWorkingDaysInMonth(baseDate);
  const nextBlocked = upcoming.find((event) => event.kind !== "partial_optional");

  return {
    todayKey,
    todayEvents,
    upcoming,
    remainingWorkingDays,
    nextBlocked,
    isBlockedToday: isBusinessBlocked(todayEvents) || baseDate.getDay() === 0 || baseDate.getDay() === 6,
  };
}
