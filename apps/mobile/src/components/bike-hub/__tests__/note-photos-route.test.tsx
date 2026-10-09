import 'react-native-gesture-handler/jestSetup';

const mockRouter = { back: jest.fn() };
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
// The reanimated mock lacks the hooks the bike plate uses.
jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  useReducedMotion: () => true,
  interpolateColor: () => 'transparent',
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 54, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('react-native-mmkv', () => require('../../../test/mocks').makeMmkvMock());
jest.mock('../../../lib/analytics', () => require('../../../test/mocks').mockAnalytics());
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: (props: Record<string, unknown>) => <View {...props} /> };
});

const mockFetcher = jest.fn();
jest.mock('../../../lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));

import { NotesByMotorcycleDocument } from '@motovault/graphql';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import '../../../i18n';
import NotePhotosRoute from '../../../app/(tabs)/(garage)/note-photos';
import { BIKE_A, NOTES } from '../../../test/bike-hub-fixtures';
import { rememberLocalNotePhoto } from '../notes/note-photo';

const PHOTO_NOTE = {
  ...NOTES[2],
  id: 'note-photos',
  photos: [
    { id: 'photo-a', storagePath: 'u/a.jpg', publicUrl: 'https://cdn/a.jpg' },
    { id: 'photo-b', storagePath: 'u/b.jpg', publicUrl: 'https://cdn/b.jpg' },
  ],
};

const clients: QueryClient[] = [];

async function renderRoute(params: Record<string, string>) {
  mockParams = { motorcycleId: BIKE_A.id, noteId: PHOTO_NOTE.id, ...params };
  mockFetcher.mockImplementation((document: unknown) =>
    document === NotesByMotorcycleDocument
      ? Promise.resolve({ notes: [PHOTO_NOTE, NOTES[0]] })
      : Promise.resolve(undefined),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  await render(
    <QueryClientProvider client={client}>
      <NotePhotosRoute />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(client.isFetching()).toBe(0));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => jest.clearAllMocks());
afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
});

describe('note photo viewer route', () => {
  it('opens on the requested photo, counted and labelled', async () => {
    await renderRoute({ index: '1' });
    expect(screen.getByTestId('note-photo-viewer')).toBeOnTheScreen();
    expect(screen.getByTestId('note-photo-viewer-counter')).toHaveTextContent('2 of 2');
    expect(screen.getByLabelText('Photo 2 of 2')).toBeOnTheScreen();
  });

  it('clamps an out-of-range index to the last photo', async () => {
    await renderRoute({ index: '9' });
    expect(screen.getByTestId('note-photo-viewer-counter')).toHaveTextContent('2 of 2');
  });

  it('draws the local file this session uploaded instead of the remote url', async () => {
    rememberLocalNotePhoto('u/a.jpg', 'file:///local/a.jpg');
    await renderRoute({ index: '0' });
    expect(screen.getByLabelText('Photo 1 of 2').props.source).toEqual({
      uri: 'file:///local/a.jpg',
    });
  });

  it('the close button goes back', async () => {
    await renderRoute({});
    await fireEvent.press(screen.getByRole('button', { name: 'Close photos' }));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('a note that is gone closes the viewer instead of showing nothing', async () => {
    await renderRoute({ noteId: 'note-deleted' });
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalledTimes(1));
  });
});
