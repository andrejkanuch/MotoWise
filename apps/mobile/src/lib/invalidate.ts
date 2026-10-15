/**
 * The invalidation each kind of write needs, in one place. A mutation that
 * refreshes the same keys as another mutation calls the helper here instead of
 * repeating the `invalidateQueries` lines; the helper's test pins the exact
 * keys, so a key that falls out of use is removed once, not hunted down.
 */
import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './query-keys';

/**
 * After a maintenance task is created, edited, completed or deleted: the
 * bike's task list when the bike is known, and the all-user list behind the
 * Garage badge, the widget and the home checklist.
 */
export function invalidateMaintenanceTasks(queryClient: QueryClient, motorcycleId?: string): void {
  if (motorcycleId) {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.maintenanceTasks.byMotorcycle(motorcycleId),
    });
  }
  void queryClient.invalidateQueries({ queryKey: queryKeys.maintenanceTasks.allUser });
}

/**
 * After a trip is created, edited, published, cloned, shared or deleted: every
 * trip list under the `['trips']` prefix (my trips, drafts, home) and, when a
 * trip id is given, that trip's detail. Returns the detail refetch so an
 * editor can wait for it before closing. The trip editor's own `trips.edit`
 * key sits outside the prefix on purpose and is not touched.
 */
export function invalidateTrips(queryClient: QueryClient, tripId?: string): Promise<void> {
  void queryClient.invalidateQueries({ queryKey: queryKeys.trips.all });
  if (tripId === undefined) return Promise.resolve();
  return queryClient.invalidateQueries({ queryKey: queryKeys.trips.detail(tripId) });
}

/**
 * After a document is added, edited or deleted: the bike's documents and the
 * expiring-documents list behind the home reminders.
 */
export function invalidateDocuments(queryClient: QueryClient, motorcycleId: string): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.documents.byMotorcycle(motorcycleId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.documents.expiring });
}

/**
 * After the rider's profile changes: `user.me`, and the bike list too when the
 * change rewrites every bike (a measurement-system update moves each bike's
 * `distance_unit` server-side, and onboarding completion creates the first bike).
 */
export function invalidateUser(
  queryClient: QueryClient,
  { withBikes }: { withBikes: boolean },
): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.user.me });
  if (withBikes) void queryClient.invalidateQueries({ queryKey: queryKeys.motorcycles.all });
}
