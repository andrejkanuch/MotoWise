import type { SyncOperationType } from '../utils/ride-sync-queue';
import { queryClient } from './query-client';
import { queryKeys } from './query-keys';

/** Queued ops whose delivery moves a bike's odometer (and logs a reading, 00181). */
const ODOMETER_MOVING_OPS: ReadonlySet<SyncOperationType> = new Set<SyncOperationType>(['endRide']);

/**
 * Refreshes what a delivered sync op changed on the server. An offline ride's
 * `endRide` is delivered long after the ride summary's own refetch ran, so the
 * bike hub would show the pre-ride odometer until staleTime without this.
 */
export function refreshAfterSyncedOp(type: SyncOperationType): void {
  if (!ODOMETER_MOVING_OPS.has(type)) return;
  void queryClient.invalidateQueries({ queryKey: queryKeys.motorcycles.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.odometer.all });
}
