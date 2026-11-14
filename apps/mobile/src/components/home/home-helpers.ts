import { parseISO } from 'date-fns';

export function getGreeting(): {
  key:
    | 'home.greetingMorning'
    | 'home.greetingAfternoon'
    | 'home.greetingEvening'
    | 'home.greetingNight';
} {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return { key: 'home.greetingMorning' };
  if (hour >= 12 && hour < 17) return { key: 'home.greetingAfternoon' };
  if (hour >= 17 && hour < 22) return { key: 'home.greetingEvening' };
  return { key: 'home.greetingNight' };
}

/** "Jun 12, 2026 – Jun 15" in the rider's language; `undefined` without a start date. */
export function formatTripDates(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  language: string,
): string | undefined {
  if (!startDate) return undefined;
  const start = parseISO(startDate).toLocaleDateString(language, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  if (!endDate || endDate === startDate) return start;
  const end = parseISO(endDate).toLocaleDateString(language, { month: 'short', day: 'numeric' });
  return `${start} – ${end}`;
}
