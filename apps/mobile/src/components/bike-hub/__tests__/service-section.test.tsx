jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('../../../hooks/use-currency', () => ({ useCurrency: () => ({ currency: 'EUR' }) }));
jest.mock('../../task-photo-gallery', () => ({ TaskPhotoGallery: () => null }));
jest.mock('../shell/use-today', () => ({
  useToday: () => jest.requireActual('../../../test/bike-hub-fixtures').TODAY,
}));

import { MaintenancePriority, MaintenanceTaskStatus } from '@motovault/graphql';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet, useWindowDimensions } from 'react-native';
import '../../../i18n';
import { countOverdueTasks, getServiceBadgeCount } from '../../../lib/bike-hub/attention';
import { HUB_UNIT } from '../../../lib/bike-hub/constants';
import {
  AIR_FILTER,
  BIKE_A_TASKS,
  BRAKE_PADS,
  KM,
  ODOMETER,
  task,
} from '../../../test/bike-hub-fixtures';
import { MaintenanceSection } from '../maintenance-section';
import type { HubTask } from '../shell/use-bike-hub-data';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 390, height: 844, scale: 3, fontScale: 1 })),
}));
const mockDimensions = useWindowDimensions as jest.Mock;

/** A full task row as the query returns it. */
function hubTask(base: ReturnType<typeof task>, overrides: Partial<HubTask> = {}): HubTask {
  return {
    userId: 'user-1',
    motorcycleId: 'bike-a',
    description: null,
    notes: null,
    partsNeeded: null,
    completedAt: null,
    completedMileage: null,
    cost: null,
    partsCost: null,
    laborCost: null,
    totalAmount: null,
    taxAmount: null,
    taxRate: null,
    currency: 'EUR',
    isRecurring: false,
    intervalKm: null,
    intervalDays: null,
    remind30d: false,
    remind7d: false,
    remind1d: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    photos: [],
    lineItems: [],
    ...base,
    ...overrides,
  } as HubTask;
}

const ACTIVE = BIKE_A_TASKS.map((base) => hubTask(base));

function done(id: string, completedAt: string, overrides: Partial<HubTask> = {}): HubTask {
  return hubTask(task({ id, title: `Done ${id}`, status: MaintenanceTaskStatus.Completed }), {
    completedAt,
    ...overrides,
  });
}

const handlers = () => ({
  onComplete: jest.fn(),
  onDelete: jest.fn(),
  onEdit: jest.fn(),
});

async function renderSection(tasks: HubTask[], extra: Record<string, unknown> = {}) {
  const callbacks = handlers();
  await render(
    <MaintenanceSection
      tasks={tasks}
      motorcycleId="bike-a"
      odometer={ODOMETER}
      make="Honda"
      mileageUnit={HUB_UNIT.KM}
      {...callbacks}
      {...extra}
    />,
  );
  return callbacks;
}

beforeEach(() => {
  mockPush.mockClear();
  mockDimensions.mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 1 });
});

describe('Service — one count', () => {
  it('"Overdue · N" is the badge number, on the same basis', async () => {
    await renderSection(ACTIVE);
    const badge = getServiceBadgeCount(ACTIVE, KM);
    expect(badge).toBe(countOverdueTasks(ACTIVE, KM));
    expect(screen.getByText(`Overdue · ${badge}`)).toBeOnTheScreen();
    const overdue = within(screen.getByTestId('service-group-overdue'));
    expect(overdue.getAllByTestId(/^service-task-done-/)).toHaveLength(badge);
  });

  it('lists every active task in its due group, priority first', async () => {
    await renderSection(ACTIVE);
    expect(screen.getByText(`Active · ${ACTIVE.length}`)).toBeOnTheScreen();
    expect(screen.getByTestId('service-group-overdue')).toBeOnTheScreen();
    // The first overdue row is the High one (priority before lateness).
    const rows = within(screen.getByTestId('service-group-overdue')).getAllByTestId(
      /^service-task-(?!done|details)/,
    );
    expect(rows[0]?.props.testID).toBe(`service-task-${BRAKE_PADS.id}`);
  });
});

describe('Service — task row', () => {
  it('shows the priority tag and the due line, never an OVERDUE pill', async () => {
    await renderSection(ACTIVE);
    expect(screen.queryByText('OVERDUE')).toBeNull();
    expect(screen.getAllByText('HIGH').length).toBeGreaterThan(0);
    // Elapsed time first, then the distance still to go — not the absolute target.
    expect(screen.getByText('201 days late')).toBeOnTheScreen();
    expect(screen.getByText(' · 3,933 km to target')).toBeOnTheScreen();
    expect(screen.queryByText(/42,100/)).toBeNull();
    expect(screen.queryByText(/day\(s\)/)).toBeNull();
  });

  it('pluralises properly: one day late', async () => {
    const yesterday = hubTask(task({ id: 'y', title: 'Chain lube', dueDate: '2026-10-01' }));
    await renderSection([yesterday]);
    expect(screen.getByText('1 day late')).toBeOnTheScreen();
  });

  it('the circle completes; the title opens the task — two sibling buttons', async () => {
    const callbacks = await renderSection(ACTIVE);
    await fireEvent.press(screen.getByRole('button', { name: 'Mark Brake pads inspection done' }));
    expect(callbacks.onComplete).toHaveBeenCalledWith(BRAKE_PADS.id);

    const row = screen.getByTestId(`service-task-${BRAKE_PADS.id}`);
    expect(row.props.accessibilityLabel).toBe(
      'Brake pads inspection. 201 days late. 3,933 km to target. high priority',
    );
    await fireEvent.press(row);
    expect(screen.getByTestId(`service-task-details-${BRAKE_PADS.id}`)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(`service-task-edit-${BRAKE_PADS.id}`));
    expect(callbacks.onEdit).toHaveBeenCalledWith(BRAKE_PADS.id);
    await fireEvent.press(screen.getByTestId(`service-task-delete-${BRAKE_PADS.id}`));
    expect(callbacks.onDelete).toHaveBeenCalledWith(BRAKE_PADS.id, BRAKE_PADS.title);
  });

  it('offers "Mark done" as an accessibility action on the row', async () => {
    const callbacks = await renderSection(ACTIVE);
    const row = screen.getByTestId(`service-task-${AIR_FILTER.id}`);
    expect(row.props.accessibilityActions).toEqual(
      expect.arrayContaining([{ name: 'markDone', label: 'Mark done' }]),
    );
    await act(async () =>
      row.props.onAccessibilityAction({ nativeEvent: { actionName: 'markDone' } }),
    );
    expect(callbacks.onComplete).toHaveBeenCalledWith(AIR_FILTER.id);
  });

  it('expands the task asked for from the Overview, once', async () => {
    await renderSection(ACTIVE, { initialExpandedId: AIR_FILTER.id });
    expect(screen.getByTestId(`service-task-details-${AIR_FILTER.id}`)).toBeOnTheScreen();
  });

  it('an overdue Critical task sits on its own tinted card', async () => {
    const critical = hubTask(
      task({
        id: 'crit',
        title: 'Rear brake shoes',
        priority: MaintenancePriority.Critical,
        dueDate: '2026-08-25',
      }),
    );
    await renderSection([critical, ...ACTIVE]);
    expect(screen.getByText('CRIT')).toBeOnTheScreen();
    expect(screen.getByText('Overdue · 5')).toBeOnTheScreen();
  });

  it('at accessibility text sizes the tag stacks above the title and drops its fixed column', async () => {
    mockDimensions.mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 3.1 });
    await renderSection([hubTask(BRAKE_PADS)]);
    const row = screen.getByTestId(`service-task-${BRAKE_PADS.id}`);
    const style = StyleSheet.flatten(
      typeof row.props.style === 'function' ? row.props.style({ pressed: false }) : row.props.style,
    );
    expect(style.flexDirection).toBe('column');
    const tag = screen.getByText('HIGH').parent?.parent;
    expect(StyleSheet.flatten(tag?.props.style).width).toBeUndefined();
  });
});

describe('Service — History', () => {
  it('a task opened from elsewhere that is already done opens History expanded', async () => {
    const finished = done('oil', '2026-08-25T10:00:00Z', { completedMileage: 38_050 });
    await renderSection([...ACTIVE, finished], { initialExpandedId: 'oil' });
    expect(screen.getByRole('tab', { name: 'History, 1' })).toBeSelected();
    expect(screen.getByText('At 38,050 km')).toBeOnTheScreen();
    expect(screen.getByTestId('service-task-details-oil')).toBeOnTheScreen();
  });

  it('shows the latest five, newest first, and a copper link to all of them', async () => {
    const history = Array.from({ length: 7 }, (_, index) =>
      done(`h${index}`, `2026-0${index + 1}-10T10:00:00Z`, { totalAmount: 10 + index }),
    );
    await renderSection(history);
    await fireEvent.press(screen.getByRole('tab', { name: 'History, 7' }));
    const rows = screen.getAllByTestId(/^service-history-h/);
    expect(rows).toHaveLength(5);
    expect(rows[0]?.props.testID).toBe('service-history-h6');
    await fireEvent.press(screen.getByText('See all 7 completed tasks'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(tabs)/(garage)/bike-tasks',
      params: { motorcycleId: 'bike-a', initialFilter: 'completed' },
    });
  });
});

describe('Service — Active / History switch', () => {
  it('its labels are capped chrome on one line, so "Active · N" never breaks in two', async () => {
    await renderSection(ACTIVE);
    for (const id of ['service-tab-active', 'service-tab-history']) {
      // The outer label ("Active · 3"); its count is a nested mono span.
      const label = within(screen.getByTestId(id)).getByText(/^(Active|History) ·/);
      expect(label.props.maxFontSizeMultiplier).toBe(1.3);
      expect(label.props.numberOfLines).toBe(1);
    }
  });
});

describe('Service — empty', () => {
  it('a bike without tasks says so', async () => {
    await renderSection([]);
    expect(screen.getByText('No maintenance tasks yet')).toBeOnTheScreen();
  });

  it('everything done: no open tasks', async () => {
    await renderSection([done('a', '2026-09-01T10:00:00Z')]);
    expect(screen.getByText('No open tasks')).toBeOnTheScreen();
  });
});
