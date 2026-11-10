import type { SyncOperationType } from '../utils/ride-sync-queue';
import { queryClient } from './query-client';
import { queryKeys } from './query-keys';

/** Queued ops whose delivery always moves a bike's odometer (and logs a reading, 00181). */
const ODOMETER_MOVING_OPS: ReadonlySet<SyncOperationType> = new Set<SyncOperationType>(['endRide']);
/** The `updateRide` field that sets the bike's odometer to the ride's end reading. */
const ODOMETER_AT_END_FIELD = 'odometerAtEnd';

/** Whether a delivered op moved a bike's odometer: `endRide`, or `updateRide` with an end reading. */
function movesOdometer(type: SyncOperationType, payload: Record<string, unknown>): boolean {
  if (ODOMETER_MOVING_OPS.has(type)) return true;
  if (type !== 'updateRide') return false;
  const input = (payload.variables as { input?: Record<string, unknown> } | undefined)?.input;
  return input?.[ODOMETER_AT_END_FIELD] != null;
}

/**
 * Refreshes what a delivered sync op changed on the server. An offline ride's
 * `endRide` is delivered long after the ride summary's own refetch ran, so the
 * bike hub would show the pre-ride odometer until staleTime without this. The
 * odometer a rider types on the summary goes as a separate `updateRide`, which
 * moves the bike too.
 */
export function refreshAfterSyncedOp(
  type: SyncOperationType,
  payload: Record<string, unknown> = {},
): void {
  if (!movesOdometer(type, payload)) return;
  void queryClient.invalidateQueries({ queryKey: queryKeys.motorcycles.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.odometer.all });
}
