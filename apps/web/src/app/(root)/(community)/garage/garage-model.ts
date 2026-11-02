// -------------------------------------------------------------------
// /garage: pure data rules for the read-only garage (no React).
// Spec: features/web-garage-redesign/DATA-MAP.md. Every rule here derives
// from real API fields; anything the API does not have is not computed.
// -------------------------------------------------------------------

import type {
  AllMaintenanceTasksQuery,
  ExpenseDashboardQuery,
  MyMotorcyclesQuery,
} from '@motovault/graphql';
import {
  dashboardBreakdowns,
  MeasurementSystem,
  MileageUnit,
  metersToUnit,
  mileageUnitLabel,
} from '@motovault/types';
import type { createFormatter } from 'next-intl';

export type Bike = MyMotorcyclesQuery['myMotorcycles'][number];
export type Task = AllMaintenanceTasksQuery['allMaintenanceTasks'][number];
export type ExpenseDashboard = ExpenseDashboardQuery['expenseDashboard'];

// ── Page mode ────────────────────────────────────────────────────────

/** Which layout /garage renders. */
export const GarageMode = {
  /** The bike list has not loaded yet: skeletons, no handoff. */
  Loading: 'loading',
  /** The bike list failed: error + retry, no handoff. */
  Error: 'error',
  /** No bike: the empty-account layout. Its hero IS the handoff (no rail, band or bar). */
  Empty: 'empty',
  /** At least one bike: the read-only profile with the rail / band / bar. */
  Populated: 'populated',
} as const;
export type GarageMode = (typeof GarageMode)[keyof typeof GarageMode];

export function garageMode(input: {
  bikes: readonly Bike[] | undefined;
  isLoading: boolean;
  isError: boolean;
}): GarageMode {
  if (input.bikes) return input.bikes.length > 0 ? GarageMode.Populated : GarageMode.Empty;
  if (input.isError) return GarageMode.Error;
  return GarageMode.Loading;
}

/** Whether the rail (≥1024), band (768–1023) and bar (<768) render. */
export function showsAppHandoff(mode: GarageMode): boolean {
  return mode === GarageMode.Populated;
}

// ── Bikes ────────────────────────────────────────────────────────────

/** The bike the page leads with: the primary one, else the first (as the app does). */
export function pickLeadBike(bikes: readonly Bike[]): Bike | undefined {
  return bikes.find((bike) => bike.isPrimary) ?? bikes[0];
}

/** The rest of the garage, in list order, for the "Also in your garage" row. */
export function otherBikes(bikes: readonly Bike[], lead: Bike | undefined): Bike[] {
  return lead ? bikes.filter((bike) => bike.id !== lead.id) : [...bikes];
}

/**
 * Odometer / service-distance label. Odometer values are stored RAW in the
 * rider's measurement system (#164): this only labels, it never converts. The
 * per-bike `mileageUnit` is deprecated (packages/types/src/units.ts) and is not
 * read; an unset or unknown setting labels as km, the API's default.
 */
export function distanceUnitFor(measurementSystem: string | null | undefined): MileageUnit {
  return measurementSystem === MeasurementSystem.IMPERIAL
    ? mileageUnitLabel(MeasurementSystem.IMPERIAL)
    : MileageUnit.KM;
}

// ── Dates ────────────────────────────────────────────────────────────

/** A local calendar day as `YYYY-MM-DD`. */
export function isoDay(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** The same day in UTC (what the server renders with before the client knows its zone). */
export function isoDayUtc(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** The calendar year of a `YYYY-MM-DD` day. */
export function yearOf(day: string): number {
  return Number(day.slice(0, 4));
}

// ── Maintenance ──────────────────────────────────────────────────────

/** Why a task is overdue. Both true → date (DATA-MAP §4). */
export const OverdueKind = { Date: 'date', Distance: 'distance' } as const;
export type OverdueKind = (typeof OverdueKind)[keyof typeof OverdueKind];

/**
 * Overdue by date when the due day is before `today` (local calendar day);
 * overdue by distance when the odometer has reached the target. Odometer and
 * target are both raw in the rider's unit, so they compare directly.
 */
export function overdueKind(
  task: Pick<Task, 'dueDate' | 'targetMileage'>,
  currentMileage: number | null | undefined,
  today: string,
): OverdueKind | null {
  if (task.dueDate && task.dueDate.slice(0, 10) < today) return OverdueKind.Date;
  if (
    task.targetMileage != null &&
    currentMileage != null &&
    currentMileage >= task.targetMileage
  ) {
    return OverdueKind.Distance;
  }
  return null;
}

export type ServiceRow = { task: Task; overdue: OverdueKind | null };

export type ServiceSchedule = {
  /** Up to {@link MAX_SERVICE_ROWS} rows: overdue first, then the nearest. */
  rows: ServiceRow[];
  /** Every active task for the bike ("N scheduled"). */
  scheduledCount: number;
  /** Every overdue task for the bike (the hero's "N overdue"). */
  overdueCount: number;
};

/** The card lists at most three tasks (sheet rule). */
export const MAX_SERVICE_ROWS = 3;

/**
 * Sort key: overdue tasks first; then tasks with a due date (soonest first);
 * then tasks with only a target distance (fewest units left first); then the
 * rest. Ties keep the API's order (by due date).
 */
function serviceRank(
  row: ServiceRow,
  currentMileage: number | null | undefined,
): [number, string, number] {
  const { task } = row;
  const group = row.overdue ? 0 : task.dueDate ? 1 : task.targetMileage != null ? 2 : 3;
  const day = task.dueDate?.slice(0, 10) ?? '9999-12-31';
  const left =
    task.targetMileage != null
      ? task.targetMileage - (currentMileage ?? 0)
      : Number.POSITIVE_INFINITY;
  return [group, day, left];
}

/**
 * The next-service card's rows for one bike. `allMaintenanceTasks` already
 * returns only active tasks (pending, in progress) of non-deleted bikes.
 */
export function serviceSchedule(
  tasks: readonly Task[],
  bike: Pick<Bike, 'id' | 'currentMileage'>,
  today: string,
): ServiceSchedule {
  const rows = tasks
    .filter((task) => task.motorcycleId === bike.id)
    .map((task) => ({ task, overdue: overdueKind(task, bike.currentMileage, today) }));

  const ranked = rows
    .map((row, index) => ({ row, index, rank: serviceRank(row, bike.currentMileage) }))
    .sort((a, b) => {
      for (let i = 0; i < a.rank.length; i++) {
        const x = a.rank[i];
        const y = b.rank[i];
        if (x < y) return -1;
        if (x > y) return 1;
      }
      return a.index - b.index;
    })
    .map(({ row }) => row);

  return {
    rows: ranked.slice(0, MAX_SERVICE_ROWS),
    scheduledCount: rows.length,
    overdueCount: rows.filter((row) => row.overdue).length,
  };
}

// ── Spend ────────────────────────────────────────────────────────────

export type CategorySpend = { category: string; total: number };
export type CurrencySpend = {
  currency: string;
  /** The currency's spend this calendar year (keeps cents). */
  total: number;
  /** This year's split, largest first. Never mixes currencies. */
  categories: CategorySpend[];
};

/**
 * This year's spend, one entry per currency with spend this year (most-used
 * currency first, as the API orders them). Amounts are never summed across
 * currencies (#275). The category split comes from this year's monthly
 * buckets: `categoryTotals` is all-time (00186), so it is not used.
 */
export function yearSpend(
  dashboard: ExpenseDashboard | null | undefined,
  year: number,
  fallbackCurrency: string,
): CurrencySpend[] {
  return dashboardBreakdowns(dashboard, fallbackCurrency)
    .filter((breakdown) => breakdown.currentYearTotal > 0)
    .map((breakdown) => {
      const byCategory = new Map<string, number>();
      for (const bucket of breakdown.monthlyBuckets) {
        if (bucket.year !== year) continue;
        for (const { category, total } of bucket.categories) {
          byCategory.set(category, (byCategory.get(category) ?? 0) + total);
        }
      }
      const categories = [...byCategory]
        .map(([category, total]) => ({ category, total }))
        .filter(({ total }) => total > 0)
        .sort((a, b) => b.total - a.total);
      return { currency: breakdown.currency, total: breakdown.currentYearTotal, categories };
    });
}

// ── Rides ────────────────────────────────────────────────────────────

export type RideTotals = {
  /** All-time ride count, or null while unknown. */
  count: number | null;
  /** All-time distance in the rider's unit, or null when unavailable. */
  distance: number | null;
  /** Last ride's day (`YYYY-MM-DD…`), or null. */
  lastRideDate: string | null;
  /** Whether the rider has any ride; null while unknown (never promote on unknown). */
  hasRides: boolean | null;
};

/**
 * All-time ride totals. There is no year-scoped ride stat in the API, so the
 * card shows all-time numbers labelled "All time" (DATA-MAP §6). The count
 * prefers the rider profile's exact count (same source as the distance), then
 * `myRides.totalCount`; the distance needs the profile and is otherwise hidden.
 */
export function rideTotals(input: {
  profileStats: { totalRides: number; totalDistance: number } | null | undefined;
  rideCount: number | null | undefined;
  lastRideDate: string | null | undefined;
  /** Whether the last-ride query has answered (a null lastRide is then real). */
  lastRideKnown: boolean;
  unit: MileageUnit;
}): RideTotals {
  const count = input.profileStats?.totalRides ?? input.rideCount ?? null;
  const distance = input.profileStats
    ? metersToUnit(input.profileStats.totalDistance, input.unit)
    : null;
  const lastRideDate = input.lastRideDate ?? null;
  let hasRides: boolean | null = null;
  if (lastRideDate || (count != null && count > 0)) hasRides = true;
  else if (count === 0 && input.lastRideKnown) hasRides = false;
  return { count, distance, lastRideDate, hasRides };
}

/** What the populated garage's rides card shows. */
export const RidesCardState = {
  /** A count source or the last-ride query is still out: skeleton. */
  Loading: 'loading',
  /** No count source can answer any more: the card's failed state, never a skeleton forever. */
  Failed: 'failed',
  Ready: 'ready',
} as const;
export type RidesCardState = (typeof RidesCardState)[keyof typeof RidesCardState];

/**
 * The count comes from `myRides.totalCount` or the rider profile. The profile
 * query only runs for a rider with a public username, so a failed count with
 * no profile (disabled or failed) is final.
 */
export function ridesCardState(input: {
  countSucceeded: boolean;
  countFailed: boolean;
  profileSucceeded: boolean;
  profileFailed: boolean;
  profileEnabled: boolean;
  lastRidePending: boolean;
}): RidesCardState {
  if ((input.countSucceeded || input.profileSucceeded) && !input.lastRidePending) {
    return RidesCardState.Ready;
  }
  if (input.countFailed && (input.profileFailed || !input.profileEnabled)) {
    return RidesCardState.Failed;
  }
  return RidesCardState.Loading;
}

/**
 * The rider's local calendar day for a date-only value or a timestamp. A
 * timestamp (e.g. a ride's `ended_at`) is converted with the browser's zone,
 * so call this only after mount; before it, `formatDay` renders the UTC day.
 */
export function localDayOf(value: string): string {
  if (value.length === 10) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : isoDay(date);
}

// ── Formatting ───────────────────────────────────────────────────────
// Through next-intl's formatter only: it takes its locale from
// src/i18n/request.ts (validated by hasLocale), so no request-derived locale
// ever reaches Intl directly (intl-locale-contract.test.ts).

/** next-intl's formatter plus the active locale (`useFormatter()` + `useLocale()`). */
export type GarageFormat = { format: ReturnType<typeof createFormatter>; locale: string };

const UTC = 'UTC';

/**
 * "3 Oct 2026". The spec writes days as D Mon YYYY; English's own pattern is
 * "Oct 3, 2026", so English is assembled from its parts. Other locales use
 * their own order. Date-only values are read as UTC days, so SSR and client agree.
 */
export function formatDay(value: string, { format, locale }: GarageFormat): string {
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return value;
  if (locale === 'en') {
    const day = format.dateTime(date, { day: 'numeric', timeZone: UTC });
    const month = format.dateTime(date, { month: 'short', timeZone: UTC });
    const year = format.dateTime(date, { year: 'numeric', timeZone: UTC });
    return `${day} ${month} ${year}`;
  }
  return format.dateTime(date, { day: 'numeric', month: 'short', year: 'numeric', timeZone: UTC });
}

/** Whole number with grouping ("38,423"). */
export function formatInteger(value: number, { format }: GarageFormat): string {
  return format.number(value, { maximumFractionDigits: 0 });
}

function formatCurrency(amount: number, currency: string, f: GarageFormat, digits: number): string {
  try {
    return f.format.number(amount, {
      style: 'currency',
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  } catch {
    return `${formatInteger(amount, f)} ${currency}`;
  }
}

/** A money total with cents ("€1,960.62"). */
export function formatMoney(amount: number, currency: string, f: GarageFormat): string {
  return formatCurrency(amount, currency, f, 2);
}

/** A category amount in whole units ("€492"); may not add up to the total (rounding). */
export function formatMoneyWhole(amount: number, currency: string, f: GarageFormat): string {
  return formatCurrency(amount, currency, f, 0);
}
