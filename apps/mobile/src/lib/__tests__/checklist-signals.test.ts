jest.mock('react-native-mmkv', () => require('../../test/mocks').makeMmkvMock());
jest.mock('../analytics', () => require('../../test/mocks').mockAnalytics());

import { RideStatus } from '@motovault/graphql';
import { CHECKLIST_ITEM_ID } from '../../stores/checklist.store';
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
    const unfinished = [{ status: RideStatus.Recording }, { status: RideStatus.Paused }];
    expect(deriveCompletedItems(ids, { ...UNKNOWN, rides: unfinished })).toEqual([]);
    expect(
      deriveCompletedItems(ids, {
        ...UNKNOWN,
        rides: [...unfinished, { status: RideStatus.Completed }],
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
      rides: [{ status: RideStatus.Completed }],
      expenseCounts: [1],
      receiptScansUsed: 1,
    };
    expect(deriveCompletedItems([CHECKLIST_ITEM_ID.FIRST_RIDE], everything)).toEqual([
      CHECKLIST_ITEM_ID.FIRST_RIDE,
    ]);
  });
});
