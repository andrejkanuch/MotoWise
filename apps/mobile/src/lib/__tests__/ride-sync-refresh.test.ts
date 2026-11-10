jest.mock('../query-client', () => ({ queryClient: { invalidateQueries: jest.fn() } }));

import { queryClient } from '../query-client';
import { queryKeys } from '../query-keys';
import { refreshAfterSyncedOp } from '../ride-sync-refresh';

const invalidate = queryClient.invalidateQueries as jest.Mock;
const refreshed = () => invalidate.mock.calls.map(([filters]) => filters.queryKey);
const updateRide = (input: Record<string, unknown>) => ({
  variables: { input: { rideId: 'ride-1', ...input } },
});

beforeEach(() => invalidate.mockClear());

describe('refreshAfterSyncedOp', () => {
  it('a delivered endRide refreshes the bikes and their odometer readings', () => {
    refreshAfterSyncedOp('endRide', { variables: { input: { rideId: 'ride-1' } } });
    expect(refreshed()).toEqual([queryKeys.motorcycles.all, queryKeys.odometer.all]);
  });

  it('a delivered updateRide with the odometer at the end refreshes the bikes and readings', () => {
    refreshAfterSyncedOp('updateRide', updateRide({ odometerAtEnd: 12_463 }));
    expect(refreshed()).toEqual([queryKeys.motorcycles.all, queryKeys.odometer.all]);
  });

  it.each([
    ['a name', { name: 'Sunday loop' }],
    ['a purpose', { purpose: 'commute' }],
    ['a passenger', { passenger: true }],
  ])('a delivered updateRide with only %s refreshes nothing', (_, input) => {
    refreshAfterSyncedOp('updateRide', updateRide(input));
    expect(invalidate).not.toHaveBeenCalled();
  });

  it.each([
    'startRide',
    'uploadWaypoints',
    'deleteRide',
  ] as const)('%s moves no odometer and refreshes nothing', (type) => {
    refreshAfterSyncedOp(type, { variables: { input: { rideId: 'ride-1' } } });
    expect(invalidate).not.toHaveBeenCalled();
  });
});
