import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../query-keys';
import { invalidateAfterTaskCompletion } from '../task-completion-cache';

function invalidatedKeys(hasCost: boolean) {
  const client = new QueryClient();
  const spy = jest.spyOn(client, 'invalidateQueries');
  invalidateAfterTaskCompletion(client, 'bike-1', { hasCost });
  return spy.mock.calls.map(([filters]) => filters?.queryKey);
}

describe('invalidateAfterTaskCompletion', () => {
  it('refreshes the bike expenses when a cost created a linked expense', () => {
    expect(invalidatedKeys(true)).toEqual([
      queryKeys.maintenanceTasks.byMotorcycle('bike-1'),
      queryKeys.maintenanceTasks.allUser,
      queryKeys.expenses.byMotorcycle('bike-1'),
    ]);
  });

  it('leaves expenses alone when no cost was entered', () => {
    expect(invalidatedKeys(false)).toEqual([
      queryKeys.maintenanceTasks.byMotorcycle('bike-1'),
      queryKeys.maintenanceTasks.allUser,
    ]);
  });
});
