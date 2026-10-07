jest.mock('../query-client', () => ({ queryClient: { invalidateQueries: jest.fn() } }));

import { queryClient } from '../query-client';
import { queryKeys } from '../query-keys';
import { refreshAfterSyncedOp } from '../ride-sync-refresh';

const invalidate = queryClient.invalidateQueries as jest.Mock;

beforeEach(() => invalidate.mockClear());

describe('refreshAfterSyncedOp', () => {
  it('a delivered endRide refreshes the bikes and their odometer readings', () => {
    refreshAfterSyncedOp('endRide');
    expect(invalidate.mock.calls.map(([filters]) => filters.queryKey)).toEqual([
      queryKeys.motorcycles.all,
      queryKeys.odometer.all,
    ]);
  });

  it.each([
    'startRide',
    'uploadWaypoints',
    'updateRide',
    'deleteRide',
  ] as const)('%s moves no odometer and refreshes nothing', (type) => {
    refreshAfterSyncedOp(type);
    expect(invalidate).not.toHaveBeenCalled();
  });
});
