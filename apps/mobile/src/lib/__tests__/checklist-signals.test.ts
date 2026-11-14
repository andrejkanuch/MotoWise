jest.mock('react-native-mmkv', () => require('../../test/mocks').makeMmkvMock());
jest.mock('../analytics', () => require('../../test/mocks').mockAnalytics());

import { RideStatus } from '@motovault/graphql';
import { CHECKLIST_ITEM_ID } from '../../stores/checklist.store';
import { MIN_RIDE_DISTANCE_M, MIN_RIDE_ELAPSED_S } from '../../utils/ride-constants';
import {
  type ChecklistSignals,
  deriveCompletedItems,
  isDataBackedItem,
} from '../checklist-signals';

const UNKNOWN: ChecklistSignals = {
  bikes: undefined,
  rides: undefined,
  expenseCounts: [],
  receiptScansUsed: undefined,
};
const ALL_IDS = Object.values(CHECKLIST_ITEM_ID);

describe('deriveCompletedItems', () => {
  it('ticks nothing while every signal is unknown', () => {
    expect(deriveCompletedItems(ALL_IDS, UNKNOWN)).toEqual([]);
  });

  it('needs a bike with a photo, not just a bike, for the bike profile', () => {
    const ids = [CHECKLIST_ITEM_ID.COMPLETE_BIKE];
    expect(
      deriveCompletedItems(ids, { ...UNKNOWN, bikes: [{ id: 'b', primaryPhotoUrl: null }] }),
    ).toEqual([]);
    expect(
      deriveCompletedItems(ids, {
        ...UNKNOWN,
        bikes: [{ id: 'b', primaryPhotoUrl: 'https://x.test/p.jpg' }],
      }),
    ).toEqual(ids);
  });

  it('needs a finished ride, not one still recording or paused', () => {
    const ids = [CHECKLIST_ITEM_ID.FIRST_RIDE];
    const unfinished = [
      { status: RideStatus.Recording, durationS: 600, distanceM: 5000 },
      { status: RideStatus.Paused, durationS: 600, distanceM: 5000 },
    ];
    expect(deriveCompletedItems(ids, { ...UNKNOWN, rides: unfinished })).toEqual([]);
    expect(
      deriveCompletedItems(ids, {
        ...UNKNOWN,
        rides: [...unfinished, { status: RideStatus.Completed, durationS: 60, distanceM: 800 }],
      }),
    ).toEqual(ids);
  });

  // FS-PO10 (issue 365 T10): a saved ride under the ride floors is a mis-tap or a
  // test tap, not the rider's first ride.
  it('does not tick the first ride from a 0 m ride', () => {
    const ids = [CHECKLIST_ITEM_ID.FIRST_RIDE];
    expect(
      deriveCompletedItems(ids, {
        ...UNKNOWN,
        rides: [{ status: RideStatus.Completed, durationS: 600, distanceM: 0 }],
      }),
    ).toEqual([]);
  });

  it('ticks the first ride from a 60 s / 800 m ride', () => {
    const ids = [CHECKLIST_ITEM_ID.FIRST_RIDE];
    expect(
      deriveCompletedItems(ids, {
        ...UNKNOWN,
        rides: [{ status: RideStatus.Completed, durationS: 60, distanceM: 800 }],
      }),
    ).toEqual(ids);
  });

  it('needs both floors (duration and distance) on the same ride', () => {
    const ids = [CHECKLIST_ITEM_ID.FIRST_RIDE];
    const subFloor = [
      { status: RideStatus.Completed, durationS: MIN_RIDE_ELAPSED_S - 1, distanceM: 5000 },
      { status: RideStatus.Completed, durationS: 600, distanceM: MIN_RIDE_DISTANCE_M - 1 },
      { status: RideStatus.Completed, durationS: null, distanceM: null },
    ];
    expect(deriveCompletedItems(ids, { ...UNKNOWN, rides: subFloor })).toEqual([]);
    expect(
      deriveCompletedItems(ids, {
        ...UNKNOWN,
        rides: [
          ...subFloor,
          {
            status: RideStatus.Completed,
            durationS: MIN_RIDE_ELAPSED_S,
            distanceM: MIN_RIDE_DISTANCE_M,
          },
        ],
      }),
    ).toEqual(ids);
  });

  it('ticks the expense item from any bike with an expense', () => {
    const ids = [CHECKLIST_ITEM_ID.FIRST_EXPENSE];
    expect(deriveCompletedItems(ids, { ...UNKNOWN, expenseCounts: [0, undefined] })).toEqual([]);
    expect(deriveCompletedItems(ids, { ...UNKNOWN, expenseCounts: [0, undefined, 3] })).toEqual(
      ids,
    );
  });

  it('ticks the scan item from a scan this month', () => {
    const ids = [CHECKLIST_ITEM_ID.SCAN_RECEIPT];
    expect(deriveCompletedItems(ids, { ...UNKNOWN, receiptScansUsed: 0 })).toEqual([]);
    expect(deriveCompletedItems(ids, { ...UNKNOWN, receiptScansUsed: 1 })).toEqual(ids);
  });

  it('leaves routes and the dashboard to a tap', () => {
    expect(isDataBackedItem(CHECKLIST_ITEM_ID.BROWSE_ROUTES)).toBe(false);
    expect(isDataBackedItem(CHECKLIST_ITEM_ID.EXPLORE_DASHBOARD)).toBe(false);
    expect(isDataBackedItem('toString')).toBe(false);
  });

  it('only returns items it was asked about', () => {
    const everything: ChecklistSignals = {
      bikes: [{ id: 'b', primaryPhotoUrl: 'https://x.test/p.jpg' }],
      rides: [{ status: RideStatus.Completed, durationS: 600, distanceM: 5000 }],
      expenseCounts: [1],
      receiptScansUsed: 1,
    };
    expect(deriveCompletedItems([CHECKLIST_ITEM_ID.FIRST_RIDE], everything)).toEqual([
      CHECKLIST_ITEM_ID.FIRST_RIDE,
    ]);
  });
});
