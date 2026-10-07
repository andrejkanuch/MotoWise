import type { ExpenseCategory } from '@motovault/types';
import type { JsonType } from '@posthog/core';
import { isBefore, isValid, parseISO, startOfDay } from 'date-fns';
import { AnalyticsEvent, trackEvent } from './analytics';

/**
 * Where an expense came from. `expense_added` fires on EVERY path that creates
 * an expense row, and this says which one — until 3.21.0 only the manual form
 * fired it, so PostHog under-counted expenses against the database.
 */
export const EXPENSE_ENTRY_SOURCE = {
  /** The Add Expense form, opened from the garage / dashboard / quick actions. */
  MANUAL: 'manual',
  /** The Add Expense form opened from the bike hub (Log sheet, Costs pill, Costs segment). */
  BIKE_HUB: 'bike_hub',
  /** The Add Expense form pre-filled from a failed or partial receipt scan. */
  RECEIPT_SCAN_FALLBACK: 'receipt_scan_fallback',
  /** The quick logger on the ride summary. */
  RIDE: 'ride',
  /** A saved receipt scan — an expense, or a service whose cost spawns one. */
  RECEIPT_SCAN: 'receipt_scan',
  /** A receipt scan saved during onboarding. */
  ONBOARDING: 'onboarding',
  /** Completing a maintenance task with a cost (the server adds a linked expense). */
  MAINTENANCE_COST: 'maintenance_cost',
} as const;

/**
 * Category of the expense the server links to a completed, costed maintenance
 * task (ExpensesService.createFromTask).
 */
export const MAINTENANCE_EXPENSE_CATEGORY: ExpenseCategory = 'maintenance';

export type ExpenseEntrySource = (typeof EXPENSE_ENTRY_SOURCE)[keyof typeof EXPENSE_ENTRY_SOURCE];

const ENTRY_SOURCES: readonly string[] = Object.values(EXPENSE_ENTRY_SOURCE);

/** Narrow an untrusted value (e.g. a route param) to an entry source. */
export function parseExpenseEntrySource(
  value: unknown,
  fallback: ExpenseEntrySource,
): ExpenseEntrySource {
  return typeof value === 'string' && ENTRY_SOURCES.includes(value)
    ? (value as ExpenseEntrySource)
    : fallback;
}

/**
 * The expense amount a completed maintenance task creates, from the cost field
 * as typed, or null when it creates none (empty, non-numeric, or not positive —
 * the server links an expense only for a positive cost).
 */
export function taskCompletionExpenseAmount(cost: string | null | undefined): number | null {
  const value = cost ? Number.parseFloat(cost) : Number.NaN;
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** An expense date as the rider entered it: a Date, or an ISO `YYYY-MM-DD[...]` string. */
export type ExpenseDate = Date | string | null | undefined;

function toDate(date: ExpenseDate): Date | null {
  if (date == null) return null;
  const parsed = typeof date === 'string' ? parseISO(date) : date;
  return isValid(parsed) ? parsed : null;
}

/** True when the expense is dated before today (local calendar day). */
export function isBackdated(date: ExpenseDate, now: Date = new Date()): boolean {
  const parsed = toDate(date);
  return parsed != null && isBefore(parsed, startOfDay(now));
}

export interface ExpenseAddedInput {
  entrySource: ExpenseEntrySource;
  bikeId: string | null | undefined;
  date: ExpenseDate;
  /** Path-specific extras (category, amount, currency, record_type…). */
  properties?: Record<string, JsonType>;
  now?: Date;
}

export function expenseAddedProperties(input: ExpenseAddedInput): Record<string, JsonType> {
  return {
    ...input.properties,
    entry_source: input.entrySource,
    bike_id: input.bikeId || null,
    is_backdated: isBackdated(input.date, input.now),
  };
}

export function trackExpenseAdded(input: ExpenseAddedInput): void {
  trackEvent(AnalyticsEvent.EXPENSE_ADDED, expenseAddedProperties(input));
}
