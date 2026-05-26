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

  // Skip if no session — widget sync requires auth for network fetches
  const { measurementSystem, currency, session } = useAuthStore.getState();
  if (!session) return;

  const currentVersion = ++syncVersion;

  console.log('[WidgetSync] starting sync, domains:', domains.join(', '));

  const results = await Promise.allSettled([
    domains.includes('maintenance') ? fetchMaintenance() : Promise.resolve(null),
    domains.includes('expenses') ? fetchExpenses() : Promise.resolve(null),
    domains.includes('rides') ? fetchRideOverview() : Promise.resolve(null),
  ]);

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === 'rejected') {
      console.warn(`[WidgetSync] fetch[${i}] REJECTED:`, r.reason);
    }
  }

  // Abort if a newer sync or clearAllWidgets was triggered
  if (currentVersion !== syncVersion) {
    console.log('[WidgetSync] aborted — newer sync version');
    return;
  }

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

  console.log('[WidgetSync] widget modules imported OK');

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

      // Get bike mileage for display
      const bikeMileage = next.targetMileage ? `${next.targetMileage.toLocaleString()} km` : '';

      safeUpdate(NextServiceWidgetDef, {
        hasData: true,
        taskTitle: next.title,
        dueLabel,
        daysCount: daysUntil !== null ? String(Math.abs(daysUntil)) : '—',
        bikeMileage,
        isOverdue,
        deepLink: `motovault:///bike/${next.motorcycleId}`,
      });
    } else {
      safeUpdate(NextServiceWidgetDef, {
        hasData: false,
        taskTitle: '',
        dueLabel: '',
        daysCount: '',
        bikeMileage: '',
        isOverdue: false,
        deepLink: 'motovault:///',
      });
    }
  } else {
    // Fetch failed or returned null — still push empty state so widget doesn't show broken placeholder
    safeUpdate(NextServiceWidgetDef, {
      hasData: false,
      taskTitle: '',
      dueLabel: '',
      daysCount: '',
      bikeMileage: '',
      isOverdue: false,
      deepLink: 'motovault:///',
    });
  }

  // ── Expenses → ExpenseTrackerWidget ──────────────────────────
  const expenseResult = results[1];
  if (expenseResult.status === 'fulfilled' && expenseResult.value) {
    const dashboard = expenseResult.value;
    const symbol = CURRENCY_SYMBOLS[currency] || currency;
    const now = new Date();

    // Current month bucket
    const currentBucket = dashboard.monthlyBuckets?.find(
      (b) => b.month === now.getMonth() + 1 && b.year === now.getFullYear(),
    );
    const monthTotal = currentBucket?.total ?? 0;

    // Compute average of past months for delta
    const pastBuckets = (dashboard.monthlyBuckets ?? []).filter(
      (b) => !(b.month === now.getMonth() + 1 && b.year === now.getFullYear()) && b.total > 0,
    );
    let deltaLabel = '';
    let deltaPositive = false;
    if (pastBuckets.length >= 2) {
      const avgPast = pastBuckets.reduce((sum, b) => sum + b.total, 0) / pastBuckets.length;
      const diff = monthTotal - avgPast;
      const absDiff = Math.abs(Math.round(diff));
      if (absDiff > 0) {
        deltaPositive = diff < 0; // spending less is positive
        deltaLabel = `${diff < 0 ? '↓' : '↑'} ${symbol}${absDiff} vs avg`;
      }
    }

    // Top category
    const topCat = dashboard.categoryTotals
      ?.filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total)[0];

    safeUpdate(ExpenseTrackerWidgetDef, {
      hasData: monthTotal > 0 || (dashboard.categoryTotals?.length ?? 0) > 0,
      monthlyTotal: Math.round(monthTotal).toLocaleString(),
      currencySymbol: symbol,
      monthLabel: now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
      topCategory: topCat?.category ?? '—',
      topCategoryAmount: topCat ? `${symbol}${Math.round(topCat.total)}` : '',
      deltaLabel,
      deltaPositive,
      deepLink: 'motovault:///',
    });
  } else {
    safeUpdate(ExpenseTrackerWidgetDef, {
      hasData: false,
      monthlyTotal: '0',
      currencySymbol: '',
      monthLabel: '',
      topCategory: '',
      topCategoryAmount: '',
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
    console.log(
      '[WidgetSync] rideOverview:',
      overview.lastRide ? `lastRide=${overview.lastRide.id}` : 'lastRide=null',
      `7d=${overview.last7Days.rideCount} 30d=${overview.last30Days.rideCount}`,
    );

    // ── Last ride widget ──
    if (overview.lastRide) {
      const r = overview.lastRide;
      const avgSpeedMps = r.durationS > 0 ? r.distanceM / r.durationS : 0;
      const rideDate = new Date(r.date);
      const dateStr = rideDate
        .toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        .toUpperCase();
      const dayName = rideDate.toLocaleDateString(undefined, { weekday: 'long' }).toUpperCase();
      const distKm = formatDistanceValue(r.distanceM, ms);
      const distUnit = distanceUnitLabel(ms);
      const dayLabel = `${dayName} · ${distKm} ${distUnit}`.toUpperCase();

      // Use summary title if available, fallback to motorcycle name
      const title = r.summaryTitle || r.motorcycleName || 'Ride';
      // Split title into main + subtitle for copper italic styling
      const parts = title.split(/[.!]\s*/);
      const rideName = parts[0] + (parts.length > 1 ? '.' : '');
      const rideSubtitle = parts.length > 1 ? parts.slice(1).join('. ') : '';

      safeUpdate(LastRideWidgetDef, {
        hasData: true,
        rideName,
        rideSubtitle,
        distance: distKm,
        distanceUnit: distUnit,
        duration: formatDuration(r.durationS),
        durationUnit: 'h',
        avgSpeed: String(formatSpeedValue(avgSpeedMps, ms)),
        avgSpeedUnit: speedUnitLabel(ms),
        date: dateStr,
        dayLabel,
        distanceLabel: `${distKm} ${distUnit}`,
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
        dayLabel: '',
        distanceLabel: '',
        deepLink: 'motovault:///',
      });
    }

    // ── Ride stats widget ──
    const week = overview.last7Days;
    const month30 = overview.last30Days;
    const hasRideData = week.rideCount > 0 || month30.rideCount > 0;

    // Build 14-day bar heights (0-100 scale)
    const dailyDistances = overview.dailyDistances ?? [];
    const maxDist = Math.max(...dailyDistances.map((d) => d.distanceM), 1);
    const barH = (i: number) => {
      const dist = dailyDistances[i]?.distanceM ?? 0;
      return dist > 0 ? Math.round((dist / maxDist) * 100) : 0;
    };

    safeUpdate(RideStatsWidgetDef, {
      hasData: hasRideData,
      weekDistance: formatDistanceValue(week.distanceM, ms),
      weekDistanceUnit: distanceUnitLabel(ms),
      weekRides: `${week.rideCount} ride${week.rideCount !== 1 ? 's' : ''}`,
      monthDistance: formatDistanceValue(month30.distanceM, ms),
      monthDistanceUnit: distanceUnitLabel(ms),
      monthRides: String(month30.rideCount),
      bar0: barH(0),
      bar1: barH(1),
      bar2: barH(2),
      bar3: barH(3),
      bar4: barH(4),
      bar5: barH(5),
      bar6: barH(6),
      bar7: barH(7),
      bar8: barH(8),
      bar9: barH(9),
      bar10: barH(10),
      bar11: barH(11),
      bar12: barH(12),
      bar13: barH(13),
      deepLink: 'motovault:///profile/rides',
    });
  } else {
    // Fetch failed — push empty state to both ride widgets
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
      dayLabel: '',
      distanceLabel: '',
      deepLink: 'motovault:///',
    });
    safeUpdate(RideStatsWidgetDef, {
      hasData: false,
      weekDistance: '0',
      weekDistanceUnit: '',
      weekRides: '',
      monthDistance: '0',
      monthDistanceUnit: '',
      monthRides: '',
      bar0: 0,
      bar1: 0,
      bar2: 0,
      bar3: 0,
      bar4: 0,
      bar5: 0,
      bar6: 0,
      bar7: 0,
      bar8: 0,
      bar9: 0,
      bar10: 0,
      bar11: 0,
      bar12: 0,
      bar13: 0,
      deepLink: 'motovault:///',
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
        bikeMileage: '',
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
        dayLabel: '',
        distanceLabel: '',
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
        bar0: 0,
        bar1: 0,
        bar2: 0,
        bar3: 0,
        bar4: 0,
        bar5: 0,
        bar6: 0,
        bar7: 0,
        bar8: 0,
        bar9: 0,
        bar10: 0,
        bar11: 0,
        bar12: 0,
        bar13: 0,
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
  } catch (err) {
    console.warn('[WidgetSync] updateSnapshot failed:', err);
  }
}
