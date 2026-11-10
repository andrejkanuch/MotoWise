// Saving a note with a photo counts as using "Notes, with photos", which
// clears its NEW chip. A note without a photo does not.
jest.mock('react-native-mmkv', () => require('@/test/mocks').makeMmkvMock());
jest.mock('@/lib/analytics', () => require('@/test/mocks').mockAnalytics());
const mockFetcher = jest.fn();
jest.mock('@/lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { WHATS_NEW_FEATURE } from '@/data/whats-new-releases';
import { trackEvent } from '@/lib/analytics';
import { NOTE_SOURCE } from '@/lib/bike-hub/constants';
import { useWhatsNewStore } from '@/stores/whats-new.store';
import { useCreateNote } from '../notes/use-notes';

const BIKE_ID = 'bike-1';

async function createNote(hasPhoto: boolean) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = await renderHook(() => useCreateNote(), { wrapper });
  await act(async () => {
    await result.current.mutateAsync({
      motorcycleId: BIKE_ID,
      text: 'Tire pressure 36 front, 42 rear',
      odometer: null,
      source: NOTE_SOURCE.SHEET,
      hasPhoto,
    });
  });
}

beforeEach(() => {
  useWhatsNewStore.setState(useWhatsNewStore.getInitialState(), true);
  mockFetcher.mockReset();
  mockFetcher.mockResolvedValue({ createNote: { id: 'note-1', motorcycleId: BIKE_ID } });
  (trackEvent as jest.Mock).mockReset();
});

describe('creating a note', () => {
  it('with a photo marks Notes, with photos used', async () => {
    await createNote(true);
    expect(trackEvent).toHaveBeenCalledWith(
      'NOTE_CREATED',
      expect.objectContaining({ has_photo: true }),
    );
    expect(useWhatsNewStore.getState().usedFeatures).toContain(WHATS_NEW_FEATURE.NOTES_PHOTOS);
  });

  it('without a photo leaves it unused', async () => {
    await createNote(false);
    expect(trackEvent).toHaveBeenCalledWith(
      'NOTE_CREATED',
      expect.objectContaining({ has_photo: false }),
    );
    expect(useWhatsNewStore.getState().usedFeatures).not.toContain(WHATS_NEW_FEATURE.NOTES_PHOTOS);
  });
});
