import 'react-native-gesture-handler/jestSetup';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 54, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('react-native-keyboard-controller', () =>
  require('react-native-keyboard-controller/jest'),
);
jest.mock('react-native-mmkv', () => require('../../../test/mocks').makeMmkvMock());
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

const mockRouter = {
  push: jest.fn(),
  back: jest.fn(),
  navigate: jest.fn(),
  replace: jest.fn(),
  canGoBack: jest.fn(() => true),
};
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useFocusEffect: (effect: () => undefined | (() => void)) => {
    const { useEffect } = require('react');
    useEffect(effect, [effect]);
  },
}));

const mockFetcher = jest.fn();
jest.mock('../../../lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));

import {
  CreateNoteDocument,
  CreateTaskFromNoteDocument,
  DeleteNoteDocument,
  MaintenanceTaskStatus,
  MaintenanceTasksByMotorcycleDocument,
  NotesByMotorcycleDocument,
} from '@motovault/graphql';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import '../../../i18n';
import { NOTE_SOURCE, NOTES_SEARCH_DEBOUNCE_MS } from '../../../lib/bike-hub/constants';
import { queryKeys } from '../../../lib/query-keys';
import { useBikeHubStore } from '../../../stores/bike-hub.store';
import { usePendingDeleteStore } from '../../../stores/pending-delete.store';
import { BIKE_A, NOTES } from '../../../test/bike-hub-fixtures';
import { NotesScreen } from '../notes/notes-screen';
import type { HubBike } from '../shell/use-bike-hub-data';

const clients: QueryClient[] = [];

const PHOTO_NOTE = {
  ...NOTES[2],
  id: 'note-photos',
  photos: [
    { id: 'photo-a', storagePath: 'u/a.jpg', publicUrl: 'https://cdn/a.jpg' },
    { id: 'photo-b', storagePath: 'u/b.jpg', publicUrl: 'https://cdn/b.jpg' },
  ],
};

async function renderNotes(
  options: {
    notes?: unknown[];
    from?: string;
    fail?: boolean;
    taskStatus?: MaintenanceTaskStatus;
    bike?: Partial<HubBike>;
  } = {},
) {
  mockFetcher.mockImplementation((document: unknown) => {
    if (document === NotesByMotorcycleDocument) {
      return options.fail
        ? Promise.reject(new Error('offline'))
        : Promise.resolve({ notes: options.notes ?? NOTES });
    }
    if (document === MaintenanceTasksByMotorcycleDocument) {
      return Promise.resolve({
        maintenanceTasks: [
          { id: 'task-service', status: options.taskStatus ?? MaintenanceTaskStatus.Pending },
        ],
      });
    }
    if (document === CreateNoteDocument) {
      return Promise.resolve({
        createNote: { ...NOTES[3], id: 'note-new', text: 'New from composer' },
      });
    }
    if (document === CreateTaskFromNoteDocument) {
      return Promise.resolve({
        createTaskFromNote: {
          ...NOTES[0],
          linkedTaskId: 'task-new',
          linkedTaskTitle: 'Rear preload felt soft two-up on the Pyrenees run',
        },
      });
    }
    if (document === DeleteNoteDocument) return Promise.resolve({ deleteNote: true });
    return Promise.resolve(undefined);
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { gcTime: 0 } },
  });
  clients.push(client);
  const view = await render(
    <QueryClientProvider client={client}>
      <NotesScreen
        bike={{ ...(BIKE_A as unknown as HubBike), ...options.bike }}
        from={options.from}
      />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(client.isFetching()).toBe(0));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return view;
}

const settle = (ms: number) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });

beforeEach(() => {
  jest.clearAllMocks();
  usePendingDeleteStore.setState({ hiddenIds: {} });
  useBikeHubStore.setState({ pendingTask: null });
  mockRouter.canGoBack.mockReturnValue(true);
});
afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
});

describe('NotesScreen', () => {
  it('lists the five notes newest first with the count and title', async () => {
    await renderNotes();
    expect(screen.getByText('5 notes')).toBeOnTheScreen();
    expect(screen.getByText('Notes · Africa Twin')).toBeOnTheScreen();
    expect(screen.getAllByTestId(/^note-row-/).map((row) => row.props.testID)).toEqual(
      NOTES.map((note) => `note-row-${note.id}`),
    );
    // The meta line is drawn for sight and read as part of the row's label.
    expect(screen.getByText('Jul 20', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(
      screen.getByText('Jul 16 · 37,300 km', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('note-row-note-5').props.accessibilityLabel).toBe(
      'Dealer (Motos Ebro) said the clutch lever free play should be 10–20 mm. Jul 16 · 37,300 km.',
    );
  });

  it('shows the three link variants', async () => {
    await renderNotes();
    expect(screen.getByTestId('note-link-note-1')).toHaveTextContent('Make it a task');
    expect(screen.getByTestId('note-link-note-2')).toHaveTextContent('Linked expense · €29.73');
    expect(screen.getByTestId('note-link-note-5')).toHaveTextContent('Task · open');
  });

  it('a linked task link says where the task stands, and names the task to a screen reader', async () => {
    await renderNotes({ taskStatus: MaintenanceTaskStatus.Completed });
    const link = screen.getByTestId('note-link-note-5');
    expect(link).toHaveTextContent('Task · done');
    expect(link.props.accessibilityLabel).toBe('Linked task “2nd scheduled service”, done');
  });

  it('a linked task goes BACK to the hub beneath and asks it for the task — no second hub', async () => {
    await renderNotes();
    await fireEvent.press(screen.getByTestId('note-link-note-5'));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.navigate).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(useBikeHubStore.getState().pendingTask).toEqual({
      bikeId: BIKE_A.id,
      taskId: 'task-service',
    });
  });

  it('without a screen beneath, a linked task opens the bike on Service with that task', async () => {
    mockRouter.canGoBack.mockReturnValue(false);
    await renderNotes();
    await fireEvent.press(screen.getByTestId('note-link-note-5'));
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: '/(tabs)/(garage)/bike/[id]',
      params: { id: BIKE_A.id, segment: 'service', highlightTask: 'task-service' },
    });
  });

  it('a linked expense opens its detail', async () => {
    await renderNotes();
    await fireEvent.press(screen.getByTestId('note-link-note-2'));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/(tabs)/(garage)/expense-detail',
      params: { expenseId: 'expense-1', motorcycleId: BIKE_A.id },
    });
  });

  it('a note whose linked task is gone (id, no title) offers "Make it a task" again', async () => {
    const orphan = { ...NOTES[4], linkedTaskTitle: null };
    await renderNotes({ notes: [orphan] });
    expect(screen.getByTestId('note-link-note-5')).toHaveTextContent('Make it a task');
  });

  it('an optimistic row (not saved yet) has no link and no edit / delete actions', async () => {
    const optimistic = { ...NOTES[3], id: 'optimistic-2026' };
    await renderNotes({ notes: [optimistic, NOTES[0]] });
    const row = screen.getByTestId('note-row-optimistic-2026');
    expect(row.props.accessibilityActions).toEqual([]);
    expect(screen.queryByTestId('note-link-optimistic-2026')).toBeNull();
    await fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: 'delete' } });
    expect(screen.queryByText('Note deleted')).toBeNull();
    // A saved row keeps them.
    expect(
      screen
        .getByTestId('note-row-note-1')
        .props.accessibilityActions.map((a: { name: string }) => a.name),
    ).toEqual(['activate', 'edit', 'delete']);
  });

  it('the search field uses the design placeholder', async () => {
    await renderNotes();
    expect(screen.getByTestId('notes-search').props.placeholder).toBe(
      'Search part numbers, pressures, shops…',
    );
  });

  it('the composer caps a note at the length limit', async () => {
    await renderNotes();
    expect(screen.getByTestId('notes-composer-input').props.maxLength).toBe(4000);
  });

  it('"Make it a task" creates the task and the link then points at it', async () => {
    await renderNotes();
    await fireEvent.press(screen.getByTestId('note-link-note-1'));
    await waitFor(() =>
      expect(mockFetcher).toHaveBeenCalledWith(CreateTaskFromNoteDocument, { noteId: 'note-1' }),
    );
    // The new task is not in the (mocked) task list: the link stays generic
    // rather than repeating the note's own words.
    await waitFor(() =>
      expect(screen.getByTestId('note-link-note-1')).toHaveTextContent('Linked task'),
    );
  });

  it('search "2.5 bar" leaves one note; an unmatched query says so', async () => {
    await renderNotes();
    await fireEvent.changeText(screen.getByTestId('notes-search'), '2.5 bar');
    await settle(NOTES_SEARCH_DEBOUNCE_MS + 50);
    expect(screen.getAllByTestId(/^note-row-/)).toHaveLength(1);
    expect(screen.getByTestId('note-row-note-3')).toBeOnTheScreen();

    expect(screen.getByTestId('notes-match-count')).toHaveTextContent('1 matching note');

    await fireEvent.changeText(screen.getByTestId('notes-search'), 'carburettor');
    await settle(NOTES_SEARCH_DEBOUNCE_MS + 50);
    expect(screen.getByText('No notes match “carburettor”')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByTestId('notes-search').props.value).toBe('');
    expect(screen.getAllByTestId(/^note-row-/)).toHaveLength(NOTES.length);
  });

  it('composer Add with text creates the note from the composer', async () => {
    await renderNotes();
    await fireEvent.changeText(screen.getByTestId('notes-composer-input'), ' New from composer ');
    await fireEvent.press(screen.getByTestId('notes-composer-add'));
    await waitFor(() =>
      expect(mockFetcher).toHaveBeenCalledWith(CreateNoteDocument, {
        input: {
          motorcycleId: BIKE_A.id,
          text: 'New from composer',
          odometer: 38_167,
          alsoCreateTask: false,
        },
      }),
    );
    const { trackEvent } = jest.requireMock('../../../lib/analytics') as { trackEvent: jest.Mock };
    await waitFor(() =>
      expect(trackEvent).toHaveBeenCalledWith(
        'NOTE_CREATED',
        expect.objectContaining({ source: NOTE_SOURCE.NOTES_COMPOSER }),
      ),
    );
  });

  it('copper Add only saves: disabled with an empty field, never opens the sheet', async () => {
    await renderNotes();
    const add = screen.getByTestId('notes-composer-add');
    expect(add.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
    await fireEvent.press(add);
    expect(mockRouter.push).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByTestId('notes-composer-input'), 'Chain lube');
    expect(screen.getByTestId('notes-composer-add').props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: false }),
    );
  });

  it('the expand button opens the Note sheet with the draft; the photo button adds the picker', async () => {
    await renderNotes();
    await fireEvent.press(screen.getByRole('button', { name: 'Write a longer note' }));
    expect(mockRouter.push).toHaveBeenLastCalledWith({
      pathname: '/(tabs)/(garage)/note',
      params: { motorcycleId: BIKE_A.id },
    });
    await fireEvent.changeText(screen.getByTestId('notes-composer-input'), 'Draft');
    await fireEvent.press(screen.getByRole('button', { name: 'Attach a photo' }));
    expect(mockRouter.push).toHaveBeenLastCalledWith({
      pathname: '/(tabs)/(garage)/note',
      params: { motorcycleId: BIKE_A.id, draft: 'Draft', photo: '1' },
    });
  });

  it('the camera keeps the typed draft until the sheet has saved a note', async () => {
    const view = await renderNotes();
    await fireEvent.changeText(screen.getByTestId('notes-composer-input'), 'Brake fluid dark');
    await fireEvent.press(screen.getByRole('button', { name: 'Attach a photo' }));
    // Closing the sheet without saving: the draft is still there.
    expect(screen.getByTestId('notes-composer-input').props.value).toBe('Brake fluid dark');

    // The sheet saves: a new saved note shows up in the bike's notes.
    const client = clients[clients.length - 1];
    await act(async () => {
      client.setQueryData(queryKeys.notes.byMotorcycle(BIKE_A.id), {
        notes: [{ ...NOTES[0], id: 'note-from-sheet', text: 'Brake fluid dark' }, ...NOTES],
      });
    });
    view.rerender(
      <QueryClientProvider client={client}>
        <NotesScreen bike={BIKE_A as unknown as HubBike} />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('notes-composer-input').props.value).toBe(''));
  });

  it('tapping a note opens it in the Note sheet for editing', async () => {
    await renderNotes();
    await fireEvent.press(screen.getByTestId('note-open-note-3'));
    expect(mockRouter.push).toHaveBeenLastCalledWith({
      pathname: '/(tabs)/(garage)/note',
      params: { motorcycleId: BIKE_A.id, noteId: 'note-3' },
    });
  });

  it('a screen reader double-tap on a note edits it too', async () => {
    await renderNotes();
    await fireEvent(screen.getByTestId('note-row-note-3'), 'accessibilityAction', {
      nativeEvent: { actionName: 'activate' },
    });
    expect(mockRouter.push).toHaveBeenLastCalledWith({
      pathname: '/(tabs)/(garage)/note',
      params: { motorcycleId: BIKE_A.id, noteId: 'note-3' },
    });
  });

  it('photos are labelled buttons that open the viewer on that photo', async () => {
    await renderNotes({ notes: [PHOTO_NOTE] });
    expect(screen.getByTestId('note-row-note-photos').props.accessibilityLabel).toMatch(
      /36,400 km\. 2 photos$/,
    );
    const second = screen.getByRole('imagebutton', { name: 'Photo 2 of 2' });
    await fireEvent.press(second);
    expect(mockRouter.push).toHaveBeenLastCalledWith({
      pathname: '/(tabs)/(garage)/note-photos',
      params: { motorcycleId: BIKE_A.id, noteId: 'note-photos', index: '1' },
    });
  });

  // The swipe-revealed buttons are hidden from screen readers (the row offers
  // the same two as accessibility actions), hence includeHiddenElements.
  it('Edit opens the Note sheet for that note', async () => {
    await renderNotes();
    await fireEvent.press(screen.getByTestId('note-edit-note-3', { includeHiddenElements: true }));
    expect(mockRouter.push).toHaveBeenLastCalledWith({
      pathname: '/(tabs)/(garage)/note',
      params: { motorcycleId: BIKE_A.id, noteId: 'note-3' },
    });
  });

  it('Delete hides the note behind an Undo snackbar; Undo brings it back and nothing is sent', async () => {
    await renderNotes();
    await fireEvent(screen.getByTestId('note-row-note-3'), 'accessibilityAction', {
      nativeEvent: { actionName: 'delete' },
    });
    expect(screen.queryByTestId('note-row-note-3')).toBeNull();
    expect(screen.getByText('Note deleted')).toBeOnTheScreen();
    expect(screen.getByText('4 notes')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByTestId('note-row-note-3')).toBeOnTheScreen();
    expect(screen.queryByText('Note deleted')).toBeNull();
    expect(mockFetcher).not.toHaveBeenCalledWith(DeleteNoteDocument, expect.anything());
  });

  it('leaving the screen inside the undo window sends the delete', async () => {
    const { unmount } = await renderNotes();
    await fireEvent.press(
      screen.getByTestId('note-delete-note-3', { includeHiddenElements: true }),
    );
    await unmount();
    expect(mockFetcher).toHaveBeenCalledWith(DeleteNoteDocument, { id: 'note-3' });
    const { trackEvent } = jest.requireMock('../../../lib/analytics') as { trackEvent: jest.Mock };
    await waitFor(() =>
      expect(trackEvent).toHaveBeenCalledWith('NOTE_DELETED', { motorcycle_id: BIKE_A.id }),
    );
  });

  it('the back label is the segment it was opened from', async () => {
    await renderNotes({ from: 'bike' });
    await fireEvent.press(screen.getByRole('button', { name: 'Back to Bike' }));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('defaults the back label to Overview', async () => {
    await renderNotes({ from: 'nonsense' });
    expect(screen.getByRole('button', { name: 'Back to Overview' })).toBeOnTheScreen();
  });

  it('empty: no zero count and no search — copy that points at the composer', async () => {
    await renderNotes({ notes: [] });
    expect(screen.getByText("Keep what you'd otherwise forget")).toBeOnTheScreen();
    expect(screen.getByTestId('notes-screen-empty')).toHaveTextContent(
      /stamped with today's odometer/,
    );
    expect(screen.queryByText('0 notes')).toBeNull();
    expect(screen.queryByTestId('notes-search')).toBeNull();
    expect(screen.getByTestId('notes-composer-input')).toBeOnTheScreen();
  });

  it('empty on a bike without an odometer promises no stamp', async () => {
    await renderNotes({ notes: [], bike: { currentMileage: 0 } });
    expect(screen.getByTestId('notes-screen-empty')).toHaveTextContent(/stays with this bike/);
  });

  it('a failed refetch keeps the notes and says they may be stale', async () => {
    await renderNotes();
    mockFetcher.mockImplementation((document: unknown) =>
      document === NotesByMotorcycleDocument
        ? Promise.reject(new Error('offline'))
        : Promise.resolve({ maintenanceTasks: [] }),
    );
    const client = clients[clients.length - 1];
    await act(async () => {
      await client.refetchQueries({ queryKey: queryKeys.notes.byMotorcycle(BIKE_A.id) });
    });
    expect(await screen.findByTestId('notes-screen-refresh-failed')).toBeOnTheScreen();
    expect(screen.getByTestId('note-row-note-1')).toBeOnTheScreen();
  });

  it('error: message and Retry', async () => {
    await renderNotes({ fail: true });
    expect(screen.getByText("Couldn't load notes")).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeOnTheScreen();
  });
});
