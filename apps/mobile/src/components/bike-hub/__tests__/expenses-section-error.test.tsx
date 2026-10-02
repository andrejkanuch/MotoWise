/**
 * The legacy Expenses section (the interim Costs segment) shares this year's
 * expenses cache entry with the Overview. Both observers pass the same
 * opt-out, so the global alert stays away — which makes the section's own
 * error state mandatory: a failed list must never read as "No expenses yet".
 */
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-mmkv', () => require('../../../test/mocks').makeMmkvMock());
jest.mock('../../../lib/analytics', () => ({
  ...require('../../../test/mocks').mockAnalytics(),
  addBreadcrumb: jest.fn(),
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../../../hooks/use-currency', () => ({ useCurrency: () => ({ currency: 'EUR' }) }));
jest.mock('../../../hooks/use-delete-expense', () => ({
  useDeleteExpense: () => ({ mutate: jest.fn() }),
}));
jest.mock('../../shared/swipeable-expense', () => ({ SwipeableExpense: () => null }));

const mockFetcher = jest.fn();
jest.mock('../../../lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));

import { ExpensesByMotorcycleDocument } from '@motovault/graphql';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, View } from 'react-native';
import '../../../i18n';
import { HUB_UNIT } from '../../../lib/bike-hub/constants';
import { queryClient } from '../../../lib/query-client';
import { BIKE_A } from '../../../test/bike-hub-fixtures';
import { ExpensesSection } from '../expenses-section';
import { useOverviewData } from '../overview/use-overview-data';
import type { BikeHubData, HubBike } from '../shell/use-bike-hub-data';

/** Every retry of the app client: 2 + 4 + 8 s. */
const ALL_RETRIES_MS = 30_000;
const settle = () => act(async () => jest.advanceTimersByTimeAsync(ALL_RETRIES_MS));

const SHELL = {
  tasks: [],
  tasksLoading: false,
  tasksError: false,
  refetchTasks: jest.fn(),
  tasksRefreshFailed: false,
  documents: [] as BikeHubData['documents'],
  documentsLoading: false,
  documentsError: false,
  refetchDocuments: jest.fn(),
};

function OverviewObserver() {
  useOverviewData(BIKE_A as unknown as HubBike, SHELL, HUB_UNIT.KM);
  return null;
}

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

function renderSection({ withOverview }: { withOverview: boolean }) {
  return render(
    <QueryClientProvider client={queryClient}>
      <View>
        {withOverview ? <OverviewObserver /> : null}
        <ExpensesSection motorcycleId={BIKE_A.id} isDark />
      </View>
    </QueryClientProvider>,
  );
}

describe('ExpensesSection — a failed first load', () => {
  it.each([
    ['alone', false],
    ['mounted beside the Overview (shared cache entry)', true],
  ])('%s: shows its own error with Retry, never the empty state, and no global alert', async (_name, withOverview) => {
    await renderSection({ withOverview });
    await settle();
    expect(screen.getByTestId('expenses-load-error')).toBeTruthy();
    expect(screen.getByText('Failed to load expense data')).toBeTruthy();
    expect(screen.queryByText('No expenses yet')).toBeNull();
    expect(alert).not.toHaveBeenCalled();
  });

  it('Retry refetches and the list replaces the error', async () => {
    await renderSection({ withOverview: false });
    await settle();
    mockFetcher.mockImplementation((document: unknown) =>
      document === ExpensesByMotorcycleDocument
        ? Promise.resolve({ expenses: { ytdTotal: 0, categories: [] } })
        : Promise.resolve({ maintenanceTasks: [] }),
    );
    await act(async () => fireEvent.press(screen.getByTestId('expenses-retry')));
    await settle();
    expect(screen.queryByTestId('expenses-load-error')).toBeNull();
    expect(screen.getByText('No expenses yet')).toBeTruthy();
  });
});
