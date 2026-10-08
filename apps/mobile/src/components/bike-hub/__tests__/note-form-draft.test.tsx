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
let mockSession: { user: { id: string } } | null = { user: { id: 'user-1' } };
jest.mock('../../../stores/auth.store', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ currency: 'EUR', session: mockSession }),
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
const mockRemoveObject = jest.fn();
jest.mock('../../../lib/image-upload', () => ({
  pickImage: () => mockPick(),
  takePhoto: jest.fn(),
  uploadNotePhoto: (...args: unknown[]) => mockUpload(...args),
  removeNotePhotoObject: (...args: unknown[]) => mockRemoveObject(...args),
}));
// The action sheet is native; choose "Choose from Library" (the second option) straight away.
jest.mock('../../../utils/action-sheet', () => ({
  showActionSheet: (_title: string, options: Array<{ onPress: () => void }>) =>
    options[1]?.onPress(),
}));

// The unsaved-work guard. `usePreventRemove` is captured per render; `router.back()`
// (the route's `onClose`) and a native swipe-down both go through it, as in the app.
type MockAction = { type: string };
let mockGuard: { prevent: boolean; callback: (event: { data: { action: MockAction } }) => void } = {
  prevent: false,
  callback: () => {},
};
const mockNavigation = { dispatch: jest.fn() };
/** The sheet really left: an unguarded removal, or a guarded one dispatched on. */
const mockRemoved = jest.fn();
mockNavigation.dispatch.mockImplementation((action: MockAction) => mockRemoved(action));
jest.mock('expo-router/react-navigation', () => ({
  useNavigation: () => mockNavigation,
  usePreventRemove: (
    prevent: boolean,
    callback: (event: { data: { action: MockAction } }) => void,
  ) => {
    mockGuard = { prevent, callback };
  },
}));
function mockAttemptRemove(action: MockAction) {
  if (mockGuard.prevent) mockGuard.callback({ data: { action } });
  else mockRemoved(action);
}
const GO_BACK = { type: 'GO_BACK' };
/** What react-native-screens reports for a swipe-down it held back (`onNativeDismissCancelled`). */
const NATIVE_SWIPE = { type: 'POP' };

const mockFetcher = jest.fn();
jest.mock('../../../lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));

/** Picked photos whose file is gone (a cache purge) have "gone" in their uri. */
jest.mock('expo-file-system', () => ({
  File: function MockFile(this: { exists: boolean }, uri: string) {
    this.exists = !uri.includes('gone');
  },
}));
/**
 * `process.env.EXPO_OS` is inlined at build time, so the platform is switched
 * through the guard's platform set: emptied, a POP means "already dismissed"
 * exactly as on Android.
 */
const mockGuardPlatforms = new Set<string>(['ios']);
jest.mock('../../../lib/bike-hub/constants', () =>
  Object.defineProperty(
    { ...jest.requireActual('../../../lib/bike-hub/constants') },
    'SHEET_DISMISS_GUARD_PLATFORMS',
    { get: () => mockGuardPlatforms, enumerable: true },
  ),
);
const asAndroid = () => mockGuardPlatforms.clear();
const asIos = () => {
  mockGuardPlatforms.clear();
  mockGuardPlatforms.add(process.env.EXPO_OS ?? 'ios');
};

import { CreateNoteDocument, UpdateNoteDocument } from '@motovault/graphql';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';
import '../../../i18n';
import { noteDraftKey, useSheetDraftStore } from '../../../stores/sheet-draft.store';
import { BIKE_A, BIKE_B, NOTES } from '../../../test/bike-hub-fixtures';
import {
  DRAFT_OUTCOME,
  type DraftOutcome,
  subscribeDraftOutcome,
} from '../notes/use-draft-handoff';
import type { HubNote } from '../notes/use-notes';
import { NoteForm } from '../sheets/note-form';
import type { HubBike } from '../shell/use-bike-hub-data';

const A = BIKE_A as unknown as HubBike;
const B = BIKE_B as unknown as HubBike;
const EDITED = NOTES[0] as unknown as HubNote;
const onClose = jest.fn();
const alertButtons = (alert: jest.SpyInstance): AlertButton[] =>
  (alert.mock.calls[0]?.[2] as AlertButton[] | undefined) ?? [];

interface Scenario {
  note?: HubNote;
  draft?: string;
  bikes?: HubBike[];
}

async function renderForm(scenario: Scenario = {}) {
  mockFetcher.mockImplementation((document: unknown) => {
    if (document === CreateNoteDocument) {
      return Promise.resolve({
        createNote: { ...NOTES[0], id: 'note-new', linkedTaskId: null },
      });
    }
    if (document === UpdateNoteDocument) return Promise.resolve({ updateNote: NOTES[0] });
    return Promise.resolve({ notes: [] });
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <NoteForm
        bike={A}
        bikes={scenario.bikes ?? [A, B]}
        note={scenario.note}
        draft={scenario.draft}
        onClose={onClose}
      />
    </QueryClientProvider>,
  );
}

/** What a drag-down does on Android: a POP the guard lets through, then the sheet unmounts. */
async function dragDown(view: { unmount: () => void }) {
  await act(async () => mockAttemptRemove(NATIVE_SWIPE));
  expect(mockRemoved).toHaveBeenCalledWith(NATIVE_SWIPE);
  await act(async () => view.unmount());
}

const NEW_KEY = noteDraftKey(BIKE_A.id);
const parked = (key = NEW_KEY) => useSheetDraftStore.getState().notes[key]?.draft;
const textValue = () => screen.getByTestId('note-text').props.value;

/** Writes "Chain is loud", picks two photos (one of which a cache purge will remove), and so on. */
async function writeEverything() {
  await fireEvent.changeText(screen.getByTestId('note-text'), 'Chain is loud');
  mockPick.mockResolvedValueOnce('file:///kept.jpg');
  await fireEvent.press(screen.getByTestId('note-add-photo'));
  mockPick.mockResolvedValueOnce('file:///gone.jpg');
  await fireEvent.press(screen.getByTestId('note-add-photo'));
  await fireEvent.press(screen.getByTestId('note-stamp'));
  await fireEvent.press(screen.getByTestId('toggle'));
  await fireEvent.press(screen.getByTestId(`note-bike-${BIKE_B.id}`));
}

beforeEach(() => {
  jest.clearAllMocks();
  useSheetDraftStore.setState({ notes: {}, readings: {} });
  mockNavigation.dispatch.mockImplementation((action: MockAction) => mockRemoved(action));
  // `onClose` is the route's `router.back()`: it goes through the guard.
  onClose.mockImplementation(() => mockAttemptRemove(GO_BACK));
  mockSession = { user: { id: 'user-1' } };
});
afterEach(() => {
  asIos();
  jest.restoreAllMocks();
});

describe('Note sheet — Android drag-down keeps the note', () => {
  beforeEach(asAndroid);

  it('parks everything typed and picked; reopening restores it under a quiet notice', async () => {
    const view = await renderForm();
    expect(screen.queryByTestId('note-restored')).toBeNull();
    await writeEverything();
    await dragDown(view);
    expect(parked()).toEqual({
      text: 'Chain is loud',
      stampOn: false,
      alsoTask: true,
      targetId: BIKE_B.id,
      newPhotos: ['file:///kept.jpg', 'file:///gone.jpg'],
      removedPhotoIds: [],
      handoff: undefined,
    });

    await renderForm();
    expect(screen.getByText('Restored what you were writing')).toBeTruthy();
    expect(textValue()).toBe('Chain is loud');
    expect(screen.getByTestId('note-stamp').props.accessibilityState.selected).toBe(false);
    expect(screen.getByTestId('note-also-task').props.accessibilityState.checked).toBe(true);
    expect(screen.getByTestId(`note-bike-${BIKE_B.id}`).props.accessibilityState.selected).toBe(
      true,
    );
    // The photo whose file is gone is dropped silently; the other comes back.
    expect(screen.getAllByLabelText('Remove photo')).toHaveLength(1);
    // Restored work is unsaved work: the guard is on again.
    expect(mockGuard.prevent).toBe(true);
  });

  it('Clear empties the form and the store, and hides the notice', async () => {
    const view = await renderForm();
    await writeEverything();
    await dragDown(view);
    await renderForm();
    await fireEvent.press(screen.getByTestId('note-restored-clear'));
    expect(screen.queryByTestId('note-restored')).toBeNull();
    expect(textValue()).toBe('');
    expect(screen.queryAllByLabelText('Remove photo')).toHaveLength(0);
    expect(screen.getByTestId('note-stamp').props.accessibilityState.selected).toBe(true);
    expect(parked()).toBeUndefined();
    expect(mockGuard.prevent).toBe(false);
  });

  it('Cancel → Discard clears the parked note', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const first = await renderForm();
    await fireEvent.changeText(screen.getByTestId('note-text'), 'Chain is loud');
    await dragDown(first);
    const view = await renderForm();
    mockNavigation.dispatch.mockClear();
    await fireEvent.press(screen.getByTestId('note-cancel'));
    expect(alert).toHaveBeenCalledTimes(1);
    await act(async () => alertButtons(alert)[1]?.onPress?.());
    // One navigation action: the held Cancel, re-dispatched.
    expect(mockNavigation.dispatch).toHaveBeenCalledTimes(1);
    expect(mockNavigation.dispatch).toHaveBeenCalledWith(GO_BACK);
    await act(async () => view.unmount());
    expect(parked()).toBeUndefined();
  });

  it('saving the restored note clears the store', async () => {
    const first = await renderForm();
    await fireEvent.changeText(screen.getByTestId('note-text'), 'Chain is loud');
    await dragDown(first);
    const view = await renderForm();
    await fireEvent.press(screen.getByTestId('note-save'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(parked()).toBeUndefined();
    await act(async () => view.unmount());
    expect(parked()).toBeUndefined();
  });

  it("an edit is parked per note, not on the bike's new-note slot", async () => {
    const view = await renderForm({ note: EDITED });
    await fireEvent.changeText(screen.getByTestId('note-text'), 'Edited text');
    await dragDown(view);
    expect(parked()).toBeUndefined();
    expect(parked(noteDraftKey(BIKE_A.id, EDITED.id))?.text).toBe('Edited text');

    const fresh = await renderForm();
    expect(screen.queryByTestId('note-restored')).toBeNull();
    await act(async () => fresh.unmount());
    await renderForm({ note: EDITED });
    expect(textValue()).toBe('Edited text');
  });

  it('a clean sheet parks nothing', async () => {
    const view = await renderForm();
    await dragDown(view);
    expect(parked()).toBeUndefined();
  });
});

describe('Note sheet — a quick-add hand-off and a parked draft', () => {
  const outcomes: Array<[string, DraftOutcome]> = [];
  let unsubscribe: () => void = () => {};
  beforeEach(() => {
    asAndroid();
    outcomes.length = 0;
    unsubscribe = subscribeDraftOutcome((draft, outcome) => outcomes.push([draft, outcome]));
  });
  afterEach(() => unsubscribe());

  async function parkFromHandoff() {
    const view = await renderForm({ draft: 'Check chain' });
    await fireEvent.changeText(screen.getByTestId('note-text'), 'Check chain and sprockets');
    await dragDown(view);
  }

  it('dragged away: parked, and the hand-off is not reported DISCARDED (it stays pending)', async () => {
    await parkFromHandoff();
    expect(outcomes).toEqual([]);
    expect(parked()).toMatchObject({ text: 'Check chain and sprockets', handoff: 'Check chain' });
  });

  it('the same hand-off again restores the parked draft', async () => {
    await parkFromHandoff();
    await renderForm({ draft: 'Check chain' });
    expect(textValue()).toBe('Check chain and sprockets');
    expect(screen.getByTestId('note-restored')).toBeTruthy();
  });

  it('a different hand-off wins: the parked draft is neither shown nor touched', async () => {
    await parkFromHandoff();
    const view = await renderForm({ draft: 'Bought oil' });
    expect(textValue()).toBe('Bought oil');
    expect(screen.queryByTestId('note-restored')).toBeNull();
    await fireEvent.press(screen.getByTestId('note-save'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    await act(async () => view.unmount());
    expect(outcomes).toEqual([['Bought oil', DRAFT_OUTCOME.SAVED]]);
    expect(parked()?.text).toBe('Check chain and sprockets');
  });

  it('restored without a hand-off and saved: still SAVED for the handed-off text', async () => {
    await parkFromHandoff();
    await renderForm();
    expect(textValue()).toBe('Check chain and sprockets');
    await fireEvent.press(screen.getByTestId('note-save'));
    await waitFor(() => expect(outcomes).toEqual([['Check chain', DRAFT_OUTCOME.SAVED]]));
    expect(parked()).toBeUndefined();
  });

  it('Clear on a draft whose hand-off is known only from the store reports DISCARDED', async () => {
    await parkFromHandoff();
    await renderForm();
    await fireEvent.press(screen.getByTestId('note-restored-clear'));
    expect(outcomes).toEqual([['Check chain', DRAFT_OUTCOME.DISCARDED]]);
    expect(textValue()).toBe('');
  });

  it('Clear with the same hand-off goes back to the handed-off text, which stays pending', async () => {
    await parkFromHandoff();
    await renderForm({ draft: 'Check chain' });
    await fireEvent.press(screen.getByTestId('note-restored-clear'));
    expect(textValue()).toBe('Check chain');
    expect(outcomes).toEqual([]);
    await fireEvent.press(screen.getByTestId('note-save'));
    await waitFor(() => expect(outcomes).toEqual([['Check chain', DRAFT_OUTCOME.SAVED]]));
  });

  it('dragged away mid-save and the save fails: parked, nothing reported', async () => {
    let release: () => void = () => {};
    const view = await renderForm({ draft: 'Bought oil' });
    const answer = mockFetcher.getMockImplementation();
    mockFetcher.mockImplementation((document: unknown, variables: unknown) =>
      document === CreateNoteDocument
        ? new Promise((_resolve, reject) => {
            release = () => reject(new Error('offline'));
          })
        : answer?.(document, variables),
    );
    const saving = fireEvent.press(screen.getByTestId('note-save'));
    await screen.findByText('Saving…');
    await dragDown(view);
    await act(async () => release());
    await saving;
    expect(outcomes).toEqual([]);
    expect(parked()).toMatchObject({ text: 'Bought oil', handoff: 'Bought oil' });
  });

  it('dragged away mid-save and the save lands: SAVED, and nothing was ever parked', async () => {
    let release: () => void = () => {};
    const view = await renderForm({ draft: 'Bought oil' });
    const answer = mockFetcher.getMockImplementation();
    mockFetcher.mockImplementation((document: unknown, variables: unknown) =>
      document === CreateNoteDocument
        ? new Promise((resolve) => {
            release = () => resolve(answer?.(document, variables));
          })
        : answer?.(document, variables),
    );
    const saving = fireEvent.press(screen.getByTestId('note-save'));
    await screen.findByText('Saving…');
    await dragDown(view);
    // A save in flight is not parked: a sheet reopened now must not offer it.
    expect(parked()).toBeUndefined();
    await act(async () => release());
    await saving;
    expect(outcomes).toEqual([['Bought oil', DRAFT_OUTCOME.SAVED]]);
    expect(parked()).toBeUndefined();
  });

  it('a different hand-off dragged away while another draft is parked: the parked one is kept', async () => {
    await parkFromHandoff();
    const view = await renderForm({ draft: 'Bought oil' });
    await fireEvent.changeText(screen.getByTestId('note-text'), 'Bought oil and filter');
    await dragDown(view);
    // Not parked over: the older draft stays, and the field that handed off
    // "Bought oil" keeps its text and stops waiting.
    expect(parked()).toMatchObject({
      text: 'Check chain and sprockets',
      handoff: 'Check chain',
    });
    expect(outcomes).toEqual([['Bought oil', DRAFT_OUTCOME.DISCARDED]]);
    // The kept draft is still the one the original hand-off restores.
    await renderForm({ draft: 'Check chain' });
    expect(textValue()).toBe('Check chain and sprockets');
  });
});

describe('Note sheet — reopened while the dismissed sheet still saves', () => {
  beforeEach(asAndroid);

  /** Makes `createNote` wait until the returned `settle(ok)` is called. */
  function holdCreate() {
    let settle: (ok: boolean) => void = () => {};
    const answer = mockFetcher.getMockImplementation();
    mockFetcher.mockImplementation((document: unknown, variables: unknown) =>
      document === CreateNoteDocument
        ? new Promise((resolve, reject) => {
            settle = (ok) =>
              ok ? resolve(answer?.(document, variables)) : reject(new Error('offline'));
          })
        : answer?.(document, variables),
    );
    return (ok: boolean) => settle(ok);
  }

  async function dragAwayMidSave() {
    const first = await renderForm();
    await fireEvent.changeText(screen.getByTestId('note-text'), 'Chain is loud');
    const settle = holdCreate();
    const saving = fireEvent.press(screen.getByTestId('note-save'));
    await screen.findByText('Saving…');
    await dragDown(first);
    return { settle, saving };
  }

  const creates = () =>
    mockFetcher.mock.calls.filter(([document]) => document === CreateNoteDocument);

  it('lands: the reopened sheet starts fresh (no duplicate), and its own parked draft survives', async () => {
    const { settle, saving } = await dragAwayMidSave();
    const second = await renderForm();
    // Nothing restored: the first save may already be on the server.
    expect(screen.queryByTestId('note-restored')).toBeNull();
    expect(textValue()).toBe('');
    await fireEvent.changeText(screen.getByTestId('note-text'), 'Front tyre at 2.1 bar');
    await dragDown(second);
    expect(parked()?.text).toBe('Front tyre at 2.1 bar');

    await act(async () => settle(true));
    await saving;
    expect(creates()).toHaveLength(1);
    // The first save's success clears only what it owns.
    expect(parked()?.text).toBe('Front tyre at 2.1 bar');
  });

  it('fails: parked once, after the failure, and restored by the next sheet', async () => {
    const { settle, saving } = await dragAwayMidSave();
    const second = await renderForm();
    expect(screen.queryByTestId('note-restored')).toBeNull();
    await act(async () => second.unmount());

    await act(async () => settle(false));
    await saving;
    expect(creates()).toHaveLength(1);
    expect(Object.keys(useSheetDraftStore.getState().notes)).toEqual([NEW_KEY]);
    expect(parked()?.text).toBe('Chain is loud');
    await renderForm();
    expect(textValue()).toBe('Chain is loud');
    expect(screen.getByTestId('note-restored')).toBeTruthy();
  });

  it('fails while a later sheet has parked its own draft: that draft is not overwritten', async () => {
    const { settle, saving } = await dragAwayMidSave();
    const second = await renderForm();
    await fireEvent.changeText(screen.getByTestId('note-text'), 'Front tyre at 2.1 bar');
    await dragDown(second);

    await act(async () => settle(false));
    await saving;
    expect(parked()?.text).toBe('Front tyre at 2.1 bar');
  });

  it('a restored draft dragged away mid-save is not offered again while it saves', async () => {
    const first = await renderForm();
    await fireEvent.changeText(screen.getByTestId('note-text'), 'Chain is loud');
    await dragDown(first);
    const restoredSheet = await renderForm();
    expect(textValue()).toBe('Chain is loud');
    const settle = holdCreate();
    const saving = fireEvent.press(screen.getByTestId('note-save'));
    await screen.findByText('Saving…');
    await dragDown(restoredSheet);
    expect(parked()).toBeUndefined();

    await renderForm();
    expect(screen.queryByTestId('note-restored')).toBeNull();
    await act(async () => settle(true));
    await saving;
    expect(creates()).toHaveLength(1);
  });
});

describe('Note sheet — photos of a note saved after its sheet was dragged away', () => {
  beforeEach(asAndroid);

  it('photos that fail to upload are parked on the saved note and offered when it is edited', async () => {
    const first = await renderForm();
    await fireEvent.changeText(screen.getByTestId('note-text'), 'Chain is loud');
    mockPick.mockResolvedValueOnce('file:///kept.jpg');
    await fireEvent.press(screen.getByTestId('note-add-photo'));
    let settle: () => void = () => {};
    const answer = mockFetcher.getMockImplementation();
    mockFetcher.mockImplementation((document: unknown, variables: unknown) =>
      document === CreateNoteDocument
        ? new Promise((resolve) => {
            settle = () => resolve(answer?.(document, variables));
          })
        : answer?.(document, variables),
    );
    mockUpload.mockRejectedValue(new Error('The request timed out'));
    const saving = fireEvent.press(screen.getByTestId('note-save'));
    await screen.findByText('Saving…');
    await dragDown(first);

    await act(async () => settle());
    await saving;
    // The note itself is saved: nothing on the new-note slot.
    expect(parked()).toBeUndefined();
    const savedNoteKey = noteDraftKey(BIKE_A.id, 'note-new');
    expect(parked(savedNoteKey)).toMatchObject({
      text: 'Chain is loud',
      newPhotos: ['file:///kept.jpg'],
      removedPhotoIds: [],
    });

    await renderForm({ note: { ...EDITED, id: 'note-new', text: 'Chain is loud' } });
    expect(screen.getByTestId('note-restored')).toBeTruthy();
    expect(screen.getAllByLabelText('Remove photo')).toHaveLength(EDITED.photos.length + 1);
  });
});

describe('Note sheet — iOS is unchanged', () => {
  beforeEach(asIos);

  it('a swipe-down asks first; Discard leaves nothing parked', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const view = await renderForm();
    await fireEvent.changeText(screen.getByTestId('note-text'), 'Chain is loud');
    await act(async () => mockAttemptRemove(NATIVE_SWIPE));
    expect(alert).toHaveBeenCalledTimes(1);
    expect(mockRemoved).not.toHaveBeenCalled();
    await act(async () => alertButtons(alert)[1]?.onPress?.());
    expect(mockRemoved).toHaveBeenCalledTimes(1);
    await act(async () => view.unmount());
    expect(parked()).toBeUndefined();
  });
});
