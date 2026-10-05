jest.mock('react-native-mmkv', () => require('../../test/mocks').makeMmkvMock());

const mockTrackEvent = jest.fn();
const mockSetUserProperties = jest.fn();
jest.mock('../analytics', () => ({
  AnalyticsEvent: { CORE_ACTION_MILESTONE: 'core_action_milestone' },
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
  setUserProperties: (...args: unknown[]) => mockSetUserProperties(...args),
  isAnalyticsEnabled: () => mockAnalyticsEnabled,
}));
let mockAnalyticsEnabled = true;

let mockUserId: string | null = 'user-1';
jest.mock('../../stores/auth.store', () => ({
  useAuthStore: {
    getState: () => ({ session: mockUserId ? { user: { id: mockUserId } } : null }),
  },
}));

import {
  CORE_ACTION_KIND,
  CORE_ACTION_MILESTONE_COUNT,
  recordCoreAction,
} from '../core-action-milestones';

beforeEach(() => {
  mockAnalyticsEnabled = true;
  mockTrackEvent.mockClear();
  mockSetUserProperties.mockClear();
});

function milestoneCalls() {
  return mockTrackEvent.mock.calls.filter(([event]) => event === 'core_action_milestone');
}

describe('recordCoreAction', () => {
  it('fires the milestone exactly once, at the milestone count', () => {
    mockUserId = 'rider-a';
    const counts = Array.from({ length: CORE_ACTION_MILESTONE_COUNT + 2 }, () =>
      recordCoreAction(CORE_ACTION_KIND.RIDE_SAVED),
    );

    expect(counts).toEqual([1, 2, 3, 4, 5]);
    expect(milestoneCalls()).toEqual([
      ['core_action_milestone', { kind: 'ride_saved', count: CORE_ACTION_MILESTONE_COUNT }],
    ]);
  });

  it('keeps the person-property count current on every save', () => {
    mockUserId = 'rider-b';
    recordCoreAction(CORE_ACTION_KIND.SERVICE_LOGGED);
    recordCoreAction(CORE_ACTION_KIND.SERVICE_LOGGED);

    expect(mockSetUserProperties.mock.calls).toEqual([
      [{ services_logged_count: 1 }],
      [{ services_logged_count: 2 }],
    ]);
  });

  it('counts each kind separately', () => {
    mockUserId = 'rider-c';
    recordCoreAction(CORE_ACTION_KIND.RIDE_SAVED);
    recordCoreAction(CORE_ACTION_KIND.RIDE_SAVED);
    expect(recordCoreAction(CORE_ACTION_KIND.SERVICE_LOGGED)).toBe(1);
    expect(milestoneCalls()).toHaveLength(0);
  });

  it('counts per user, so a second account on the device starts from zero', () => {
    mockUserId = 'rider-d';
    recordCoreAction(CORE_ACTION_KIND.RIDE_SAVED);
    recordCoreAction(CORE_ACTION_KIND.RIDE_SAVED);
    mockUserId = 'rider-e';
    expect(recordCoreAction(CORE_ACTION_KIND.RIDE_SAVED)).toBe(1);
  });
});

describe('milestone while analytics is off', () => {
  it('is kept for the next save after opt-in, then sent exactly once', () => {
    mockUserId = 'user-consent-later';
    mockAnalyticsEnabled = false;
    for (let i = 0; i < CORE_ACTION_MILESTONE_COUNT; i++) {
      recordCoreAction(CORE_ACTION_KIND.SERVICE_LOGGED);
    }
    expect(milestoneCalls()).toHaveLength(0);

    mockAnalyticsEnabled = true;
    recordCoreAction(CORE_ACTION_KIND.SERVICE_LOGGED);
    expect(milestoneCalls()).toEqual([
      ['core_action_milestone', { kind: 'service_logged', count: CORE_ACTION_MILESTONE_COUNT + 1 }],
    ]);

    recordCoreAction(CORE_ACTION_KIND.SERVICE_LOGGED);
    expect(milestoneCalls()).toHaveLength(1);
  });
});
