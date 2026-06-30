// MOT-273: the v3 persist migration refreshes the first_expense deep link IN
// PLACE for already-onboarded users. A logic slip here would silently corrupt
// or hide the checklist with no rollback, so pin the behavior the code review
// verified by hand: links refresh from source, progress is preserved, orphaned
// items pass through, and an already-v3 state is untouched.

jest.mock('react-native-mmkv', () => require('../../test/mocks').makeMmkvMock());
jest.mock('../../lib/analytics', () => require('../../test/mocks').mockAnalytics());

import { ALL_CHECKLIST_ITEMS, CHECKLIST_ITEM_ID, migrateChecklistState } from '../checklist.store';

const expenseSource = ALL_CHECKLIST_ITEMS.find((i) => i.id === CHECKLIST_ITEM_ID.FIRST_EXPENSE);
if (!expenseSource) throw new Error('FIRST_EXPENSE source item missing');

describe('migrateChecklistState (v2 -> v3)', () => {
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

  it('returns an already-v3 state unchanged', () => {
    const state = {
      items: [expenseSource],
      completedItems: [CHECKLIST_ITEM_ID.FIRST_EXPENSE],
      dismissed: true,
      initialized: true,
    };

    expect(migrateChecklistState(state, 3)).toEqual(state);
  });
});
