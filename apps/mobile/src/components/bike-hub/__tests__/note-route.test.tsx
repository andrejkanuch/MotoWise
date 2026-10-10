const mockRouter = { back: jest.fn() };
let mockParams: Record<string, string> = {};
let mockTransitionEnd: ((event: { data: { closing: boolean } }) => void) | undefined;
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
  useLocalSearchParams: () => mockParams,
  useNavigation: () => ({
    addListener: (_event: string, listener: typeof mockTransitionEnd) => {
      mockTransitionEnd = listener;
      return () => {};
    },
  }),
}));
jest.mock('react-native-mmkv', () => require('@/test/mocks').makeMmkvMock());
jest.mock('@/lib/analytics', () => require('@/test/mocks').mockAnalytics());

// The form has its own suite; here it is a stand-in that exposes what the route hands it.
const mockNoteForm = jest.fn((_props: Record<string, unknown>) => null);
jest.mock('../sheets/note-form', () => ({
  NoteForm: (props: Record<string, unknown>) => mockNoteForm(props),
}));

const mockFetcher = jest.fn();
jest.mock('@/lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));

import { MyMotorcyclesDocument, NotesByMotorcycleDocument } from '@motovault/graphql';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import NoteScreen from '@/app/(tabs)/(garage)/note';
import { BIKE_A, NOTES } from '@/test/bike-hub-fixtures';

const clients: QueryClient[] = [];

async function renderRoute(params: Record<string, string>) {
  mockParams = { motorcycleId: BIKE_A.id, ...params };
  mockFetcher.mockImplementation((document: unknown) => {
    if (document === MyMotorcyclesDocument) return Promise.resolve({ myMotorcycles: [BIKE_A] });
    if (document === NotesByMotorcycleDocument) return Promise.resolve({ notes: NOTES });
    return Promise.resolve(undefined);
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  await render(
    <QueryClientProvider client={client}>
      <NoteScreen />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(client.isFetching()).toBe(0));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const lastFormProps = () => mockNoteForm.mock.lastCall?.[0];

beforeEach(() => {
  jest.clearAllMocks();
  mockTransitionEnd = undefined;
});
afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
});

describe('Note sheet route', () => {
  it('without a noteId it is a new note', async () => {
    await renderRoute({ draft: 'Typed in the quick field' });
    expect(lastFormProps()).toMatchObject({ note: undefined, draft: 'Typed in the quick field' });
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('with a known noteId it edits that note', async () => {
    await renderRoute({ noteId: 'note-3' });
    expect(lastFormProps()?.note).toMatchObject({ id: 'note-3' });
  });

  it('an unknown noteId closes the sheet and never falls into "new note"', async () => {
    await renderRoute({ noteId: 'deleted-elsewhere' });
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockNoteForm).not.toHaveBeenCalled();
    expect(screen.getByTestId('note-sheet-loading')).toBeOnTheScreen();
  });

  it('asks for the photo sheet only after its own presenting transition has ended', async () => {
    await renderRoute({ photo: '1' });
    expect(lastFormProps()).toMatchObject({ openPhotoPicker: false });
    // A closing transition is not "presented".
    await act(async () => mockTransitionEnd?.({ data: { closing: true } }));
    expect(lastFormProps()).toMatchObject({ openPhotoPicker: false });
    await act(async () => mockTransitionEnd?.({ data: { closing: false } }));
    expect(lastFormProps()).toMatchObject({ openPhotoPicker: true });
  });

  it('without the photo param the picker is never requested', async () => {
    await renderRoute({});
    await act(async () => mockTransitionEnd?.({ data: { closing: false } }));
    expect(lastFormProps()).toMatchObject({ openPhotoPicker: false });
  });
});
