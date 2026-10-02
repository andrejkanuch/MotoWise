jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 54, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('react-native-keyboard-controller', () =>
  require('react-native-keyboard-controller/jest'),
);
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
jest.mock('../../ui/native-toggle', () => {
  const { Pressable } = require('react-native');
  return {
    NativeToggle: ({
      value,
      onValueChange,
    }: {
      value: boolean;
      onValueChange: (v: boolean) => void;
    }) => <Pressable testID="toggle" onPress={() => onValueChange(!value)} />,
  };
});

const mockUpload = jest.fn();
const mockPick = jest.fn();
jest.mock('../../../lib/image-upload', () => ({
  pickImage: () => mockPick(),
  takePhoto: jest.fn(),
  uploadNotePhoto: (...args: unknown[]) => mockUpload(...args),
}));
// The action sheet is native; choose "Choose from Library" (the second option) straight away.
jest.mock('../../../utils/action-sheet', () => ({
  showActionSheet: (_title: string, options: Array<{ onPress: () => void }>) =>
    options[1]?.onPress(),
}));

const mockFetcher = jest.fn();
jest.mock('../../../lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));

import { AddNotePhotoDocument, CreateNoteDocument, UpdateNoteDocument } from '@motovault/graphql';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import '../../../i18n';
import { BIKE_A, BIKE_B, NOTES } from '../../../test/bike-hub-fixtures';
import type { HubNote } from '../notes/use-notes';
import { NoteForm } from '../sheets/note-form';
import type { HubBike } from '../shell/use-bike-hub-data';

const A = BIKE_A as unknown as HubBike;
const B = BIKE_B as unknown as HubBike;
const onClose = jest.fn();
const clients: QueryClient[] = [];

interface Scenario {
  bikes?: HubBike[];
  note?: HubNote;
  draft?: string;
  created?: Record<string, unknown>;
  bike?: HubBike;
  openPhotoPicker?: boolean;
}

function form(scenario: Scenario, client: QueryClient) {
  return (
    <QueryClientProvider client={client}>
      <NoteForm
        bike={scenario.bike ?? A}
        bikes={scenario.bikes ?? [scenario.bike ?? A]}
        note={scenario.note}
        draft={scenario.draft}
        openPhotoPicker={scenario.openPhotoPicker}
        onClose={onClose}
      />
    </QueryClientProvider>
  );
}

async function renderForm(scenario: Scenario = {}) {
  mockFetcher.mockImplementation((document: unknown) => {
    if (document === CreateNoteDocument) {
      return Promise.resolve({
        createNote: { ...NOTES[0], id: 'note-new', linkedTaskId: 'task-new', ...scenario.created },
      });
    }
    if (document === UpdateNoteDocument) return Promise.resolve({ updateNote: NOTES[0] });
    if (document === AddNotePhotoDocument) return Promise.resolve({ addNotePhoto: { id: 'p1' } });
    return Promise.resolve({ notes: [] });
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { gcTime: 0 } },
  });
  clients.push(client);
  const view = await render(form(scenario, client));
  return { ...view, client };
}

const created = () =>
  mockFetcher.mock.calls.find(([document]) => document === CreateNoteDocument)?.[1];

beforeEach(() => {
  jest.clearAllMocks();
  mockPick.mockResolvedValue('file:///photo-1.jpg');
  mockUpload.mockResolvedValue({ storagePath: 'user-1/notes/note-new/1.webp', fileSizeBytes: 10 });
});
afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
});

describe('NoteForm — new note', () => {
  it('Save is disabled for empty and whitespace-only text', async () => {
    await renderForm();
    expect(screen.getByText('New note')).toBeOnTheScreen();
    expect(screen.getByTestId('note-save')).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId('note-text'), '   ');
    expect(screen.getByTestId('note-save')).toBeDisabled();
  });

  it('saves trimmed text with the odometer stamp and closes', async () => {
    await renderForm({ draft: 'From the quick field' });
    expect(screen.getByText('38,167 km · today')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId('note-text'), '  Check sag  ');
    await fireEvent.press(screen.getByTestId('note-save'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(created()).toEqual({
      input: {
        motorcycleId: BIKE_A.id,
        text: 'Check sag',
        odometer: 38_167,
        alsoCreateTask: false,
      },
    });
  });

  // createNote rejects an explicit null (verified against the local API), so
  // "no stamp" is sent as no odometer at all.
  it('with the stamp switched off it sends no odometer', async () => {
    await renderForm({ draft: 'No stamp' });
    await fireEvent.press(screen.getByTestId('note-stamp'));
    await fireEvent.press(screen.getByTestId('note-save'));
    await waitFor(() => expect(created()).toBeDefined());
    expect(created()?.input.odometer).toBeUndefined();
  });

  it('"Also make it a task" sends alsoCreateTask: true', async () => {
    await renderForm({ draft: 'Check rear sag' });
    await fireEvent.press(screen.getByTestId('toggle'));
    await fireEvent.press(screen.getByTestId('note-save'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(created()).toMatchObject({ input: { alsoCreateTask: true } });
  });

  it('a note saved without its task is reported as a notice, not an error', async () => {
    await renderForm({ draft: 'Check rear sag', created: { linkedTaskId: null } });
    await fireEvent.press(screen.getByTestId('toggle'));
    await fireEvent.press(screen.getByTestId('note-save'));
    expect(
      await screen.findByText(/^Note saved\. The task could not be created/),
    ).toBeOnTheScreen();
    expect(onClose).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('Done'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('hides "Attach to" with one bike; with several, the chosen bike and its odometer are used', async () => {
    await renderForm({ draft: 'Belongs to the Ténéré', bikes: [A, B] });
    expect(screen.getByText('Attach to')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(`note-bike-${BIKE_B.id}`));
    expect(screen.getByText('1,240 km · today')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('note-save'));
    await waitFor(() => expect(created()).toBeDefined());
    expect(created()).toMatchObject({ input: { motorcycleId: BIKE_B.id, odometer: 1_240 } });
  });

  it('"Attach to" lists the current bike first and preselected, whatever the garage order', async () => {
    await renderForm({ draft: 'Order', bike: A, bikes: [B, A] });
    const chips = screen.getAllByTestId(/^note-bike-/);
    expect(chips.map((chip) => chip.props.testID)).toEqual([
      `note-bike-${BIKE_A.id}`,
      `note-bike-${BIKE_B.id}`,
    ]);
    expect(chips[0]).toBeSelected();
    expect(chips[1]).not.toBeSelected();
  });

  it('single-bike account: no "Attach to"; the unbuilt "Link a job" chip is not rendered', async () => {
    await renderForm();
    expect(screen.queryByText('Attach to')).toBeNull();
    expect(screen.queryByText(/Link a job/)).toBeNull();
  });

  it('uploads photos after the note exists, under its id', async () => {
    await renderForm({ draft: 'With a photo' });
    await fireEvent.press(screen.getByTestId('note-add-photo'));
    await act(async () => {});
    await fireEvent.press(screen.getByTestId('note-save'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mockUpload).toHaveBeenCalledWith('file:///photo-1.jpg', 'user-1', 'note-new');
    expect(mockFetcher).toHaveBeenCalledWith(AddNotePhotoDocument, {
      input: { noteId: 'note-new', storagePath: 'user-1/notes/note-new/1.webp', fileSizeBytes: 10 },
    });
  });

  it('a failed photo keeps the note and offers Retry', async () => {
    mockUpload.mockRejectedValueOnce(new Error('storage down'));
    await renderForm({ draft: 'With a photo' });
    await fireEvent.press(screen.getByTestId('note-add-photo'));
    await act(async () => {});
    await fireEvent.press(screen.getByTestId('note-save'));
    expect(await screen.findByText('Note saved, photo failed')).toBeOnTheScreen();
    expect(onClose).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('note-retry-photos'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mockUpload).toHaveBeenCalledTimes(2);
  });

  it('a failed save keeps the text and shows the error', async () => {
    await renderForm({ draft: 'Will fail' });
    mockFetcher.mockImplementation(() => Promise.reject(new Error('offline')));
    await fireEvent.press(screen.getByTestId('note-save'));
    expect(await screen.findByText("Couldn't save the note. Try again.")).toBeOnTheScreen();
    // In the keyboard-attached footer, right above Save — not in the scroll area,
    // where it sat below the fold with the keyboard open.
    expect(screen.getByTestId('note-save-error').parent).toBe(
      screen.getByTestId('note-save').parent,
    );
    expect(screen.getByTestId('note-text').props.value).toBe('Will fail');
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('NoteForm — edit', () => {
  it('pre-fills the note and calls updateNote', async () => {
    const note = NOTES[0] as unknown as HubNote;
    await renderForm({ note });
    expect(screen.getByText('Edit note')).toBeOnTheScreen();
    expect(screen.getByTestId('note-text').props.value).toBe(note.text);
    expect(screen.queryByTestId('toggle')).toBeNull();
    await fireEvent.changeText(screen.getByTestId('note-text'), 'Updated');
    await fireEvent.press(screen.getByTestId('note-save'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mockFetcher).toHaveBeenCalledWith(UpdateNoteDocument, {
      id: note.id,
      input: { text: 'Updated', odometer: 38_100 },
    });
  });
});

describe('NoteForm — unset odometer, unsaved changes, photo picker', () => {
  it('a bike whose odometer is 0 offers no stamp and sends none', async () => {
    await renderForm({ draft: 'No odometer yet', bike: { ...A, currentMileage: 0 } as HubBike });
    expect(screen.queryByTestId('note-stamp')).toBeNull();
    await fireEvent.press(screen.getByTestId('note-save'));
    await waitFor(() => expect(created()).toBeDefined());
    expect(created()?.input.odometer).toBeUndefined();
  });

  it('Cancel asks before discarding when only the stamp was toggled', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderForm({ note: NOTES[0] as unknown as HubNote });
    await fireEvent.press(screen.getByTestId('note-stamp'));
    await fireEvent.press(screen.getByTestId('note-cancel'));
    expect(alert).toHaveBeenCalledWith('Discard this note?', undefined, expect.any(Array));
    expect(onClose).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it('Cancel asks before discarding when only a photo was removed', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const withPhoto = {
      ...NOTES[0],
      photos: [{ id: 'photo-1', storagePath: 'p', publicUrl: 'https://example.test/p.webp' }],
    } as unknown as HubNote;
    await renderForm({ note: withPhoto });
    await fireEvent.press(screen.getByRole('button', { name: 'Remove photo' }));
    await fireEvent.press(screen.getByTestId('note-cancel'));
    expect(alert).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it('Cancel closes at once when nothing changed', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderForm({ note: NOTES[0] as unknown as HubNote });
    await fireEvent.press(screen.getByTestId('note-cancel'));
    expect(alert).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });

  it('never opens the photo sheet on mount; opens it once when the route says the sheet is presented', async () => {
    const { rerender, client } = await renderForm({
      draft: 'From the composer',
      openPhotoPicker: false,
    });
    await act(async () => {});
    expect(mockPick).not.toHaveBeenCalled();

    await rerender(form({ draft: 'From the composer', openPhotoPicker: true }, client));
    await act(async () => {});
    expect(mockPick).toHaveBeenCalledTimes(1);

    await rerender(form({ draft: 'From the composer', openPhotoPicker: true }, client));
    await act(async () => {});
    expect(mockPick).toHaveBeenCalledTimes(1);
  });
});
