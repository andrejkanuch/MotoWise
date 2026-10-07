jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success' },
}));
const mockFetcher = jest.fn();
jest.mock('../../lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { queryKeys } from '../../lib/query-keys';
import { useUpdateUserPreferences } from '../use-update-user-preferences';

async function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: 0 }, mutations: { retry: false, gcTime: 0 } },
  });
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = await renderHook(() => useUpdateUserPreferences(), { wrapper });
  return { result, invalidate };
}

const invalidatedKeys = (invalidate: jest.SpyInstance) =>
  invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown }).queryKey);

beforeEach(() => {
  mockFetcher.mockReset();
  mockFetcher.mockResolvedValue({ updateUser: { id: 'u1' } });
});

describe('useUpdateUserPreferences', () => {
  it('refetches bikes after a unit change (00180 rewrites distance_unit)', async () => {
    const { result, invalidate } = await setup();
    await act(async () => result.current.update({ measurementSystem: 'imperial' }));
    await waitFor(() =>
      expect(invalidatedKeys(invalidate)).toContainEqual(queryKeys.motorcycles.all),
    );
  });

  it('leaves bikes alone for any other preference', async () => {
    const { result, invalidate } = await setup();
    await act(async () => result.current.update({ fullName: 'Rider' }));
    await waitFor(() => expect(invalidatedKeys(invalidate)).toContainEqual(queryKeys.user.me));
    expect(invalidatedKeys(invalidate)).not.toContainEqual(queryKeys.motorcycles.all);
  });
});
