// The expense option carries an EXPENSE_ENTRY_SOURCE (lib/expense-analytics → analytics).
jest.mock('@/lib/analytics', () => require('@/test/mocks').mockAnalytics());

import { ADD_TASK_MODE, BIKE_LEAF, BIKE_SEGMENT, LOG_OPTION } from '@/lib/bike-hub/constants';
import { EXPENSE_ENTRY_SOURCE } from '@/lib/expense-analytics';
import { LOG_OPTIONS } from '../sheets/log-options';
import { buildBikeHubNavigation } from '../shell/use-bike-hub-navigation';

const TARGET = { motorcycleId: 'bike-a', bikeName: '2022 Honda Africa Twin' };
const BIKE = { id: 'bike-a', year: 2022, make: 'Honda', model: 'Africa Twin', nickname: null };

describe('LOG_OPTIONS', () => {
  it('lists the six options in the drawn order: what happened first, planning after', () => {
    expect(LOG_OPTIONS.map((option) => option.id)).toEqual([
      LOG_OPTION.EXPENSE,
      LOG_OPTION.PAST_WORK,
      LOG_OPTION.ODOMETER,
      LOG_OPTION.NOTE,
      LOG_OPTION.TASK,
      LOG_OPTION.DOCUMENT,
    ]);
  });

  it('each option resolves to its typed route with the bike pre-selected', () => {
    const hrefs = Object.fromEntries(LOG_OPTIONS.map((option) => [option.id, option.href(TARGET)]));
    expect(hrefs).toEqual({
      [LOG_OPTION.EXPENSE]: {
        pathname: '/(tabs)/(garage)/add-expense',
        params: { ...TARGET, entrySource: EXPENSE_ENTRY_SOURCE.BIKE_HUB },
      },
      [LOG_OPTION.TASK]: { pathname: '/(tabs)/(garage)/add-maintenance-task', params: TARGET },
      [LOG_OPTION.PAST_WORK]: {
        pathname: '/(tabs)/(garage)/add-maintenance-task',
        params: { ...TARGET, mode: ADD_TASK_MODE.LOG },
      },
      [LOG_OPTION.NOTE]: { pathname: '/(tabs)/(garage)/note', params: { motorcycleId: 'bike-a' } },
      // The same route and params the header's odometer chip opens.
      [LOG_OPTION.ODOMETER]: {
        pathname: '/(tabs)/(garage)/odometer',
        params: { motorcycleId: 'bike-a' },
      },
      [LOG_OPTION.DOCUMENT]: { pathname: '/(tabs)/(garage)/add-document', params: TARGET },
    });
  });
});

describe('buildBikeHubNavigation', () => {
  function setup(active = BIKE_SEGMENT.OVERVIEW) {
    const showSegment = jest.fn();
    const push = jest.fn();
    return {
      showSegment,
      push,
      navigation: buildBikeHubNavigation(BIKE, active, showSegment, push),
    };
  }

  it('a leaf shows its owning segment first, then is pushed', () => {
    const { navigation, showSegment, push } = setup();
    navigation.addExpense();
    expect(showSegment).toHaveBeenCalledWith(BIKE_SEGMENT.COSTS);
    expect(push).toHaveBeenCalledWith({
      pathname: '/(tabs)/(garage)/add-expense',
      params: { ...TARGET, entrySource: EXPENSE_ENTRY_SOURCE.BIKE_HUB },
    });
    expect(showSegment.mock.invocationCallOrder[0]).toBeLessThan(push.mock.invocationCallOrder[0]);
  });

  it('does not switch when the owner is already showing', () => {
    const { navigation, showSegment } = setup(BIKE_SEGMENT.SERVICE);
    navigation.addTask();
    expect(showSegment).not.toHaveBeenCalled();
  });

  it('documents belong to Bike; task forms to Service', () => {
    const { navigation, showSegment, push } = setup();
    navigation.openDocument('doc-1');
    expect(showSegment).toHaveBeenLastCalledWith(BIKE_SEGMENT.BIKE);
    expect(push).toHaveBeenLastCalledWith({
      pathname: '/(tabs)/(garage)/document/[id]',
      params: { id: 'doc-1', motorcycleId: 'bike-a', bikeName: 'Honda Africa Twin' },
    });
    navigation.logPastWork();
    expect(showSegment).toHaveBeenLastCalledWith(BIKE_SEGMENT.SERVICE);
    expect(push).toHaveBeenLastCalledWith({
      pathname: '/(tabs)/(garage)/add-maintenance-task',
      params: { ...TARGET, mode: ADD_TASK_MODE.LOG },
    });
  });

  it('notes and the sheets keep the current segment; notes carry it as the back label', () => {
    const { navigation, showSegment, push } = setup(BIKE_SEGMENT.BIKE);
    navigation.openNotes();
    navigation.openNoteSheet('draft text');
    navigation.openLogSheet();
    navigation.openOdometerSheet();
    expect(showSegment).not.toHaveBeenCalled();
    expect(push.mock.calls.map(([href]) => href)).toEqual([
      { pathname: '/(tabs)/(garage)/notes', params: { motorcycleId: 'bike-a', from: 'bike' } },
      {
        pathname: '/(tabs)/(garage)/note',
        params: { motorcycleId: 'bike-a', draft: 'draft text' },
      },
      { pathname: '/(tabs)/(garage)/log-entry', params: { motorcycleId: 'bike-a' } },
      { pathname: '/(tabs)/(garage)/odometer', params: { motorcycleId: 'bike-a' } },
    ]);
  });

  it('openLeaf follows the owner table', () => {
    const { navigation, showSegment } = setup();
    navigation.openLeaf(BIKE_LEAF.EDIT_TASK, '/(tabs)/(garage)');
    expect(showSegment).toHaveBeenCalledWith(BIKE_SEGMENT.SERVICE);
  });
});
