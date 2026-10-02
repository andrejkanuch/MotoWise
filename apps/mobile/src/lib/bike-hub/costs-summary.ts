import type { ExpensesByMotorcycleQuery } from '@motovault/graphql';
import { endOfDay, isSameMonth, parseISO, subYears } from 'date-fns';
import {
  COSTS_REST_KEY,
  COSTS_TOP_SHARES,
  DELTA_DIRECTION,
  type DeltaDirection,
} from './constants';

type ExpenseSummary = ExpensesByMotorcycleQuery['expenses'];

/** The `expenses(motorcycleId, year)` payload: every expense of one year, grouped by category. */
export type CostsYearInput = Pick<ExpenseSummary, 'categories'>;

export interface CostsShare {
  /** Expense category key, or `COSTS_REST_KEY` for everything beyond the top five. */
  key: string;
  total: number;
  /** Whole percent of the year's total. */
  percent: number;
}

export interface CostsYoy {
  direction: DeltaDirection;
  /** Absolute difference to the same period of last year. */
  amount: number;
  /** Whole percent of last year's same-period total. */
  percent: number;
}

export interface CostsSummary {
  total: number;
  samePeriodLastYear: number;
  /** `null` when last year's same period has no spend (nothing to compare with). */
  yoy: CostsYoy | null;
  thisMonth: number;
  /** `total / monthsCounted`, unrounded. */
  perMonth: number;
  /** Completed calendar months of the year, at least 1 — the "per month" denominator. */
  monthsCounted: number;
  /** Top categories by spend, then one `rest` share when more exist. */
  shares: CostsShare[];
  topCategory: { key: string; percent: number } | null;
}

export interface CostsSummaryInput {
  currentYearExpenses: CostsYearInput | null | undefined;
  previousYearExpenses: CostsYearInput | null | undefined;
  today: Date;
}

interface FlatExpense {
  amount: number;
  date: Date;
}

function flatten(year: CostsYearInput | null | undefined): FlatExpense[] {
  return (year?.categories ?? []).flatMap((category) =>
    category.expenses.map((expense) => ({ amount: expense.amount, date: parseISO(expense.date) })),
  );
}

function sum(expenses: readonly FlatExpense[]): number {
  return expenses.reduce((total, expense) => total + expense.amount, 0);
}

function percentOf(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

function directionOf(difference: number): DeltaDirection {
  if (difference > 0) return DELTA_DIRECTION.UP;
  if (difference < 0) return DELTA_DIRECTION.DOWN;
  return DELTA_DIRECTION.FLAT;
}

function buildShares(year: CostsYearInput | null | undefined, total: number): CostsShare[] {
  const ranked = (year?.categories ?? [])
    .filter((category) => category.total > 0)
    .sort((a, b) => b.total - a.total);
  const top = ranked.slice(0, COSTS_TOP_SHARES).map((category) => ({
    key: category.category,
    total: category.total,
    percent: percentOf(category.total, total),
  }));
  const rest = ranked.slice(COSTS_TOP_SHARES);
  if (rest.length === 0) return top;
  // The remainder takes what the rounded top shares leave, so the bar adds up to 100.
  const restPercent = Math.max(0, 100 - top.reduce((acc, share) => acc + share.percent, 0));
  return [
    ...top,
    {
      key: COSTS_REST_KEY,
      total: rest.reduce((acc, category) => acc + category.total, 0),
      percent: restPercent,
    },
  ];
}

/**
 * Figures of the Overview costs card. "Same period" = last year's expenses dated
 * on or before today's month-day (Feb 29 clamps to Feb 28). "Per month" divides
 * by the completed calendar months of the year (minimum 1).
 */
export function summariseCosts(input: CostsSummaryInput): CostsSummary {
  const { currentYearExpenses, previousYearExpenses, today } = input;
  const current = flatten(currentYearExpenses);
  const total = sum(current);

  const cutoff = endOfDay(subYears(today, 1));
  const samePeriodLastYear = sum(
    flatten(previousYearExpenses).filter((expense) => expense.date <= cutoff),
  );
  const difference = total - samePeriodLastYear;
  const yoy: CostsYoy | null =
    samePeriodLastYear > 0
      ? {
          direction: directionOf(difference),
          amount: Math.abs(difference),
          percent: percentOf(Math.abs(difference), samePeriodLastYear),
        }
      : null;

  const monthsCounted = Math.max(1, today.getMonth());
  const shares = buildShares(currentYearExpenses, total);
  const top = shares.find((share) => share.key !== COSTS_REST_KEY);

  return {
    total,
    samePeriodLastYear,
    yoy,
    thisMonth: sum(current.filter((expense) => isSameMonth(expense.date, today))),
    perMonth: total / monthsCounted,
    monthsCounted,
    shares,
    topCategory: top ? { key: top.key, percent: top.percent } : null,
  };
}
