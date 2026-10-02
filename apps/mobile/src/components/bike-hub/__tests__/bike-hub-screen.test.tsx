jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 54, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('react-native-mmkv', () => require('../../../test/mocks').makeMmkvMock());
jest.mock('../../../lib/analytics', () => require('../../../test/mocks').mockAnalytics());
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native-keyboard-controller', () =>
  require('react-native-keyboard-controller/jest'),
);
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}));
jest.mock('@sentry/react-native', () => ({
  TimeToInitialDisplay: () => null,
  TimeToFullDisplay: () => null,
}));

const mockRouter = {
  push: jest.fn(),
  back: jest.fn(),
  replace: jest.fn(),
  navigate: jest.fn(),
  dismissAll: jest.fn(),
  canGoBack: jest.fn(() => true),
  canDismiss: jest.fn(() => true),
};
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useIsFocused: () => true,
}));

const mockFetcher = jest.fn();
jest.mock('../../../lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));
jest.mock('../../../lib/notifications', () => ({
  cancelDocumentNotificationsForBike: jest.fn(),
}));
jest.mock('../../../lib/image-upload', () => ({
  pickImage: jest.fn(),
  takePhoto: jest.fn(),
  uploadBikePhoto: jest.fn(),
}));
jest.mock('../../../stores/auth.store', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ session: { user: { id: 'user-1' } } }),
}));
jest.mock('../../../theme/editorial', () => ({
  useEditorialTheme: () => ({ t: { bg: 'legacy-bg' }, isDark: true }),
}));

// The wrapped legacy sections are exercised by their own screens; here they are
// stand-ins that expose the props the shell hands them.
const mockMaintenanceSection = jest.fn((_props: Record<string, unknown>) => null);
jest.mock('../maintenance-section', () => ({
  MaintenanceSection: (props: Record<string, unknown>) => mockMaintenanceSection(props),
}));
// The Overview has its own suite; here it is a stand-in that exposes its callbacks.
const mockOverviewSegment = jest.fn((_props: Record<string, unknown>) => null);
jest.mock('../overview/overview-segment', () => ({
  OverviewSegment: (props: Record<string, unknown>) => mockOverviewSegment(props),
}));
jest.mock('../expenses-section', () => ({ ExpensesSection: () => null }));
jest.mock('../documents-section', () => ({ DocumentsSection: () => null }));
jest.mock('../bike-details-card', () => ({ BikeDetailsCard: () => null }));
jest.mock('../../maintenance/oem-disclaimer-card', () => ({ OemDisclaimerCard: () => null }));
jest.mock('../../../features/receipt-scan/receipt-scan-entry', () => ({
  ReceiptScanEntry: () => null,
}));

import {
  DocumentsByMotorcycleDocument,
  MaintenancePriority,
  MaintenanceTaskSource,
  MaintenanceTaskStatus,
  MaintenanceTasksByMotorcycleDocument,
  MyMotorcyclesDocument,
  MyRidesDocument,
} from '@motovault/graphql';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import '../../../i18n';
import { ADD_TASK_MODE, BIKE_ORIGIN, BIKE_SEGMENT } from '../../../lib/bike-hub/constants';
import { useBikeHubStore } from '../../../stores/bike-hub.store';
import { BikeHubScreen, type BikeHubScreenProps } from '../shell/bike-hub-screen';

const BIKE_ID = 'bike-a';
const BIKE = {
  id: BIKE_ID,
  userId: 'user-1',
  make: 'Honda',
  model: 'Africa Twin',
  year: 2022,
  nickname: null,
  isPrimary: true,
  currentMileage: 38_167,
  distanceUnit: 'km',
  createdAt: '2022-06-01T00:00:00Z',
};
const OVERDUE_HIGH = {
  id: 'task-1',
  title: 'Brake pads inspection',
  priority: MaintenancePriority.High,
  status: MaintenanceTaskStatus.Pending,
  source: MaintenanceTaskSource.User,
  dueDate: '2020-03-15',
  targetMileage: null,
};

type Responses = Map<unknown, () => Promise<unknown>>;

function respondWith(overrides: Partial<{ bikes: unknown[]; pending: boolean }> = {}) {
  const never = new Promise(() => {});
  const responses: Responses = new Map([
    [
      MyMotorcyclesDocument,
      () =>
        overrides.pending ? never : Promise.resolve({ myMotorcycles: overrides.bikes ?? [BIKE] }),
    ],
    [
      MaintenanceTasksByMotorcycleDocument,
      () => Promise.resolve({ maintenanceTasks: [OVERDUE_HIGH] }),
    ],
    [DocumentsByMotorcycleDocument, () => Promise.resolve({ documents: [] })],
    [MyRidesDocument, () => Promise.resolve({ myRides: { totalCount: 9, edges: [] } })],
  ]);
  mockFetcher.mockImplementation((document: unknown) => responses.get(document)?.());
}

function hub(props: Partial<BikeHubScreenProps>, client: QueryClient) {
  return (
    <QueryClientProvider client={client}>
      <BikeHubScreen id={BIKE_ID} {...props} />
    </QueryClientProvider>
  );
}

const clients: QueryClient[] = [];

function newClient() {
  // No retries and no cache timers, so nothing outlives a test.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { gcTime: 0 } },
  });
  clients.push(client);
  return client;
}

async function renderHub(props: Partial<BikeHubScreenProps> = {}) {
  const client = newClient();
  const view = await render(hub(props, client));
  return { ...view, client };
}

afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
});

beforeEach(() => {
  jest.clearAllMocks();
  useBikeHubStore.setState({ lastSegmentByBike: {}, pendingTask: null });
  respondWith();
});

describe('BikeHubScreen — landing', () => {
  it('opens on Overview by default and mounts no other segment', async () => {
    await renderHub();
    expect(await screen.findByRole('tab', { name: 'Overview' })).toBeSelected();
    expect(screen.getByTestId('segment-panel-overview')).toBeOnTheScreen();
    expect(screen.queryByTestId('segment-panel-service')).toBeNull();
    expect(screen.getByText('Africa Twin')).toBeOnTheScreen();
    expect(screen.getByText('38,167 km')).toBeOnTheScreen();
  });

  it('with highlightTask opens on Service and hands the task to MaintenanceSection', async () => {
    await renderHub({ highlightTask: 'task-1' });
    expect(
      await screen.findByRole('tab', { name: 'Service, 1 overdue high-priority task' }),
    ).toBeSelected();
    expect(mockMaintenanceSection).toHaveBeenLastCalledWith(
      expect.objectContaining({
        initialExpandedId: 'task-1',
        motorcycleId: BIKE_ID,
        mileageUnit: 'km',
      }),
    );
  });

  it('opens on the remembered segment', async () => {
    useBikeHubStore.getState().setLastSegment(BIKE_ID, BIKE_SEGMENT.BIKE);
    await renderHub();
    expect(await screen.findByRole('tab', { name: 'Bike' })).toBeSelected();
  });

  it('an explicit segment param wins over the remembered one', async () => {
    useBikeHubStore.getState().setLastSegment(BIKE_ID, BIKE_SEGMENT.BIKE);
    await renderHub({ segment: BIKE_SEGMENT.COSTS });
    expect(await screen.findByRole('tab', { name: 'Costs' })).toBeSelected();
  });

  it('landing by rule does not overwrite the remembered segment', async () => {
    await renderHub({ highlightTask: 'task-1' });
    await screen.findByRole('tab', { name: /^Service/ });
    expect(useBikeHubStore.getState().lastSegmentByBike[BIKE_ID]).toBeUndefined();
  });

  it('re-lands when Home navigates again with a new task', async () => {
    const { rerender, client } = await renderHub();
    await screen.findByRole('tab', { name: 'Overview' });
    await rerender(hub({ highlightTask: 'task-1', ts: '2' }, client));
    expect(screen.getByRole('tab', { name: /^Service/ })).toBeSelected();
  });
});

describe('BikeHubScreen — segments', () => {
  it('switching segments remembers the choice and keeps earlier segments mounted', async () => {
    await renderHub();
    await fireEvent.press(await screen.findByRole('tab', { name: 'Costs' }));
    expect(useBikeHubStore.getState().lastSegmentByBike[BIKE_ID]).toBe(BIKE_SEGMENT.COSTS);
    expect(screen.getByRole('tab', { name: 'Costs' })).toBeSelected();

    await fireEvent.press(screen.getByRole('tab', { name: 'Overview' }));
    expect(useBikeHubStore.getState().lastSegmentByBike[BIKE_ID]).toBe(BIKE_SEGMENT.OVERVIEW);
    // Stays mounted (hidden) so its scroll position survives.
    expect(screen.getByTestId('segment-panel-costs', { includeHiddenElements: true })).toBeTruthy();
  });

  it('Overview shows the labelled "Log" pill; other segments an icon-only one', async () => {
    await renderHub();
    expect(
      await screen.findByRole('button', { name: 'Log something on this bike' }),
    ).toBeOnTheScreen();
    expect(screen.getByText('Log')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Log something on this bike' }));
    expect(mockRouter.push).toHaveBeenLastCalledWith({
      pathname: '/(tabs)/(garage)/log-entry',
      params: { motorcycleId: BIKE_ID },
    });

    await fireEvent.press(screen.getByRole('tab', { name: 'Costs' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add an expense' }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/(tabs)/(garage)/add-expense',
      params: { motorcycleId: BIKE_ID, bikeName: '2022 Honda Africa Twin' },
    });
  });

  it.each([
    [/^Service/, 'Add a maintenance task', '/(tabs)/(garage)/add-maintenance-task'],
    ['Bike', 'Add a document', '/(tabs)/(garage)/add-document'],
  ])('the %s pill opens its form for this bike', async (tab, label, pathname) => {
    await renderHub();
    await fireEvent.press(await screen.findByRole('tab', { name: tab }));
    await fireEvent.press(screen.getByRole('button', { name: label }));
    expect(mockRouter.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname,
        params: expect.objectContaining({ motorcycleId: BIKE_ID }),
      }),
    );
  });

  it('the interim Bike list keeps every old entry point and its analytics', async () => {
    const { trackEvent } = jest.requireMock('../../../lib/analytics') as { trackEvent: jest.Mock };
    await renderHub({ segment: BIKE_SEGMENT.BIKE });
    await fireEvent.press(await screen.findByTestId('bike-action-edit'));
    expect(mockRouter.push).toHaveBeenLastCalledWith({
      pathname: '/(tabs)/(garage)/edit-bike',
      params: { id: BIKE_ID },
    });

    await fireEvent.press(screen.getByTestId('bike-action-recalls'));
    expect(trackEvent).toHaveBeenLastCalledWith('RECALLS_CHECKED', {
      motorcycle_id: BIKE_ID,
      bike_make: 'Honda',
      bike_model: 'Africa Twin',
      bike_year: 2022,
      has_vin: false,
    });
    expect(mockRouter.push).toHaveBeenLastCalledWith({
      pathname: '/(modals)/recalls',
      params: { motorcycleId: BIKE_ID, bikeName: '2022 Honda Africa Twin' },
    });

    await fireEvent.press(screen.getByTestId('bike-action-service-report'));
    expect(trackEvent).toHaveBeenLastCalledWith('HEALTH_REPORT_VIEWED', {
      motorcycle_id: BIKE_ID,
      bike_make: 'Honda',
      bike_model: 'Africa Twin',
      bike_year: 2022,
    });
    expect(mockRouter.push).toHaveBeenLastCalledWith({
      pathname: '/(tabs)/(garage)/health-report',
      params: { bikeId: BIKE_ID },
    });

    await fireEvent.press(screen.getByTestId('bike-action-import-schedule'));
    expect(trackEvent).toHaveBeenLastCalledWith('OEM_SCHEDULE_IMPORTED', {
      motorcycle_id: BIKE_ID,
      bike_make: 'Honda',
      bike_model: 'Africa Twin',
      bike_year: 2022,
    });
    expect(screen.getByTestId('bike-action-photo')).toBeOnTheScreen();
    expect(screen.getByTestId('bike-action-remove')).toBeOnTheScreen();
  });
});

describe('BikeHubScreen — header and Overview wiring', () => {
  it('the odometer chip opens the Odometer sheet for this bike', async () => {
    await renderHub();
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Odometer 38,167 km, tap to update' }),
    );
    expect(mockRouter.push).toHaveBeenLastCalledWith({
      pathname: '/(tabs)/(garage)/odometer',
      params: { motorcycleId: BIKE_ID },
    });
  });

  it('an Overview task row shows Service with that task expanded, and remembers Service', async () => {
    await renderHub();
    await screen.findByRole('tab', { name: 'Overview' });
    const { onOpenTask } = mockOverviewSegment.mock.lastCall?.[0] as {
      onOpenTask: (taskId: string) => void;
    };
    await act(async () => onOpenTask('task-1'));
    expect(screen.getByRole('tab', { name: /^Service/ })).toBeSelected();
    expect(mockMaintenanceSection).toHaveBeenLastCalledWith(
      expect.objectContaining({ initialExpandedId: 'task-1' }),
    );
    expect(useBikeHubStore.getState().lastSegmentByBike[BIKE_ID]).toBe(BIKE_SEGMENT.SERVICE);
  });

  it('a task requested by a screen above (Notes) is shown on Service and the request is cleared', async () => {
    await renderHub();
    await screen.findByRole('tab', { name: 'Overview' });
    await act(async () => useBikeHubStore.getState().requestTask(BIKE_ID, 'task-1'));
    expect(screen.getByRole('tab', { name: /^Service/ })).toBeSelected();
    expect(mockMaintenanceSection).toHaveBeenLastCalledWith(
      expect.objectContaining({ initialExpandedId: 'task-1' }),
    );
    expect(useBikeHubStore.getState().pendingTask).toBeNull();
  });

  it('ignores a task requested for another bike', async () => {
    await renderHub();
    await screen.findByRole('tab', { name: 'Overview' });
    await act(async () => useBikeHubStore.getState().requestTask('other-bike', 'task-9'));
    expect(screen.getByRole('tab', { name: 'Overview' })).toBeSelected();
    expect(useBikeHubStore.getState().pendingTask).toEqual({
      bikeId: 'other-bike',
      taskId: 'task-9',
    });
  });

  it('opening a document from the Overview shows the Bike segment without remembering it', async () => {
    await renderHub();
    await screen.findByRole('tab', { name: 'Overview' });
    const { navigation } = mockOverviewSegment.mock.lastCall?.[0] as {
      navigation: { openDocument: (id: string) => void };
    };
    await act(async () => navigation.openDocument('doc-1'));
    expect(mockRouter.push).toHaveBeenLastCalledWith(
      expect.objectContaining({ pathname: '/(tabs)/(garage)/document/[id]' }),
    );
    expect(screen.getByRole('tab', { name: 'Bike' })).toBeSelected();
    expect(useBikeHubStore.getState().lastSegmentByBike[BIKE_ID]).toBeUndefined();
  });
});

describe('BikeHubScreen — states', () => {
  it('while loading: header with a working back button, no segments', async () => {
    respondWith({ pending: true });
    await renderHub();
    expect(screen.getByLabelText('Loading bike')).toBeOnTheScreen();
    expect(screen.queryByRole('tab')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to Garage' }));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('bike not found: message and a working back button to the origin', async () => {
    respondWith({ bikes: [] });
    await renderHub({ from: BIKE_ORIGIN.HOME });
    expect(await screen.findByText('This bike is no longer in your garage.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to Home' }));
    expect(mockRouter.dismissAll).toHaveBeenCalledTimes(1);
    expect(mockRouter.navigate).toHaveBeenCalledWith('/(tabs)/(home)');
  });
});

describe('ADD_TASK_MODE', () => {
  it('matches the mode the add-task screen reads', () => {
    expect(ADD_TASK_MODE.LOG).toBe('log');
  });
});
