import type { MoneyTotal } from './expense-money';

const ACTIVE_STATUSES = new Set(['pending', 'in_progress']);
const PRIORITY_WEIGHT: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

interface PerCurrencyTotal extends MoneyTotal {
  count: number;
}

/**
 * Adds per-bike totals into one list per currency. Only amounts in the same
 * currency are added: €50 on one bike and $40 on another stay two totals.
 * Sorted most-used first (count, then total, then code), like the API lists.
 */
export function sumTotalsPerCurrency(
  lists: ReadonlyArray<ReadonlyArray<PerCurrencyTotal>>,
): MoneyTotal[] {
  const sums = new Map<string, PerCurrencyTotal>();
  for (const { currency, total, count } of lists.flat()) {
    const entry = sums.get(currency) ?? { currency, total: 0, count: 0 };
    entry.total += total;
    entry.count += count;
    sums.set(currency, entry);
  }
  return [...sums.values()]
    .filter(({ total }) => total !== 0)
    .sort((a, b) => b.count - a.count || b.total - a.total || a.currency.localeCompare(b.currency))
    .map(({ currency, total }) => ({ currency, total }));
}

interface ServiceTask {
  dueDate?: string | null;
  priority: string;
  status: string;
}

/**
 * The most urgent active task with a due date: the earliest due date first
 * (so overdue tasks come first), then the higher priority. The same order as
 * the next service on the app's home screen.
 */
export function pickNextService<T extends ServiceTask>(tasks: ReadonlyArray<T>): T | undefined {
  return tasks
    .filter((task) => ACTIVE_STATUSES.has(task.status) && task.dueDate)
    .sort(
      (a, b) =>
        new Date(a.dueDate as string).getTime() - new Date(b.dueDate as string).getTime() ||
        (PRIORITY_WEIGHT[b.priority] ?? 0) - (PRIORITY_WEIGHT[a.priority] ?? 0),
    )[0];
}

/**
 * The bikes a rider sees in full on the web: every bike with Pro, else the
 * first one. The same rule as the locked bike cards in the garage.
 */
export function webVisibleBikes<B>(bikes: ReadonlyArray<B>, isPro: boolean): B[] {
  return isPro ? [...bikes] : bikes.slice(0, 1);
}
