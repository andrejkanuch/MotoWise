import {
  ExpenseDashboardDocument,
  type ExpenseDashboardQuery,
  MyMotorcyclesDocument,
  MyRidesDocument,
  ReceiptScanQuotaDocument,
} from '@motovault/graphql';
import { type QueryObserverResult, useQueries, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { type ChecklistSignals, isDataBackedItem } from '../../lib/checklist-signals';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { QUERY_META } from '../../lib/query-meta';
import { CHECKLIST_ITEM_ID } from '../../stores/checklist.store';

const BIKES_STALE_MS = 5 * 60 * 1000;
/** The page Home's recent-rides strip fetches; the same key, so the same cache entry. */
const HOME_RIDES_LIST = 'home';
const HOME_RIDES_FIRST = 10;
/** Matches `useExpenseDashboard` and `useReceiptScanQuota`, which share these keys. */
const EXPENSE_DASHBOARD_STALE_MS = 5 * 60 * 1000;
const SCAN_QUOTA_STALE_MS = 60_000;

type ExpenseDashboardResult = QueryObserverResult<ExpenseDashboardQuery>;

/** Module-level so `useQueries` keeps the combined result stable between renders. */
function combineExpenseCounts(results: ExpenseDashboardResult[]) {
  return {
    counts: results.map((result) => result.data?.expenseDashboard.expenseCount),
    loading: results.some((result) => result.isLoading),
  };
}

export interface ChecklistDataState {
  signals: ChecklistSignals;
  /** Bikes, for routing the expense item. `undefined` until the list arrives. */
  bikes: ChecklistSignals['bikes'];
  /**
   * False while a query an open item depends on is still on its first load.
   * The card renders nothing until then, so it never shows "0 of 5" for a frame
   * and then ticks itself. A failed or offline query counts as settled: its
   * item stays open, and the card shows.
   */
  settled: boolean;
}

/**
 * Reads what the rider already has, for the Get Started items that real data
 * can complete. Every query reuses a key Home or another screen already fills
 * (bikes, Home's recent rides, the per-bike expense dashboard, the scan quota),
 * runs only while its item is open, and never raises the global error alert.
 */
export function useChecklistSignals(
  /** Items on the card that are not done yet. */
  openItemIds: readonly string[],
  /** The card can show at all (initialized, not dismissed, has items). */
  active: boolean,
): ChecklistDataState {
  const isOpen = (id: string) => active && openItemIds.includes(id) && isDataBackedItem(id);
  const needsRides = isOpen(CHECKLIST_ITEM_ID.FIRST_RIDE);
  const needsExpenses = isOpen(CHECKLIST_ITEM_ID.FIRST_EXPENSE);
  const needsScans = isOpen(CHECKLIST_ITEM_ID.SCAN_RECEIPT);
  const needsBikes = needsExpenses || isOpen(CHECKLIST_ITEM_ID.COMPLETE_BIKE);

  // Always on while the card shows: the expense item routes to the first bike.
  const bikesQuery = useQuery({
    queryKey: queryKeys.motorcycles.all,
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
    staleTime: BIKES_STALE_MS,
    enabled: active,
    meta: QUERY_META.DECORATION,
  });
  const bikes = bikesQuery.data?.myMotorcycles;

  const ridesQuery = useQuery({
    queryKey: queryKeys.rides.list(HOME_RIDES_LIST),
    queryFn: () => gqlFetcher(MyRidesDocument, { first: HOME_RIDES_FIRST }),
    enabled: needsRides,
    meta: QUERY_META.DECORATION,
  });

  const expenses = useQueries({
    queries: (needsExpenses ? (bikes ?? []) : []).map((bike) => ({
      queryKey: [...queryKeys.expenses.byMotorcycle(bike.id), 'dashboard'] as const,
      queryFn: () => gqlFetcher(ExpenseDashboardDocument, { motorcycleId: bike.id }),
      staleTime: EXPENSE_DASHBOARD_STALE_MS,
      meta: QUERY_META.DECORATION,
    })),
    combine: combineExpenseCounts,
  });

  const scanQuotaQuery = useQuery({
    queryKey: queryKeys.receiptScans.quota,
    queryFn: () => gqlFetcher(ReceiptScanQuotaDocument),
    staleTime: SCAN_QUOTA_STALE_MS,
    enabled: needsScans,
    meta: QUERY_META.DECORATION,
  });

  // `isLoading` is a first load in flight: false once data or an error arrives,
  // while paused offline, and for a disabled query.
  const settled =
    !(needsBikes && bikesQuery.isLoading) &&
    !ridesQuery.isLoading &&
    !expenses.loading &&
    !scanQuotaQuery.isLoading;

  const rides = ridesQuery.data?.myRides.edges;
  const receiptScansUsed = scanQuotaQuery.data?.receiptScanQuota.used;
  // Stable while the data is: the consumer derives completions from it in an effect.
  const signals = useMemo<ChecklistSignals>(
    () => ({
      bikes,
      rides: rides?.map((edge) => edge.node),
      expenseCounts: expenses.counts,
      receiptScansUsed,
    }),
    [bikes, rides, expenses.counts, receiptScansUsed],
  );

  return { bikes, settled, signals };
}
