import { addDays, isWorkingDay, toDateKey } from '@/lib/brCalendar';

export const CADENCE_TOTAL_DAYS = 21;

function nextWorkingDate(date: Date) {
  let cursor = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  while (!isWorkingDay(cursor)) {
    cursor = addDays(cursor, 1);
  }
  return cursor;
}

function dueDateForCadenceDay(startDate: Date, cadenceDay: number) {
  return toDateKey(nextWorkingDate(addDays(startDate, cadenceDay - 1)));
}

export function getCadenceDayFromStart(
  startedAt: string | null | undefined,
  today = new Date(),
) {
  if (!startedAt) return 0;

  const started = new Date(startedAt);
  if (Number.isNaN(started.getTime())) return 0;

  const todayKey = toDateKey(today);
  const startDate = new Date(
    started.getFullYear(),
    started.getMonth(),
    started.getDate(),
  );

  let currentDay = 0;
  for (let cadenceDay = 1; cadenceDay <= CADENCE_TOTAL_DAYS; cadenceDay += 1) {
    if (dueDateForCadenceDay(startDate, cadenceDay) <= todayKey) {
      currentDay = cadenceDay;
      continue;
    }
    break;
  }

  return currentDay;
}

export function getCompanyCadenceDay(company: {
  cadence_day?: number | null;
  cadence_started_at?: string | null;
  cadence_status?: string | null;
}) {
  const storedDay = company.cadence_day ?? 0;
  const derivedDay = getCadenceDayFromStart(company.cadence_started_at);

  if (company.cadence_status === 'active') {
    return Math.max(storedDay, derivedDay);
  }

  return storedDay || derivedDay;
}

export function formatCadenceStatus(status: string | null | undefined) {
  switch (status) {
    case 'active':
      return 'Em andamento';
    case 'paused':
      return 'Pausada';
    case 'meeting_booked':
      return 'Reunião agendada';
    case 'proposal_sent':
      return 'Proposta enviada';
    case 'won':
      return 'Ganha';
    case 'lost':
      return 'Perdida';
    default:
      return 'Não iniciada';
  }
}
