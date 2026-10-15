// Each helper invalidates exactly the keys its call sites invalidated before
// they were folded into it — pinned as the literal cache keys, so a drift in a
// key builder or a dropped line fails here instead of leaving a list stale.
import { QueryClient } from '@tanstack/react-query';
import { invalidateMaintenanceTasks } from '../invalidate';

function spyInvalidations(client: QueryClient) {
  const spy = jest.spyOn(client, 'invalidateQueries');
  return () => spy.mock.calls.map(([filters]) => filters?.queryKey);
}

describe('invalidateMaintenanceTasks', () => {
  it('with a bike id refreshes the task list of that bike and the all-user list, nothing else', () => {
    const client = new QueryClient();
    const invalidated = spyInvalidations(client);
    invalidateMaintenanceTasks(client, 'bike-1');
    expect(invalidated()).toEqual([
      ['maintenance-tasks', 'motorcycle', 'bike-1'],
      ['maintenance-tasks', 'all-user'],
    ]);
  });

  it('without a bike id refreshes only the all-user list', () => {
    const client = new QueryClient();
    const invalidated = spyInvalidations(client);
    invalidateMaintenanceTasks(client);
    expect(invalidated()).toEqual([['maintenance-tasks', 'all-user']]);
  });
});
