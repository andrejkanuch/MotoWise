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
