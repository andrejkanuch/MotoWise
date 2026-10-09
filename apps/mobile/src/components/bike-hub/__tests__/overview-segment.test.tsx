jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
// The reanimated mock lacks the hooks the bike plate uses.
jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  useReducedMotion: () => true,
  // The plate's fill: the state colour its shared value rests on.
  interpolateColor: (value: number, _input: number[], output: string[]) =>
    output[Math.round(value)],
}));
// Jest renders in the light scheme by default; the light-mode block flips this.
let mockColorScheme = 'light';
jest.mock('nativewind', () => ({
  ...jest.requireActual('nativewind'),
  useColorScheme: () => ({ colorScheme: mockColorScheme }),
}));
jest.mock('../../../lib/analytics', () => require('../../../test/mocks').mockAnalytics());
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('../../../stores/auth.store', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ currency: 'EUR', session: { user: { id: 'user-1' } } }),
}));

// The document row's icon renders as a marker, so a test can tell which one it drew.
jest.mock('lucide-react-native', () => {
  const actual = jest.requireActual('lucide-react-native');
  const { Text } = jest.requireActual('react-native');
  const marker = (name: string) => () => <Text testID={`icon-${name}`}>{name}</Text>;
  return { ...actual, Shield: marker('Shield'), FileText: marker('FileText') };
});

const mockFetcher = jest.fn();
jest.mock('../../../lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));

import {
  CreateNoteDocument,
  DocumentCategoriesDocument,
  ExpensesByMotorcycleDocument,
  MaintenancePriority,
  MotorcycleRecallsDocument,
  NotesByMotorcycleDocument,
} from '@motovault/graphql';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import i18n from '../../../i18n';
import { BIKE_SEGMENT, HUB_UNIT, NOTE_SOURCE } from '../../../lib/bike-hub/constants';
import {
  AIR_FILTER,
  BIKE_A,
  BIKE_A_DOCUMENTS,
  BIKE_A_TASKS,
  BIKE_B,
  BRAKE_PADS,
  CATEGORIES,
  ECU_RECALL,
  EXPENSES_2025,
  EXPENSES_2026,
  expenseYear,
  NOTES,
  TODAY,
  task,
} from '../../../test/bike-hub-fixtures';
import { editorialThemes } from '../../../theme/editorial';
import { DRAFT_OUTCOME, publishDraftOutcome } from '../notes/use-draft-handoff';
import { OverviewSegment } from '../overview/overview-segment';
import type { BikeActions } from '../shell/use-bike-actions';
import type { BikeHubData, HubBike, HubTask } from '../shell/use-bike-hub-data';
import type { BikeHubNavigation } from '../shell/use-bike-hub-navigation';
import { HUB_ROW_SUB_LINES, hubDark, hubLight } from '../ui/tokens';

type Documents = BikeHubData['documents'];

interface Scenario {
  bike: typeof BIKE_A;
  tasks: unknown[];
  documents: unknown[];
  recalls: unknown[] | 'error';
  expenses: Record<number, unknown>;
  notes: unknown[];
  tasksLoading?: boolean;
  tasksError?: boolean;
  tasksRefreshFailed?: boolean;
  documentsLoading?: boolean;
  documentsError?: boolean;
}

const BIKE_A_SCENARIO: Scenario = {
  bike: BIKE_A,
  tasks: BIKE_A_TASKS,
  documents: BIKE_A_DOCUMENTS,
  recalls: [ECU_RECALL],
  expenses: { 2026: EXPENSES_2026, 2025: EXPENSES_2025 },
  notes: NOTES,
};

const actions = {
  checkRecalls: jest.fn(),
  importSchedule: jest.fn(),
  isImportingSchedule: false,
} as unknown as BikeActions;
const navigation = {
  openDocument: jest.fn(),
  openNotes: jest.fn(),
  openNoteSheet: jest.fn(),
  logPastWork: jest.fn(),
  addDocument: jest.fn(),
} as unknown as BikeHubNavigation;
const photo = { uploading: false, changePhoto: jest.fn() };
const onShowSegment = jest.fn();
const onOpenTask = jest.fn();
const refetchTasks = jest.fn();
const refetchDocuments = jest.fn();
const clients: QueryClient[] = [];

async function renderOverview(overrides: Partial<Scenario> = {}) {
  const scenario = { ...BIKE_A_SCENARIO, ...overrides };
  const empty = { ytdTotal: 0, categories: [] };
  mockFetcher.mockImplementation((document: unknown, variables: { year?: number }) => {
    if (document === MotorcycleRecallsDocument) {
      return scenario.recalls === 'error'
        ? Promise.reject(new Error('NHTSA down'))
        : Promise.resolve({ motorcycleRecalls: { count: 1, recalls: scenario.recalls } });
    }
    if (document === DocumentCategoriesDocument) {
      return Promise.resolve({ documentCategories: CATEGORIES });
    }
    if (document === ExpensesByMotorcycleDocument) {
      return Promise.resolve({ expenses: scenario.expenses[variables.year ?? 0] ?? empty });
    }
    if (document === NotesByMotorcycleDocument) return Promise.resolve({ notes: scenario.notes });
    if (document === CreateNoteDocument) {
      return Promise.resolve({ createNote: { ...NOTES[0], id: 'note-new' } });
    }
    return Promise.resolve(undefined);
  });
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryDelay: 0, gcTime: 0 },
      mutations: { gcTime: 0 },
    },
  });
  clients.push(client);
  const shell = {
    tasks: scenario.tasks as HubTask[],
    tasksLoading: scenario.tasksLoading ?? false,
    tasksError: scenario.tasksError ?? false,
    refetchTasks,
    tasksRefreshFailed: scenario.tasksRefreshFailed ?? false,
    documents: scenario.documents as Documents,
    documentsLoading: scenario.documentsLoading ?? false,
    documentsError: scenario.documentsError ?? false,
    refetchDocuments,
    ridesCount: 9,
  } as unknown as BikeHubData;
  await render(
    <QueryClientProvider client={client}>
      <OverviewSegment
        bike={scenario.bike as unknown as HubBike}
        unit={HUB_UNIT.KM}
        shell={shell}
        actions={actions}
        navigation={navigation}
        photo={photo}
        onShowSegment={onShowSegment}
        onOpenTask={onOpenTask}
        now={TODAY}
      />
    </QueryClientProvider>,
  );
  // Let the Overview's own queries settle so no update lands outside act().
  await waitFor(() => expect(client.isFetching()).toBe(0));
  // …and one more tick for the query observers' batched notification to render.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => jest.clearAllMocks());
afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
});

describe('Overview — bike A', () => {
  it('ride status: the overdue plate (as on Home) with its three reasons below', async () => {
    await renderOverview();
    // An overdue high task makes the plate red, like Home and Garage — not the
    // ride status's milder "Check before riding".
    const status = within(await screen.findByTestId('ride-status-check'));
    expect(status.getByText(/, past due$/)).toBeOnTheScreen();
    expect(screen.queryByText('Check before riding')).toBeNull();
    expect(
      await screen.findByText('1 open recall · 1 overdue high task · insurance expires in 12 days'),
    ).toBeOnTheScreen();
  });

  it('needs attention: 6 rows, counted as 4 overdue (the badge basis); recall → Brake pads → Insurance, then the overflow row', async () => {
    await renderOverview();
    expect(await screen.findByText('Needs attention · 4 overdue')).toBeOnTheScreen();
    const list = within(screen.getByTestId('attention-list'));
    expect(list.getByText('Open safety recall · ECU')).toBeOnTheScreen();
    expect(list.getByText('Free dealer fix')).toBeOnTheScreen();
    expect(list.getByText('SAFETY')).toBeOnTheScreen();
    expect(list.getByText('Brake pads inspection')).toBeOnTheScreen();
    expect(list.getByText('201 days late · 3,933 km to target')).toBeOnTheScreen();
    expect(list.getByText('Insurance expires Oct 14')).toBeOnTheScreen();
    expect(
      list.getByText('In 12 days · Mapfre · renew or upload the new policy'),
    ).toBeOnTheScreen();
    expect(list.getByText('DOC')).toBeOnTheScreen();
    expect(list.getByText('3 more overdue, medium and low')).toBeOnTheScreen();
    expect(list.getByText('Coolant · Tire pressure · Chain clean & lube')).toBeOnTheScreen();

    const order = list
      .getAllByTestId(/^attention-(recall|task|document|overflow)/)
      .map((row) => row.props.testID);
    expect(order).toEqual([
      'attention-recall',
      `attention-task-${BRAKE_PADS.id}`,
      'attention-document-doc-insurance',
      'attention-overflow',
    ]);
  });

  it('the insurance row (riding-blocking, seeded) says what to do, with no icon tile', async () => {
    await renderOverview();
    const row = within(await screen.findByTestId('attention-document-doc-insurance'));
    expect(row.getByText(/renew or upload the new policy/)).toBeOnTheScreen();
    expect(row.queryByTestId('icon-Shield')).toBeNull();
    expect(row.queryByTestId('icon-FileText')).toBeNull();
  });

  it('a custom category named "Insurance" is not riding-blocking: no action hint', async () => {
    await renderOverview({
      documents: [{ ...BIKE_A_DOCUMENTS[0], id: 'doc-custom', categoryId: 'cat-custom-insurance' }],
    });
    const row = within(await screen.findByTestId('attention-document-doc-custom'));
    expect(row.getByText('In 12 days · Mapfre')).toBeOnTheScreen();
  });

  it('two recalls: NHTSA components read as sentence-case parts, not raw uppercase', async () => {
    await renderOverview({
      recalls: [
        ECU_RECALL,
        {
          ...ECU_RECALL,
          campaignNumber: '25V-001',
          component: 'FUEL SYSTEM, GASOLINE:DELIVERY:FUEL PUMP',
        },
      ],
    });
    const row = within(await screen.findByTestId('attention-recall'));
    expect(row.getByText('2 open safety recalls')).toBeOnTheScreen();
    expect(row.getByText('Free dealer fix · ECU · Fuel pump')).toBeOnTheScreen();
    expect(row.queryByText(/FUEL SYSTEM/)).toBeNull();
  });

  it('two recalls: the row names the components to VoiceOver too, not only "Free dealer fix"', async () => {
    await renderOverview({
      recalls: [
        ECU_RECALL,
        {
          ...ECU_RECALL,
          campaignNumber: '25V-001',
          component: 'FUEL SYSTEM, GASOLINE:DELIVERY:FUEL PUMP',
        },
      ],
    });
    expect(await screen.findByTestId('attention-recall')).toHaveProp(
      'accessibilityLabel',
      '2 open safety recalls. Free dealer fix. ECU, Fuel pump',
    );
  });

  it('attention sub-lines wrap to two lines like the design, so a long one is not cut at one', async () => {
    await renderOverview();
    const list = within(await screen.findByTestId('attention-list'));
    for (const text of [
      'Free dealer fix',
      '201 days late · 3,933 km to target',
      'In 12 days · Mapfre · renew or upload the new policy',
      'Coolant · Tire pressure · Chain clean & lube',
    ]) {
      // The line cap sits on the outer Text; a lone lead part is a nested one.
      let line = list.getByText(text);
      while (line.props.numberOfLines === undefined && line.parent) line = line.parent;
      expect(line.props.numberOfLines).toBe(HUB_ROW_SUB_LINES);
    }
    expect(HUB_ROW_SUB_LINES).toBe(2);
  });

  it('next up: Air filter, "In 2 days · or in 8,733 km"', async () => {
    await renderOverview();
    const nextUp = within(await screen.findByTestId('next-up'));
    expect(nextUp.getByText('Air filter')).toBeOnTheScreen();
    expect(nextUp.getByText('In 2 days · or in 8,733 km')).toBeOnTheScreen();
    expect(nextUp.getByText('MED')).toBeOnTheScreen();
  });

  it('costs: €1,960.62, ▲ 12% vs same period of 2025, €0.00, €218, Insurance 25%', async () => {
    await renderOverview();
    const costs = within(await screen.findByTestId('costs-card'));
    expect(costs.getByText('Costs · 2026')).toBeOnTheScreen();
    expect(costs.getByText('€1,960.62')).toBeOnTheScreen();
    expect(costs.getByText('▲ 12% vs same period of 2025')).toBeOnTheScreen();
    expect(costs.getByText('€0.00')).toBeOnTheScreen();
    expect(costs.getByText('€218')).toBeOnTheScreen();
    expect(costs.getByText('Insurance 25%')).toBeOnTheScreen();
    expect(costs.getByLabelText('Fuel 20%')).toBeOnTheScreen();
    expect(costs.getByLabelText('Other 18%')).toBeOnTheScreen();
  });

  it('costs: never adds currencies — EUR figures, USD listed beside the total', async () => {
    await renderOverview({
      expenses: {
        2026: expenseYear({
          fuel: [
            ['2026-10-01', 40, 'EUR'],
            ['2026-09-01', 60, 'EUR'],
          ],
          parts: [['2026-10-01', 500, 'USD']],
        }),
      },
    });
    const costs = within(await screen.findByTestId('costs-card'));
    expect(costs.getByText('€100.00 · $500.00')).toBeOnTheScreen();
    expect(costs.getByText('€40.00')).toBeOnTheScreen();
    expect(costs.getByText('Fuel 100%')).toBeOnTheScreen();
  });

  it('notes: "Notes · 5" with the two newest', async () => {
    await renderOverview();
    const notes = within(screen.getByTestId('notes-block'));
    expect(await notes.findByText('Notes · 5')).toBeOnTheScreen();
    expect(notes.getByText(/^Rear preload felt soft/)).toBeOnTheScreen();
    expect(notes.getByText('Sep 28 · 38,100 km')).toBeOnTheScreen();
    expect(notes.getByText(/^Pattex Nural 50/)).toBeOnTheScreen();
    expect(notes.queryByText(/^Front tyre pressure/)).toBeNull();
  });

  it('papers & bike: the most urgent document signal and the bike facts', async () => {
    await renderOverview();
    const rows = within(screen.getByTestId('papers-bike-rows'));
    expect(await rows.findByText('Insurance expires in 12 days · 4 stored')).toBeOnTheScreen();
    expect(rows.getByText('2022 Honda Africa Twin')).toBeOnTheScreen();
    expect(rows.getByText('DCT · bought June 2022 · €11,800')).toBeOnTheScreen();
  });

  it('is ordered photo → status → attention → next up → costs → notes → papers', async () => {
    await renderOverview();
    await screen.findByText('Needs attention · 4 overdue');
    expect(screen.getAllByTestId(/^overview-block-/).map((block) => block.props.testID)).toEqual([
      'overview-block-photo',
      'overview-block-status',
      'overview-block-attention',
      'overview-block-next-up',
      'overview-block-costs',
      'overview-block-notes',
      'overview-block-papers',
    ]);
  });
});

describe('Overview — destinations (D3)', () => {
  it('the recall row and the status card open today’s recalls screen', async () => {
    await renderOverview();
    await fireEvent.press(await screen.findByTestId('attention-recall'));
    await fireEvent.press(screen.getByTestId('ride-status-check'));
    expect(actions.checkRecalls).toHaveBeenCalledTimes(2);
  });

  it('a task row and Next up open Service with the task; a document row opens the document', async () => {
    await renderOverview();
    await fireEvent.press(await screen.findByTestId(`attention-task-${BRAKE_PADS.id}`));
    expect(onOpenTask).toHaveBeenLastCalledWith(BRAKE_PADS.id);
    await fireEvent.press(screen.getByTestId(`next-up-${AIR_FILTER.id}`));
    expect(onOpenTask).toHaveBeenLastCalledWith(AIR_FILTER.id);
    await fireEvent.press(screen.getByTestId('attention-document-doc-insurance'));
    expect(navigation.openDocument).toHaveBeenCalledWith('doc-insurance');
  });

  it('"All", the overflow row, the costs card and the papers rows switch segment', async () => {
    await renderOverview();
    await fireEvent.press(await screen.findByTestId('attention-overflow'));
    expect(onShowSegment).toHaveBeenLastCalledWith(BIKE_SEGMENT.SERVICE);
    await fireEvent.press(screen.getByRole('button', { name: 'Full analytics' }));
    expect(onShowSegment).toHaveBeenLastCalledWith(BIKE_SEGMENT.COSTS);
    await fireEvent.press(screen.getByTestId('papers-documents-row'));
    expect(onShowSegment).toHaveBeenLastCalledWith(BIKE_SEGMENT.BIKE);
    await fireEvent.press(screen.getByTestId('photo-band'));
    expect(onShowSegment).toHaveBeenLastCalledWith(BIKE_SEGMENT.BIKE);
  });
});

describe('Overview — quick note', () => {
  it('sends the trimmed text with the bike odometer, then clears the field', async () => {
    await renderOverview();
    const input = screen.getByTestId('quick-note-input');
    await fireEvent.changeText(input, '  Check chain slack  ');
    await fireEvent(input, 'submitEditing');
    await waitFor(() =>
      expect(mockFetcher).toHaveBeenCalledWith(CreateNoteDocument, {
        input: {
          motorcycleId: BIKE_A.id,
          text: 'Check chain slack',
          odometer: 38_167,
          alsoCreateTask: false,
        },
      }),
    );
    expect(input.props.value).toBe('');
    const { trackEvent } = jest.requireMock('../../../lib/analytics') as { trackEvent: jest.Mock };
    await waitFor(() =>
      expect(trackEvent).toHaveBeenCalledWith('NOTE_CREATED', {
        motorcycle_id: BIKE_A.id,
        source: NOTE_SOURCE.OVERVIEW_QUICK,
        has_photo: false,
        also_task: false,
      }),
    );
  });

  it('an unset odometer (0) leaves the quick note unstamped', async () => {
    await renderOverview({ bike: { ...BIKE_A, currentMileage: 0 } });
    const input = screen.getByTestId('quick-note-input');
    await fireEvent.changeText(input, 'No stamp');
    await fireEvent(input, 'submitEditing');
    await waitFor(() =>
      expect(mockFetcher).toHaveBeenCalledWith(CreateNoteDocument, {
        input: {
          motorcycleId: BIKE_A.id,
          text: 'No stamp',
          odometer: undefined,
          alsoCreateTask: false,
        },
      }),
    );
  });

  it('caps the quick note at the note length limit', async () => {
    await renderOverview();
    expect(screen.getByTestId('quick-note-input').props.maxLength).toBe(4000);
  });

  it('does nothing for whitespace-only input', async () => {
    await renderOverview();
    const input = screen.getByTestId('quick-note-input');
    await fireEvent.changeText(input, '   ');
    await fireEvent(input, 'submitEditing');
    expect(mockFetcher).not.toHaveBeenCalledWith(CreateNoteDocument, expect.anything());
  });

  it('the quiet expand button opens the sheet with the draft and keeps it in the field', async () => {
    await renderOverview();
    await fireEvent.changeText(screen.getByTestId('quick-note-input'), 'Longer thought');
    await fireEvent.press(screen.getByRole('button', { name: 'Write a longer note' }));
    expect(navigation.openNoteSheet).toHaveBeenCalledWith('Longer thought');
    // Closing the sheet without saving loses nothing.
    expect(screen.getByTestId('quick-note-input').props.value).toBe('Longer thought');
  });

  it('a cancelled hand-off keeps the draft when an unrelated note is saved later', async () => {
    await renderOverview();
    await fireEvent.changeText(screen.getByTestId('quick-note-input'), 'check chain');
    await fireEvent.press(screen.getByRole('button', { name: 'Write a longer note' }));
    // The sheet is cancelled, then "bought oil" is saved via Log → Note.
    await act(async () => publishDraftOutcome('check chain', DRAFT_OUTCOME.DISCARDED));
    await act(async () => publishDraftOutcome('bought oil', DRAFT_OUTCOME.SAVED));
    expect(screen.getByTestId('quick-note-input').props.value).toBe('check chain');
  });

  it('the sheet saving the handed-off draft (to any bike) clears the field', async () => {
    await renderOverview();
    await fireEvent.changeText(screen.getByTestId('quick-note-input'), 'check chain');
    await fireEvent.press(screen.getByRole('button', { name: 'Write a longer note' }));
    await act(async () => publishDraftOutcome('check chain', DRAFT_OUTCOME.SAVED));
    expect(screen.getByTestId('quick-note-input').props.value).toBe('');
  });

  it('copper Add saves the text now; with an empty field it is disabled', async () => {
    await renderOverview();
    const add = () => screen.getByRole('button', { name: 'Save note' });
    expect(add().props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
    await fireEvent.changeText(screen.getByTestId('quick-note-input'), 'Chain at 30 mm');
    await fireEvent.press(add());
    await waitFor(() =>
      expect(mockFetcher).toHaveBeenCalledWith(
        CreateNoteDocument,
        expect.objectContaining({ input: expect.objectContaining({ text: 'Chain at 30 mm' }) }),
      ),
    );
    expect(navigation.openNoteSheet).not.toHaveBeenCalled();
  });
});

describe('Overview — status variants', () => {
  const quiet = { documents: [], recalls: [], notes: [], expenses: {} };

  it('NOT_READY: an overdue critical task', async () => {
    const critical = task({
      id: 'crit',
      title: 'Rear brake shoes',
      priority: MaintenancePriority.Critical,
      dueDate: '2026-08-25',
    });
    await renderOverview({ ...quiet, tasks: [critical], bike: { ...BIKE_A, recallCount: 0 } });
    expect(await screen.findByText('Rear brake shoes, past due')).toBeOnTheScreen();
    expect(screen.getByText('1 overdue critical task')).toBeOnTheScreen();
    expect(screen.getByText('Needs attention · 1 overdue')).toBeOnTheScreen();
    expect(screen.queryByTestId('attention-overflow')).toBeNull();
    // The verdict itself: a red (overdue) plate that says so to VoiceOver.
    const plate = screen.getByTestId('ride-status-not_ready');
    expect(plate.props.accessibilityLabel).toMatch(/^Overdue\. /);
    expect(plateFill('Rear brake shoes, past due')).toBe(editorialThemes.light.plateOverdue);
  });

  it('READY: nothing needs attention, so the block is hidden and the card is not a button', async () => {
    const later = task({ id: 'later', title: 'Valves', dueDate: '2027-06-01' });
    await renderOverview({ ...quiet, tasks: [later], bike: { ...BIKE_A, recallCount: 0 } });
    // A ready plate counts down to the next task, as on Home.
    expect(await screen.findByText('to Valves')).toBeOnTheScreen();
    expect(screen.queryByTestId('attention-list')).toBeNull();
    // No empty wrapper either: the status card is followed directly by Next up,
    // so only the list's one 12 pt gap separates them.
    expect(screen.queryByTestId('overview-block-attention')).toBeNull();
    expect(screen.getAllByTestId(/^overview-block-/).map((block) => block.props.testID)).toEqual([
      'overview-block-photo',
      'overview-block-status',
      'overview-block-next-up',
      'overview-block-costs',
      'overview-block-notes',
      'overview-block-papers',
    ]);
    expect(screen.getByTestId('ride-status-ready').props.accessibilityRole).toBeUndefined();
  });

  it('UNTRACKED (bike B): setup list instead of attention, costs zero with the purchase price', async () => {
    await renderOverview({ ...quiet, tasks: [], bike: BIKE_B as unknown as typeof BIKE_A });
    expect(await screen.findByText('Nothing tracked yet')).toBeOnTheScreen();
    // Recalls loaded and empty: the design's full sub-line.
    expect(
      screen.getByText('No open recalls. Ride status appears once a task or a document exists.'),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('attention-list')).toBeNull();
    expect(screen.getByText('Set this bike up')).toBeOnTheScreen();
    expect(screen.getByText('Import the Yamaha service schedule')).toBeOnTheScreen();
    expect(screen.getByTestId('photo-band-empty')).toBeOnTheScreen();
    const costs = within(await screen.findByTestId('costs-empty'));
    expect(costs.getByText('€0.00')).toBeOnTheScreen();
    expect(
      costs.getByText(
        'Purchase price €10,400 recorded. Log fuel or a receipt to start the running total.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getAllByTestId(/^overview-block-/).map((block) => block.props.testID)).toEqual([
      'overview-block-photo',
      'overview-block-status',
      'overview-block-setup',
      'overview-block-costs',
      'overview-block-notes',
      'overview-block-papers',
    ]);

    await fireEvent.press(screen.getByTestId('setup-import'));
    expect(actions.importSchedule).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId('setup-log-work'));
    expect(navigation.logPastWork).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId('setup-documents'));
    expect(navigation.addDocument).toHaveBeenCalledTimes(1);
  });

  it('UNTRACKED sub-line is one translated string, not two sentences joined with a space (ja)', async () => {
    await act(async () => {
      await i18n.changeLanguage('ja');
    });
    try {
      await renderOverview({ ...quiet, tasks: [], bike: BIKE_B as unknown as typeof BIKE_A });
      expect(await screen.findByText(i18n.t('bikeHub.rideStatus.untracked'))).toBeOnTheScreen();
      expect(
        screen.getByText(
          '未対応のリコールはありません。タスクか書類を追加すると走行ステータスが表示されます。',
        ),
      ).toBeOnTheScreen();
    } finally {
      await act(async () => {
        await i18n.changeLanguage('en');
      });
    }
  });

  it('recalls unknown (query failed, count 0): no "No open recalls." claim', async () => {
    await renderOverview({
      ...quiet,
      tasks: [],
      recalls: 'error',
      bike: { ...BIKE_B, recallCount: 0 } as unknown as typeof BIKE_A,
    });
    expect(await screen.findByText('Nothing tracked yet')).toBeOnTheScreen();
    expect(
      screen.getByText('Ride status appears once a task or a document exists.'),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/No open recalls/)).toBeNull();
  });

  it('a failed recalls query still yields a status, from the bike’s recall count', async () => {
    await renderOverview({ ...quiet, tasks: [], recalls: 'error' });
    // No task is due, so the recall escalates the plate and names itself on it.
    expect(await screen.findByText('Check before riding · 1 open recall')).toBeOnTheScreen();
    expect(screen.getByText('Open safety recall')).toBeOnTheScreen();
  });

  it('tasks loading shows skeleton rows instead of a status jump', async () => {
    await renderOverview({ ...quiet, tasks: [], tasksLoading: true });
    expect(screen.getByTestId('attention-loading')).toBeOnTheScreen();
    expect(screen.queryByTestId('setup-list')).toBeNull();
  });

  it('a tasks error degrades the status and attention blocks only; costs still render', async () => {
    await renderOverview({ tasks: [], tasksError: true });
    expect(screen.getByText("Couldn't load tasks")).toBeOnTheScreen();
    expect(screen.getByTestId('ride-status-error')).toBeOnTheScreen();
    expect(await screen.findByTestId('costs-card')).toBeOnTheScreen();
  });

  // M1: the status is computed from tasks AND documents. Without both loaded
  // there is no verdict — never "Ready to ride" / "Nothing tracked yet".
  it('cold cache: while tasks load there is no verdict, even though the list is still empty', async () => {
    await renderOverview({ ...quiet, tasks: [], tasksLoading: true });
    expect(screen.getByTestId('ride-status-loading')).toBeOnTheScreen();
    expect(screen.queryByText('Ready to ride')).toBeNull();
    expect(screen.queryByText('Nothing tracked yet')).toBeNull();
    expect(screen.queryByTestId('setup-list')).toBeNull();
  });

  it('while documents load there is no verdict either', async () => {
    await renderOverview({ ...quiet, tasks: [], documentsLoading: true });
    expect(screen.getByTestId('ride-status-loading')).toBeOnTheScreen();
    expect(screen.queryByText('Nothing tracked yet')).toBeNull();
    expect(screen.queryByTestId('setup-list')).toBeNull();
  });

  it('tasks failed on a bike with no documents: an error with Retry, not "Nothing tracked yet"', async () => {
    await renderOverview({
      ...quiet,
      tasks: [],
      tasksError: true,
      bike: { ...BIKE_A, recallCount: 0 },
    });
    expect(screen.getByText("Couldn't load the ride status")).toBeOnTheScreen();
    expect(screen.queryByText('Nothing tracked yet')).toBeNull();
    expect(screen.queryByText('Ready to ride')).toBeNull();
    expect(screen.queryByTestId('setup-list')).toBeNull();
    await fireEvent.press(screen.getByTestId('ride-status-retry'));
    expect(refetchTasks).toHaveBeenCalledTimes(1);
    expect(refetchDocuments).not.toHaveBeenCalled();
  });

  it('documents failed: an error with Retry that refetches the documents', async () => {
    await renderOverview({ ...quiet, tasks: [], documentsError: true });
    expect(screen.getByTestId('ride-status-error')).toBeOnTheScreen();
    expect(screen.queryByTestId('setup-list')).toBeNull();
    await fireEvent.press(screen.getByTestId('ride-status-retry'));
    expect(refetchDocuments).toHaveBeenCalledTimes(1);
  });

  it('a failed refetch over cached tasks keeps the rows and says "Couldn\'t refresh · Retry"', async () => {
    await renderOverview({ tasksRefreshFailed: true });
    expect(await screen.findByText('Needs attention · 4 overdue')).toBeOnTheScreen();
    const line = within(screen.getByTestId('attention-refresh-failed'));
    expect(line.getByText(/^Couldn't refresh/)).toBeOnTheScreen();
    await fireEvent.press(line.getByRole('button', { name: 'Retry needs attention' }));
    expect(refetchTasks).toHaveBeenCalledTimes(1);
    // The status is still a verdict from the cached data, not an error.
    expect(
      within(screen.getByTestId('ride-status-check')).getByText(/, past due$/),
    ).toBeOnTheScreen();
  });

  it('shows no refresh line when nothing failed', async () => {
    await renderOverview();
    await screen.findByText('Needs attention · 4 overdue');
    expect(screen.queryByText(/^Couldn't refresh/)).toBeNull();
  });

  it('a failed refetch over cached costs and notes keeps both and offers Retry in each block', async () => {
    await renderOverview();
    await screen.findByTestId('costs-card');
    // The next refetch of everything fails; the cached data stays.
    mockFetcher.mockImplementation(() => Promise.reject(new Error('offline')));
    const client = clients[clients.length - 1];
    await act(async () => {
      await client?.refetchQueries();
    });
    // The error state can land a tick after refetchQueries settles on a slow runner.
    expect(await screen.findByTestId('costs-refresh-failed')).toBeOnTheScreen();
    expect(await screen.findByTestId('notes-refresh-failed')).toBeOnTheScreen();
    expect(screen.getByText('€1,960.62')).toBeOnTheScreen();
    expect(screen.getByText('Notes · 5')).toBeOnTheScreen();
    expect(screen.queryByText("Couldn't load costs")).toBeNull();
    // Each block's Retry is told apart by a screen reader.
    expect(screen.getByRole('button', { name: 'Retry costs' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Retry notes' })).toBeOnTheScreen();
  });

  it('no expenses last year: no YoY line', async () => {
    await renderOverview({ expenses: { 2026: EXPENSES_2026 } });
    await screen.findByTestId('costs-card');
    expect(screen.queryByTestId('costs-yoy')).toBeNull();
  });
});

/** The plate panel behind a caption (caption → plate panel). */
function plateStyle(caption: string) {
  return StyleSheet.flatten(screen.getByText(caption).parent?.props.style);
}
function plateFill(caption: string) {
  return plateStyle(caption).backgroundColor;
}

describe('Overview — colour schemes', () => {
  afterEach(() => {
    mockColorScheme = 'light';
  });

  it.each([
    ['dark', hubDark, editorialThemes.dark, 0],
    ['light', hubLight, editorialThemes.light, 2],
  ] as const)('%s: plate, attention card and tags use that scheme’s tokens', async (scheme, hub, theme, keyline) => {
    mockColorScheme = scheme;
    await renderOverview();
    const caption = await screen.findByText(/, past due$/);
    const plate = StyleSheet.flatten(caption.parent?.props.style);
    expect(plate.backgroundColor).toBe(theme.plateOverdue);
    // A light ground gives the plate its printed keyline.
    expect(plate.borderWidth).toBe(keyline);

    const list = screen.getByTestId('attention-list');
    const card = within(list).getByTestId('attention-recall').parent;
    expect(StyleSheet.flatten(card?.props.style).backgroundColor).toBe(hub.card);

    const tag = within(list).getAllByText('HIGH')[0];
    expect(StyleSheet.flatten(tag?.props.style).color).toBe(hub.soon);
    expect(StyleSheet.flatten(tag?.parent?.props.style).backgroundColor).toBe(hub.tagHighBg);
  });

  it('light: nothing tracked is a plain light card, not a dark one', async () => {
    mockColorScheme = 'light';
    await renderOverview({
      documents: [],
      recalls: [],
      notes: [],
      expenses: {},
      tasks: [],
      bike: BIKE_B as unknown as typeof BIKE_A,
    });
    const card = await screen.findByTestId('ride-status-untracked');
    expect(StyleSheet.flatten(card.props.style).backgroundColor).toBe(hubLight.card);
  });
});
