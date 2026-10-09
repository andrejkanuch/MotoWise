// Lives outside src/app on purpose: expo-router turns every file under src/app
// into a route, so a test there would be bundled into the app as a screen.
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
jest.mock('../../hooks/use-currency', () => ({ useCurrency: () => ({ currency: 'EUR' }) }));
jest.mock('../../hooks/use-mileage-unit', () => ({ useMileageUnit: () => 'km' }));
jest.mock('../../components/task-photo-gallery', () => ({ TaskPhotoGallery: () => null }));
// The native control is replaced by one pressable per segment.
jest.mock('../../components/ui/themed-segmented-control', () => {
  const { Pressable, Text } = require('react-native');
  return {
    ThemedSegmentedControl: ({
      values,
      onChange,
    }: {
      values: string[];
      onChange: (index: number) => void;
    }) =>
      values.map((label, index) => (
        <Pressable key={label} testID={`segment-${index}`} onPress={() => onChange(index)}>
          <Text>{label}</Text>
        </Pressable>
      )),
  };
});

const mockPush = jest.fn();
let mockParams: Record<string, string | undefined> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => mockParams,
}));

const mockFetcher = jest.fn();
jest.mock('../../lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));

import {
  DeleteMaintenanceTaskDocument,
  MaintenancePriority,
  MaintenanceTaskStatus,
  MaintenanceTasksByMotorcycleDocument,
  MyMotorcyclesDocument,
} from '@motovault/graphql';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';
import '../../i18n';
import BikeTasksScreen from '../../app/(tabs)/(garage)/bike-tasks';
import type { HubTask } from '../../components/bike-hub/shell/use-bike-hub-data';
import { queryKeys } from '../../lib/query-keys';

const BIKE_ID = 'bike-a';

function hubTask(overrides: Partial<HubTask>): HubTask {
  return {
    id: 'task',
    userId: 'user-1',
    motorcycleId: BIKE_ID,
    title: 'Task',
    status: MaintenanceTaskStatus.Pending,
    priority: MaintenancePriority.Medium,
    source: null,
    dueDate: null,
    targetMileage: null,
    description: null,
    notes: null,
    partsNeeded: null,
    completedAt: null,
    completedMileage: null,
    cost: null,
    partsCost: null,
    laborCost: null,
    totalAmount: null,
    currency: 'EUR',
    photos: [],
    lineItems: [],
    ...overrides,
  } as HubTask;
}

const LATE = hubTask({
  id: 'late',
  title: 'Oil change',
  dueDate: '2020-01-01',
  priority: MaintenancePriority.Critical,
});
const OPEN = hubTask({ id: 'open', title: 'Chain clean' });
const DONE = hubTask({
  id: 'done',
  title: 'Brake fluid',
  status: MaintenanceTaskStatus.Completed,
  completedAt: '2026-09-01T10:00:00Z',
});

async function renderScreen(
  tasks: HubTask[],
  params: Record<string, string> = {},
  deleteResult: () => Promise<unknown> = () => Promise.resolve({ deleteMaintenanceTask: true }),
) {
  mockParams = { motorcycleId: BIKE_ID, bikeName: 'Honda', ...params };
  mockFetcher.mockImplementation((document: unknown) => {
    if (document === DeleteMaintenanceTaskDocument) return deleteResult();
    if (document === MaintenanceTasksByMotorcycleDocument) {
      return Promise.resolve({ maintenanceTasks: tasks });
    }
    if (document === MyMotorcyclesDocument) {
      return Promise.resolve({
        myMotorcycles: [{ id: BIKE_ID, make: 'Honda', currentMileage: 1000 }],
      });
    }
    return Promise.resolve(undefined);
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  await render(
    <QueryClientProvider client={client}>
      <BikeTasksScreen />
    </QueryClientProvider>,
  );
  await screen.findByText(tasks[0]?.title ?? 'No maintenance tasks yet');
  return client;
}

afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

/** Opens the row, taps Delete and returns the confirm alert's destructive button. */
async function openDeleteConfirm(title: string): Promise<AlertButton> {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await fireEvent.press(screen.getByLabelText(new RegExp(`^${title}\\. `)));
  await fireEvent.press(screen.getByText('Delete'));
  const buttons = alert.mock.calls.at(-1)?.[2] ?? [];
  const destructive = buttons.find((button) => button.style === 'destructive');
  if (!destructive?.onPress) throw new Error('no destructive confirm button');
  return destructive;
}

function deleteCalls() {
  return mockFetcher.mock.calls.filter(([document]) => document === DeleteMaintenanceTaskDocument);
}

describe('All Tasks screen', () => {
  it('lists open tasks with their mark-done circle and completed work below', async () => {
    await renderScreen([DONE, OPEN, LATE]);
    expect(screen.getByLabelText('Mark Oil change done')).toBeTruthy();
    expect(screen.getByLabelText('Mark Chain clean done')).toBeTruthy();
    // Completed work has no check circle.
    expect(screen.queryByLabelText('Mark Brake fluid done')).toBeNull();
    // The row label leads with the title and joins its parts with ". ".
    expect(screen.getByLabelText(/^Oil change\. .*critical priority$/)).toBeTruthy();
    expect(screen.getByText('Active · 2')).toBeTruthy();
    expect(screen.getByText('Completed · 1')).toBeTruthy();
  });

  it('the check circle opens the completion screen with the same params', async () => {
    await renderScreen([OPEN]);
    await fireEvent.press(screen.getByLabelText('Mark Chain clean done'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(tabs)/(garage)/complete-task',
      params: { taskId: 'open', motorcycleId: BIKE_ID, bikeName: 'Honda' },
    });
  });

  it('expands a row on tap and routes Edit / confirms Delete', async () => {
    await renderScreen([OPEN]);
    expect(screen.queryByText('Edit')).toBeNull();
    await fireEvent.press(screen.getByLabelText(/^Chain clean\. /));
    await fireEvent.press(screen.getByText('Edit'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(tabs)/(garage)/edit-maintenance-task',
      params: { taskId: 'open', motorcycleId: BIKE_ID, bikeName: 'Honda' },
    });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await fireEvent.press(screen.getByText('Delete'));
    expect(alert).toHaveBeenCalledWith('Delete Task', expect.any(String), expect.any(Array));
  });

  it('overdue shows only open overdue tasks', async () => {
    await renderScreen([DONE, OPEN, LATE]);
    await fireEvent.press(screen.getByTestId('segment-1'));
    expect(screen.getByText('Oil change')).toBeTruthy();
    expect(screen.queryByText('Chain clean')).toBeNull();
    expect(screen.queryByText('Brake fluid')).toBeNull();
    // Section titles belong to the "All" filter only.
    expect(screen.queryByText(/^Active · /)).toBeNull();
  });

  it('an empty filter shows its own empty state', async () => {
    await renderScreen([OPEN]);
    await fireEvent.press(screen.getByTestId('segment-3'));
    expect(screen.getByText('No completed tasks yet')).toBeTruthy();
    expect(screen.getByText('Completed tasks will appear here')).toBeTruthy();
  });

  it('deep link: opens on the given filter with the task expanded', async () => {
    await renderScreen([DONE, OPEN], { initialFilter: 'completed', expandTaskId: 'done' });
    expect(screen.queryByText('Chain clean')).toBeNull();
    expect(screen.getByText('Delete')).toBeTruthy();
    // A completed task cannot be edited.
    expect(screen.queryByText('Edit')).toBeNull();
  });

  it('confirming Delete deletes the task and refreshes both task lists', async () => {
    const client = await renderScreen([OPEN]);
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const confirm = await openDeleteConfirm('Chain clean');
    await act(async () => confirm.onPress?.());

    await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(2));
    expect(deleteCalls()).toEqual([[DeleteMaintenanceTaskDocument, { id: 'open' }]]);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.maintenanceTasks.byMotorcycle(BIKE_ID),
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.maintenanceTasks.allUser });
  });

  it('a failed delete tells the rider and refreshes nothing', async () => {
    const client = await renderScreen([OPEN], {}, () => Promise.reject(new Error('network')));
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const confirm = await openDeleteConfirm('Chain clean');
    const alert = jest.mocked(Alert.alert);
    await act(async () => confirm.onPress?.());

    await waitFor(() => expect(alert).toHaveBeenCalledWith('Error', 'Failed to delete task.'));
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('a second confirm while the delete is in flight is ignored', async () => {
    let settle: (value: unknown) => void = () => {};
    const pending = new Promise((resolve) => {
      settle = resolve;
    });
    await renderScreen([OPEN], {}, () => pending);
    const confirm = await openDeleteConfirm('Chain clean');
    await act(async () => confirm.onPress?.());
    await act(async () => confirm.onPress?.());
    expect(deleteCalls()).toHaveLength(1);

    // Once it settles, a later delete goes through again.
    await act(async () => settle({ deleteMaintenanceTask: true }));
    await act(async () => confirm.onPress?.());
    expect(deleteCalls()).toHaveLength(2);
  });

  it('files a task past its target odometer under Overdue, even with no due date', async () => {
    const kmOver = hubTask({ id: 'km-over', title: 'Valve check', targetMileage: 900 });
    await renderScreen([OPEN, kmOver]);
    await fireEvent.press(screen.getByTestId('segment-1'));
    expect(await screen.findByText('Valve check')).toBeTruthy();
    expect(screen.queryByText('Chain clean')).toBeNull();

    await fireEvent.press(screen.getByTestId('segment-2'));
    expect(screen.queryByText('Valve check')).toBeNull();
    expect(screen.getByText('Chain clean')).toBeTruthy();
  });
});
