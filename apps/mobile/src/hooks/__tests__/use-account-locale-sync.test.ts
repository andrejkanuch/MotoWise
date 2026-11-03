// The account's preferences.locale drives server-sent copy (pushes); the hook
// keeps it equal to the app language this device shows.

const mockGqlFetcher = jest.fn();
jest.mock('@/lib/graphql-client', () => ({
  gqlFetcher: (...a: unknown[]) => mockGqlFetcher(...a),
}));
jest.mock('@/lib/query-client', () => ({ queryClient: { invalidateQueries: jest.fn() } }));
jest.mock('@/lib/analytics', () => require('@/test/mocks').mockAnalytics());
const mockPreference = { locale: 'system' };
jest.mock('@/stores/auth.store', () => ({
  useAuthStore: (select: (s: typeof mockPreference) => unknown) => select(mockPreference),
}));
jest.mock('@/i18n', () => ({ applyLocalePreference: jest.fn() }));
jest.mock('@/i18n/locale', () => ({
  effectiveLocale: (p: string) => (p === 'system' ? 'pt-BR' : p),
}));

import { renderHook, waitFor } from '@testing-library/react-native';
import { useAccountLocaleSync } from '../use-account-locale-sync';

beforeEach(() => {
  mockGqlFetcher.mockReset().mockResolvedValue({});
  mockPreference.locale = 'system';
});

const savedLocales = () =>
  mockGqlFetcher.mock.calls.map(([, vars]) => vars.input.preferences.locale);

it('saves the resolved app language, never "system"', async () => {
  await renderHook(() => useAccountLocaleSync('u1', { locale: 'en' }));
  await waitFor(() => expect(savedLocales()).toEqual(['pt-BR']));
});

it('does nothing before the account has loaded or when it already matches', async () => {
  await renderHook(() => useAccountLocaleSync('u1', undefined));
  await renderHook(() => useAccountLocaleSync(undefined, {}));
  await renderHook(() => useAccountLocaleSync('u1', { locale: 'pt-BR' }));
  expect(mockGqlFetcher).not.toHaveBeenCalled();
});

it('tries once per locale, so a failing write does not loop', async () => {
  mockGqlFetcher.mockRejectedValue(new Error('offline'));
  const { rerender } = await renderHook(({ prefs }) => useAccountLocaleSync('u1', prefs), {
    initialProps: { prefs: {} as Record<string, unknown> },
  });
  await rerender({ prefs: { other: true } });
  await waitFor(() => expect(mockGqlFetcher).toHaveBeenCalledTimes(1));
});
