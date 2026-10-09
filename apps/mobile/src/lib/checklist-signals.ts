import { type MyMotorcyclesQuery, type MyRidesQuery, RideStatus } from '@motovault/graphql';
import { CHECKLIST_ITEM_ID, type ChecklistItemId } from '../stores/checklist.store';

type Bike = Pick<MyMotorcyclesQuery['myMotorcycles'][number], 'id' | 'primaryPhotoUrl'>;
type Ride = Pick<MyRidesQuery['myRides']['edges'][number]['node'], 'status'>;

/**
 * What the rider's own data says about the Get Started items. Each field is
 * `undefined` while unknown (loading, failed, or not fetched), which never ticks
 * anything: an item is only completed from data that says so.
 */
export interface ChecklistSignals {
  bikes: readonly Bike[] | undefined;
  /** Home's recent rides (`rides.list('home')`). */
  rides: readonly Ride[] | undefined;
  /** `expenseDashboard.expenseCount` per bike; `undefined` entries are unknown. */
  expenseCounts: readonly (number | undefined)[];
  /** `receiptScanQuota.used` — the server's scan count for the current month. */
  receiptScansUsed: number | undefined;
}

/**
 * The items real data completes, and the rule for each. The rest (routes,
 * dashboard) have no data behind them and stay tap-to-complete.
 *
 *  - COMPLETE_BIKE: a bike with a photo. Having a bike is not enough: nearly
 *    every rider adds one during onboarding, so the item would tick itself for
 *    everyone and stop meaning "complete your bike profile". The photo is the
 *    one profile field onboarding leaves optional and the garage asks for.
 *  - FIRST_RIDE: a finished ride (not one still recording or paused).
 *  - FIRST_EXPENSE: an expense on any bike.
 *  - SCAN_RECEIPT: a receipt scan this month. The server keeps no lifetime
 *    count and expenses do not record that they came from a scan, so a scan in
 *    an earlier month is not seen; once ticked, the item stays ticked.
 */
const DATA_RULES: ReadonlyMap<string, (signals: ChecklistSignals) => boolean> = new Map<
  ChecklistItemId,
  (signals: ChecklistSignals) => boolean
>([
  [
    CHECKLIST_ITEM_ID.COMPLETE_BIKE,
    ({ bikes }) => bikes?.some((bike) => Boolean(bike.primaryPhotoUrl)) ?? false,
  ],
  [
    CHECKLIST_ITEM_ID.FIRST_RIDE,
    ({ rides }) => rides?.some((ride) => ride.status === RideStatus.Completed) ?? false,
  ],
  [
    CHECKLIST_ITEM_ID.FIRST_EXPENSE,
    ({ expenseCounts }) => expenseCounts.some((count) => (count ?? 0) > 0),
  ],
  [CHECKLIST_ITEM_ID.SCAN_RECEIPT, ({ receiptScansUsed }) => (receiptScansUsed ?? 0) > 0],
]);

/** True for the items real data can complete. */
export function isDataBackedItem(id: string): boolean {
  return DATA_RULES.has(id);
}

/** The data-backed items among `ids` that the signals show as done, in `ids` order. */
export function deriveCompletedItems(
  ids: readonly string[],
  signals: ChecklistSignals,
): ChecklistItemId[] {
  return ids.filter((id): id is ChecklistItemId => {
    const rule = DATA_RULES.get(id);
    return rule?.(signals) ?? false;
  });
}
