import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './query-keys';

/**
 * Refreshes what completing a maintenance task can change: the bike's tasks,
 * every task list, and — when a cost was entered — the bike's expenses, because
 * the server adds a linked expense for the cost (ExpensesService.createFromTask).
 * Without the expense refresh the bike hub's Costs segment, which stays mounted
 * behind the Service segment, kept showing the list from before the completion.
 */
export function invalidateAfterTaskCompletion(
  queryClient: QueryClient,
  motorcycleId: string,
  { hasCost }: { hasCost: boolean },
): void {
  void queryClient.invalidateQueries({
    queryKey: queryKeys.maintenanceTasks.byMotorcycle(motorcycleId),
  });
  void queryClient.invalidateQueries({ queryKey: queryKeys.maintenanceTasks.allUser });
  if (hasCost) {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.expenses.byMotorcycle(motorcycleId),
    });
  }
}
