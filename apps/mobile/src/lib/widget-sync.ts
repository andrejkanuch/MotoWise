/**
 * Widget data sync — fetches data via TanStack Query cache (or fresh if stale),
 * formats into pre-built display strings, and pushes to iOS widget snapshots.
 *
 * iOS only. No-ops on Android.
 */

import {
  AllMaintenanceTasksDocument,
  type AllMaintenanceTasksQuery,
  ExpenseDashboardDocument,
  type ExpenseDashboardQuery,
  RideOverviewDocument,
  type RideOverviewQuery,
} from '@motovault/graphql';
import { CURRENCY_SYMBOLS } from '@motovault/types';
import { Platform } from 'react-native';
import { useAuthStore } from '../stores/auth.store';
import {
  distanceUnitLabel,
  formatDistanceValue,
  formatDuration,
  formatSpeedValue,
  speedUnitLabel,
} from '../utils/ride-formatters';
import { gqlFetcher } from './graphql-client';
import { queryClient } from './query-client';
import { queryKeys } from './query-keys';

// ── In-flight guard + abort for logout race condition ────────────────────────

let syncVersion = 0;

export type WidgetDomain = 'maintenance' | 'expenses' | 'rides';

/**
 * Sync specific widget domains, or all if no domains provided.
 * Uses TanStack Query cache when data is fresh, falls back to network fetch.
 */
export async function syncWidgets(
  domains: WidgetDomain[] = ['maintenance', 'expenses', 'rides'],
): Promise<void> {
  if (Platform.OS !== 'ios') return;

  const currentVersion = ++syncVersion;
  const { measurementSystem, currency } = useAuthStore.getState();

  const results = await Promise.allSettled([
    domains.includes('maintenance') ? fetchMaintenance() : Promise.resolve(null),
    domains.includes('expenses') ? fetchExpenses() : Promise.resolve(null),
    domains.includes('rides') ? fetchRideOverview() : Promise.resolve(null),
  ]);

  // Abort if a newer sync or clearAllWidgets was triggered
  if (currentVersion !== syncVersion) return;

  // Lazy-import widget definitions (iOS-only native modules)
  const [
    { default: NextServiceWidgetDef },
    { default: ExpenseTrackerWidgetDef },
    { default: LastRideWidgetDef },
    { default: RideStatsWidgetDef },
  ] = await Promise.all([
    import('../widgets/NextServiceWidget'),
    import('../widgets/ExpenseTrackerWidget'),
    import('../widgets/LastRideWidget'),
    import('../widgets/RideStatsWidget'),
  ]);

  // Abort again after async imports
  if (currentVersion !== syncVersion) return;

  // ── Maintenance → NextServiceWidget ──────────────────────────
  const maintenanceResult = results[0];
  if (maintenanceResult.status === 'fulfilled' && maintenanceResult.value) {
    const tasks = maintenanceResult.value;
    const pending = tasks
      .filter((t) => t.status !== 'completed' && !t.completedAt)
      .sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });

    const next = pending[0];
    if (next) {
      const now = new Date();
      const dueDate = next.dueDate ? new Date(next.dueDate) : null;
      const daysUntil = dueDate
        ? Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      const isOverdue = daysUntil !== null && daysUntil < 0;

      let dueLabel = '';
      if (daysUntil !== null) {
        dueLabel = isOverdue ? `${Math.abs(daysUntil)}d overdue` : `In ${daysUntil} days`;
      } else if (next.targetMileage) {
        dueLabel = `At ${next.targetMileage.toLocaleString()} km`;
      }

      safeUpdate(NextServiceWidgetDef, {
        hasData: true,
        taskTitle: next.title,
        dueLabel,
        daysCount: daysUntil !== null ? String(Math.abs(daysUntil)) : '—',
        bikeName: '',
        isOverdue,
        deepLink: `motovault:///bike/${next.motorcycleId}`,
      });
    } else {
      safeUpdate(NextServiceWidgetDef, {
        hasData: false,
        taskTitle: '',
        dueLabel: '',
        daysCount: '',
        bikeName: '',
        isOverdue: false,
        deepLink: 'motovault:///',
      });
    }
  }

  // ── Expenses → ExpenseTrackerWidget ──────────────────────────
  const expenseResult = results[1];
  if (expenseResult.status === 'fulfilled' && expenseResult.value) {
    const dashboard = expenseResult.value;
    const symbol = CURRENCY_SYMBOLS[currency] || currency;
    const now = new Date();
    const monthLabel = now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    // Current month bucket
    const currentBucket = dashboard.monthlyBuckets?.find(
      (b) => b.month === now.getMonth() + 1 && b.year === now.getFullYear(),
    );
    const monthTotal = currentBucket?.total ?? 0;

    // Top category
    const topCat = dashboard.categoryTotals
      ?.filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total)[0];

    safeUpdate(ExpenseTrackerWidgetDef, {
      hasData: monthTotal > 0 || (dashboard.categoryTotals?.length ?? 0) > 0,
      monthlyTotal: Math.round(monthTotal).toLocaleString(),
      currencySymbol: symbol,
      monthLabel,
      topCategory: topCat?.category ?? '—',
      topCategoryAmount: topCat ? `${symbol}${Math.round(topCat.total)}` : '',
      deltaLabel: '',
      deltaPositive: false,
      deepLink: 'motovault:///',
    });
  }

  // ── Ride Overview → LastRideWidget + RideStatsWidget ─────────
  const rideResult = results[2];
  if (rideResult.status === 'fulfilled' && rideResult.value) {
    const overview = rideResult.value;
    const ms = measurementSystem;

    // Last ride
    if (overview.lastRide) {
      const r = overview.lastRide;
      const avgSpeedMps = r.durationS > 0 ? r.distanceM / r.durationS : 0;
      const dateStr = new Date(r.date).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });

      safeUpdate(LastRideWidgetDef, {
        hasData: true,
        rideName: r.motorcycleName || 'Ride',
        rideSubtitle: '',
        distance: formatDistanceValue(r.distanceM, ms),
        distanceUnit: distanceUnitLabel(ms),
        duration: formatDuration(r.durationS),
        durationUnit: '',
        avgSpeed: String(formatSpeedValue(avgSpeedMps, ms)),
        avgSpeedUnit: speedUnitLabel(ms),
        date: dateStr,
        deepLink: `motovault:///ride/${r.id}`,
      });
    } else {
      safeUpdate(LastRideWidgetDef, {
        hasData: false,
        rideName: '',
        rideSubtitle: '',
        distance: '',
        distanceUnit: '',
        duration: '',
        durationUnit: '',
        avgSpeed: '',
        avgSpeedUnit: '',
        date: '',
        deepLink: 'motovault:///',
      });
    }

    // Ride stats
    const week = overview.thisWeek;
    const month = overview.thisMonth;
    const hasRideData = week.rideCount > 0 || month.rideCount > 0;
    const monthName = new Date().toLocaleDateString(undefined, { month: 'long' });

    safeUpdate(RideStatsWidgetDef, {
      hasData: hasRideData,
      weekDistance: formatDistanceValue(week.distanceM, ms),
      weekDistanceUnit: distanceUnitLabel(ms),
      weekRides: `${week.rideCount} ride${week.rideCount !== 1 ? 's' : ''}`,
      monthDistance: formatDistanceValue(month.distanceM, ms),
      monthDistanceUnit: distanceUnitLabel(ms),
      monthRides: String(month.rideCount),
      weekLabel: 'This Week',
      monthLabel: monthName,
      deepLink: 'motovault:///profile/rides',
    });
  }
}

/** Clear all widget data (call on logout). */
export function clearAllWidgets(): void {
  if (Platform.OS !== 'ios') return;

  // Invalidate any in-flight sync
  ++syncVersion;

  // Fire-and-forget — import and clear
  Promise.all([
    import('../widgets/NextServiceWidget'),
    import('../widgets/ExpenseTrackerWidget'),
    import('../widgets/LastRideWidget'),
    import('../widgets/RideStatsWidget'),
  ])
    .then(([ns, et, lr, rs]) => {
      safeUpdate(ns.default, {
        hasData: false,
        taskTitle: '',
        dueLabel: '',
        daysCount: '',
        bikeName: '',
        isOverdue: false,
        deepLink: '',
      });
      safeUpdate(et.default, {
        hasData: false,
        monthlyTotal: '0',
        currencySymbol: '',
        monthLabel: '',
        topCategory: '',
        topCategoryAmount: '',
        deltaLabel: '',
        deltaPositive: false,
        deepLink: '',
      });
      safeUpdate(lr.default, {
        hasData: false,
        rideName: '',
        rideSubtitle: '',
        distance: '',
        distanceUnit: '',
        duration: '',
        durationUnit: '',
        avgSpeed: '',
        avgSpeedUnit: '',
        date: '',
        deepLink: '',
      });
      safeUpdate(rs.default, {
        hasData: false,
        weekDistance: '0',
        weekDistanceUnit: '',
        weekRides: '',
        monthDistance: '0',
        monthDistanceUnit: '',
        monthRides: '',
        weekLabel: '',
        monthLabel: '',
        deepLink: '',
      });
    })
    .catch(() => {
      // Widget extension may not be available
    });
}

// ── Data fetchers (prefer TanStack Query cache) ──────────────────────────────

const STALE_MS = 2 * 60 * 1000;

async function fetchMaintenance() {
  const cached = queryClient.getQueryData<AllMaintenanceTasksQuery>(
    queryKeys.maintenanceTasks.allUser,
  );
  const state = queryClient.getQueryState(queryKeys.maintenanceTasks.allUser);
  if (cached && state && Date.now() - state.dataUpdatedAt < STALE_MS) {
    return cached.allMaintenanceTasks;
  }
  const data = await gqlFetcher(AllMaintenanceTasksDocument);
  return data.allMaintenanceTasks;
}

async function fetchExpenses(): Promise<ExpenseDashboardQuery['expenseDashboard'] | null> {
  // ExpenseDashboard requires a motorcycleId — use primary bike from cached motorcycles
  const motorcyclesData = queryClient.getQueryData<{
    myMotorcycles: Array<{ id: string; isPrimary: boolean }>;
  }>(queryKeys.motorcycles.all);
  const bikes = motorcyclesData?.myMotorcycles;
  if (!bikes?.length) return null;

  const primaryBike = bikes.find((b) => b.isPrimary) ?? bikes[0];
  const qk = queryKeys.expenses.byMotorcycle(primaryBike.id);
  const cached = queryClient.getQueryData<ExpenseDashboardQuery>(qk);
  const state = queryClient.getQueryState(qk);
  if (cached && state && Date.now() - state.dataUpdatedAt < STALE_MS) {
    return cached.expenseDashboard;
  }

  const data = await gqlFetcher(ExpenseDashboardDocument, { motorcycleId: primaryBike.id });
  return data.expenseDashboard;
}

async function fetchRideOverview(): Promise<RideOverviewQuery['rideOverview']> {
  const cached = queryClient.getQueryData<RideOverviewQuery>(queryKeys.rides.overview);
  const state = queryClient.getQueryState(queryKeys.rides.overview);
  if (cached && state && Date.now() - state.dataUpdatedAt < STALE_MS) {
    return cached.rideOverview;
  }

  const data = await gqlFetcher(RideOverviewDocument);
  return data.rideOverview;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function safeUpdate<T extends object>(
  widget: { updateSnapshot: (props: T) => void },
  props: T,
): void {
  try {
    widget.updateSnapshot(props);
  } catch {
    // Widget extension may not be installed on older builds
  }
}
