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
  NotesByMotorcycleDocument,
} from '@motovault/graphql';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import '../../../i18n';
import { NOTE_SOURCE, NOTES_SEARCH_DEBOUNCE_MS } from '../../../lib/bike-hub/constants';
import { useBikeHubStore } from '../../../stores/bike-hub.store';
import { usePendingDeleteStore } from '../../../stores/pending-delete.store';
import { BIKE_A, NOTES } from '../../../test/bike-hub-fixtures';
import { NotesScreen } from '../notes/notes-screen';
import type { HubBike } from '../shell/use-bike-hub-data';

const clients: QueryClient[] = [];

async function renderNotes(options: { notes?: unknown[]; from?: string; fail?: boolean } = {}) {
  mockFetcher.mockImplementation((document: unknown) => {
    if (document === NotesByMotorcycleDocument) {
      return options.fail
        ? Promise.reject(new Error('offline'))
        : Promise.resolve({ notes: options.notes ?? NOTES });
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
      <NotesScreen bike={BIKE_A as unknown as HubBike} from={options.from} />
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
    expect(screen.getByText('Jul 20')).toBeOnTheScreen();
    expect(screen.getByText('Jul 16 · 37,300 km')).toBeOnTheScreen();
  });

  it('shows the three link variants', async () => {
    await renderNotes();
    expect(screen.getByTestId('note-link-note-1')).toHaveTextContent('Make it a task');
    expect(screen.getByTestId('note-link-note-2')).toHaveTextContent('Linked expense · €29.73');
    expect(screen.getByTestId('note-link-note-5')).toHaveTextContent('2nd scheduled service');
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
    ).toEqual(['edit', 'delete', 'link']);
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

  it('"Make it a task" creates the task and the link then shows its title', async () => {
    await renderNotes();
    await fireEvent.press(screen.getByTestId('note-link-note-1'));
    await waitFor(() =>
      expect(mockFetcher).toHaveBeenCalledWith(CreateTaskFromNoteDocument, { noteId: 'note-1' }),
    );
    await waitFor(() =>
      expect(screen.getByTestId('note-link-note-1')).toHaveTextContent(
        'Rear preload felt soft two-up on the Pyrenees run',
      ),
    );
  });

  it('search "2.5 bar" leaves one note; an unmatched query says so', async () => {
    await renderNotes();
    await fireEvent.changeText(screen.getByTestId('notes-search'), '2.5 bar');
    await settle(NOTES_SEARCH_DEBOUNCE_MS + 50);
    expect(screen.getAllByTestId(/^note-row-/)).toHaveLength(1);
    expect(screen.getByTestId('note-row-note-3')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByTestId('notes-search'), 'carburettor');
    await settle(NOTES_SEARCH_DEBOUNCE_MS + 50);
    expect(screen.getByText('No notes match “carburettor”')).toBeOnTheScreen();
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

  it('composer Add with an empty field opens the Note sheet; the photo button opens it with the picker', async () => {
    await renderNotes();
    await fireEvent.press(screen.getByTestId('notes-composer-add'));
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

  it('empty: "No notes yet" with the composer still present', async () => {
    await renderNotes({ notes: [] });
    expect(screen.getByText('No notes yet')).toBeOnTheScreen();
    expect(screen.getByTestId('notes-composer-input')).toBeOnTheScreen();
  });

  it('error: message and Retry', async () => {
    await renderNotes({ fail: true });
    expect(screen.getByText("Couldn't load notes")).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeOnTheScreen();
  });
});
