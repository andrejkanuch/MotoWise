// Lives outside src/app on purpose: expo-router turns every file under src/app
// into a route, so a test there would be bundled into the app as a screen.
//
// Store review moment: logging past work is a service and may request a review;
// planning a future task is not a prompt moment.
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 54, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('../../utils/haptics', () => ({
  triggerImpact: jest.fn(),
  triggerNotification: jest.fn(),
  triggerSelection: jest.fn(),
}));
jest.mock('react-native-mmkv', () => require('../../test/mocks').makeMmkvMock());
jest.mock('../../lib/analytics', () => require('../../test/mocks').mockAnalytics());
jest.mock('../../lib/meta-analytics', () => ({
  MetaAnalytics: { trackLogMaintenance: jest.fn() },
}));
jest.mock('../../lib/core-action-milestones', () => ({
  CORE_ACTION_KIND: { SERVICE_LOGGED: 'service_logged' },
  recordCoreAction: jest.fn(),
}));
jest.mock('../../lib/notifications', () => ({
  scheduleMaintenanceReminder: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../hooks/use-mileage-unit', () => ({ useMileageUnit: () => 'km' }));

const mockMaybeRequestReview = jest.fn().mockResolvedValue(false);
jest.mock('../../lib/store-review', () => ({
  REVIEW_MOMENT: { MAINTENANCE: 'maintenance' },
  maybeRequestReview: (...args: unknown[]) => mockMaybeRequestReview(...args),
}));

let mockParams: Record<string, string | undefined> = {};
jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));

const mockFetcher = jest.fn();
jest.mock('../../lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));

import { CreateMaintenanceTaskDocument } from '@motovault/graphql';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import '../../i18n';
import AddMaintenanceTaskScreen from '../../app/(tabs)/(garage)/add-maintenance-task';

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

async function saveTask(mode: string) {
  mockParams = { motorcycleId: 'bike-1', mode };
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  await render(
    <QueryClientProvider client={client}>
      <AddMaintenanceTaskScreen />
    </QueryClientProvider>,
  );
  await fireEvent.changeText(screen.getByPlaceholderText('e.g. Oil change, tire check'), 'Oil');
  await fireEvent.press(screen.getByTestId('task-save'));
  await flush();
}

beforeEach(() => {
  mockFetcher.mockResolvedValue({
    createMaintenanceTask: {
      id: 'task-1',
      remind30Days: false,
      remind7Days: false,
      remind1Day: false,
    },
  });
  mockMaybeRequestReview.mockClear();
});

describe('Add maintenance task — store review moment', () => {
  it('logging past work offers the maintenance review moment', async () => {
    await saveTask('log');

    expect(mockFetcher).toHaveBeenCalledWith(CreateMaintenanceTaskDocument, expect.anything());
    expect(mockMaybeRequestReview).toHaveBeenCalledWith('maintenance');
  });

  it('planning a future task does not', async () => {
    await saveTask('plan');

    expect(mockFetcher).toHaveBeenCalledWith(CreateMaintenanceTaskDocument, expect.anything());
    expect(mockMaybeRequestReview).not.toHaveBeenCalled();
  });
});
