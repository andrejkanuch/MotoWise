// MOT-273: the v3 persist migration refreshes the first_expense deep link IN
// PLACE for already-onboarded users. U8 adds a cumulative v4 pass that appends
// the "scan a receipt" item to an already-initialized checklist. A logic slip
// here would silently corrupt or hide the checklist with no rollback, so pin the
// behavior the code review verified by hand: links refresh from source, progress
// is preserved, orphaned items pass through, v3 states gain the scan item, and an
// already-v4 state is untouched.

jest.mock('react-native-mmkv', () => require('../../test/mocks').makeMmkvMock());
jest.mock('../../lib/analytics', () => require('../../test/mocks').mockAnalytics());

import {
  ALL_CHECKLIST_ITEMS,
  CHECKLIST_ITEM_ID,
  migrateChecklistState,
  useChecklistStore,
} from '../checklist.store';

const RIDER_A = 'rider-a';
const RIDER_B = 'rider-b';

const expenseSource = ALL_CHECKLIST_ITEMS.find((i) => i.id === CHECKLIST_ITEM_ID.FIRST_EXPENSE);
if (!expenseSource) throw new Error('FIRST_EXPENSE source item missing');
const scanSource = ALL_CHECKLIST_ITEMS.find((i) => i.id === CHECKLIST_ITEM_ID.SCAN_RECEIPT);
if (!scanSource) throw new Error('SCAN_RECEIPT source item missing');

describe('migrateChecklistState (cumulative v2 -> v4)', () => {
  it('refreshes each item deepLink from source while preserving progress', () => {
    const persisted = {
      items: [
        { ...expenseSource, deepLink: '/(tabs)/(garage)' }, // stale pre-v3 link
        ...ALL_CHECKLIST_ITEMS.filter((i) => i.id !== CHECKLIST_ITEM_ID.FIRST_EXPENSE),
      ],
      completedItems: [CHECKLIST_ITEM_ID.FIRST_RIDE],
      dismissed: false,
      initialized: true,
    };

    const result = migrateChecklistState(persisted, 2);

    // first_expense link is refreshed from source, not left stale
    const expense = result.items.find((i) => i.id === CHECKLIST_ITEM_ID.FIRST_EXPENSE);
    expect(expense?.deepLink).toBe(expenseSource.deepLink);
    // progress + card visibility preserved
    expect(result.completedItems).toEqual([CHECKLIST_ITEM_ID.FIRST_RIDE]);
    expect(result.dismissed).toBe(false);
    expect(result.initialized).toBe(true);
    expect(result.items).toHaveLength(ALL_CHECKLIST_ITEMS.length);
  });

  it('passes through items with no matching source unchanged', () => {
    const orphan = {
      id: 'removed_item',
      labelKey: 'gone',
      icon: 'X',
      deepLink: '/old',
      goalRelation: 'none',
    };

    const result = migrateChecklistState(
      { items: [orphan], completedItems: [], dismissed: false, initialized: true },
      2,
    );

    expect(result.items[0]).toEqual(orphan);
  });

  it('handles an empty / never-initialized store without throwing', () => {
    const result = migrateChecklistState(
      { items: [], completedItems: [], dismissed: false, initialized: false },
      2,
    );

    expect(result.items).toEqual([]);
    expect(result.initialized).toBe(false);
  });

  it('appends the scan-receipt item when migrating a v3 state (v4), preserving progress', () => {
    const state = {
      items: [expenseSource],
      completedItems: [CHECKLIST_ITEM_ID.FIRST_EXPENSE],
      dismissed: true,
      initialized: true,
    };

    const result = migrateChecklistState(state, 3);

    expect(result.items.map((i) => i.id)).toContain(CHECKLIST_ITEM_ID.SCAN_RECEIPT);
    // existing item + progress untouched, scan appended after
    expect(result.items[0]).toEqual(expenseSource);
    expect(result.completedItems).toEqual([CHECKLIST_ITEM_ID.FIRST_EXPENSE]);
    expect(result.dismissed).toBe(true);
  });

  it('is idempotent — an already-v4 state keeps its items and progress', () => {
    const state = {
      items: [expenseSource, scanSource],
      completedItems: [CHECKLIST_ITEM_ID.FIRST_EXPENSE],
      dismissed: true,
      initialized: true,
    };

    expect(migrateChecklistState(state, 4)).toEqual({ ...state, ownerUserId: null });
  });

  it('v5: a pre-owner blob keeps its card, unclaimed, for the next rider to adopt', () => {
    const state = {
      items: [expenseSource],
      completedItems: [CHECKLIST_ITEM_ID.FIRST_EXPENSE],
      dismissed: false,
      initialized: true,
    };

    const result = migrateChecklistState(state, 4);

    expect(result.ownerUserId).toBeNull();
    expect(result.initialized).toBe(true);
    expect(result.completedItems).toEqual([CHECKLIST_ITEM_ID.FIRST_EXPENSE]);
  });

  it('keeps the owner of an already-v5 state', () => {
    const state = {
      items: [expenseSource],
      completedItems: [],
      dismissed: false,
      initialized: true,
      ownerUserId: RIDER_A,
    };

    expect(migrateChecklistState(state, 5).ownerUserId).toBe(RIDER_A);
  });
});

/**
 * #4: the card is owner-keyed. The root layout's auth listener calls
 * `claimForUser` whenever a session is observed and never resets on sign-out
 * (pinned by `sign-out-reset-contract.test.ts`); these drive the same sequence
 * of store calls a sign-out / sign-in produces.
 */
describe('owner-keyed checklist across sign-out', () => {
  beforeEach(() => {
    useChecklistStore.getState().reset();
  });

  function riderAMidChecklist() {
    useChecklistStore.getState().claimForUser(RIDER_A);
    useChecklistStore.getState().initialize(['track_rides'], RIDER_A);
    useChecklistStore.getState().completeItem(CHECKLIST_ITEM_ID.FIRST_RIDE);
  }

  it('initialize records the owner', () => {
    useChecklistStore.getState().initialize(['track_rides'], RIDER_A);
    expect(useChecklistStore.getState().ownerUserId).toBe(RIDER_A);
  });

  it('the same rider signing back in keeps the card and its ticks', () => {
    riderAMidChecklist();
    // Sign-out (by hand or forced) leaves the store alone; the next session is A again.
    useChecklistStore.getState().claimForUser(RIDER_A);

    const state = useChecklistStore.getState();
    expect(state.initialized).toBe(true);
    expect(state.items.length).toBeGreaterThan(0);
    expect(state.completedItems).toEqual([CHECKLIST_ITEM_ID.FIRST_RIDE]);
    expect(state.ownerUserId).toBe(RIDER_A);
  });

  it('a different rider signing in resets the card and takes it over', () => {
    riderAMidChecklist();
    useChecklistStore.getState().dismiss();

    useChecklistStore.getState().claimForUser(RIDER_B);

    expect(useChecklistStore.getState()).toEqual(
      expect.objectContaining({
        items: [],
        completedItems: [],
        dismissed: false,
        initialized: false,
        ownerUserId: RIDER_B,
      }),
    );
  });

  it('a legacy (unowned) card is adopted by the first signed-in rider, not reset', () => {
    useChecklistStore.setState({
      items: [expenseSource],
      completedItems: [CHECKLIST_ITEM_ID.FIRST_EXPENSE],
      dismissed: false,
      initialized: true,
      ownerUserId: null,
    });

    useChecklistStore.getState().claimForUser(RIDER_A);

    const state = useChecklistStore.getState();
    expect(state.ownerUserId).toBe(RIDER_A);
    expect(state.items).toEqual([expenseSource]);
    expect(state.completedItems).toEqual([CHECKLIST_ITEM_ID.FIRST_EXPENSE]);
  });

  it("initialize for a different rider starts a fresh card instead of keeping A's ticks", () => {
    riderAMidChecklist();
    useChecklistStore.getState().initialize(['track_rides'], RIDER_B);

    const state = useChecklistStore.getState();
    expect(state.ownerUserId).toBe(RIDER_B);
    expect(state.completedItems).toEqual([]);
  });
});
