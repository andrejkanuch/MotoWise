/**
 * Home renders its own error card when its reads fail, so a cold start with the
 * API down must not raise the app client's global "Error" alert on top. The
 * onboarding checklist reads the same bike list (`motorcycles.all`) and is
 * disabled unless the "first expense" item is on it — a disabled observer still
 * sits in `query.observers`, and once vetoed Home's opt-out.
 *
 * Runs through the app's REAL client (`lib/query-client`), retries included.
 */
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));
jest.mock('react-native-mmkv', () => require('@/test/mocks').makeMmkvMock());
jest.mock('@/lib/analytics', () => ({
  ...require('@/test/mocks').mockAnalytics(),
  addBreadcrumb: jest.fn(),
}));

const mockFetcher = jest.fn();
jest.mock('@/lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));
// meOptions signs out a session whose account is gone; keep the real Supabase
// client (which needs env vars) out of this render test.
jest.mock('@/lib/account-gone', () => ({
  isAccountGoneError: () => false,
  getRequestSessionUserId: () => null,
  signOutGoneAccount: jest.fn(),
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }));
jest.mock('@/lib/notifications', () => ({
  reconcileMaintenanceReminders: jest.fn(() => Promise.resolve()),
}));

import { QueryClientProvider } from '@tanstack/react-query';
import { act, render } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { queryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import {
  ALL_CHECKLIST_ITEMS,
  CHECKLIST_ITEM_ID,
  useChecklistStore,
} from '@/stores/checklist.store';
import { OnboardingChecklist } from '../onboarding-checklist';
import { useHomeData } from '../use-home-data';

/** Every retry of the app client: 2 + 4 + 8 s. */
const ALL_RETRIES_MS = 30_000;
const settle = () => act(async () => jest.advanceTimersByTimeAsync(ALL_RETRIES_MS));

function HomeReads() {
  useHomeData();
  return <OnboardingChecklist />;
}

const checklistWith = (ids: readonly string[]) =>
  useChecklistStore.setState({
    items: ALL_CHECKLIST_ITEMS.filter((item) => ids.includes(item.id)),
    completedItems: [],
    dismissed: false,
    initialized: true,
  });

let alert: jest.SpyInstance;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockFetcher.mockImplementation(() => Promise.reject(new Error('API is down')));
});
afterEach(() => {
  queryClient.clear();
  alert.mockRestore();
  jest.useRealTimers();
});

describe('Home cold start with the API down and nothing cached', () => {
  it.each([
    ['without the expense item (its bike-list read is disabled)', [CHECKLIST_ITEM_ID.FIRST_RIDE]],
    ['with the expense item (its bike-list read runs)', [CHECKLIST_ITEM_ID.FIRST_EXPENSE]],
  ] as const)('raises no global alert, checklist %s', async (_name, ids) => {
    checklistWith(ids);
    await render(
      <QueryClientProvider client={queryClient}>
        <HomeReads />
      </QueryClientProvider>,
    );
    await settle();
    expect(
      queryClient.getQueryCache().find({ queryKey: queryKeys.motorcycles.all })?.state.status,
    ).toBe('error');
    expect(alert).not.toHaveBeenCalled();
  });
});
