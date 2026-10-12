// Notifications' "Talk to the developer" group: every change writes the whole
// feedbackContact object through UpdateUser; failures roll back with a message.
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 54, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('@/utils/haptics', () => ({
  triggerImpact: jest.fn(),
  triggerNotification: jest.fn(),
  triggerSelection: jest.fn(),
}));
jest.mock('react-native-mmkv', () => require('@/test/mocks').makeMmkvMock());
jest.mock('@/lib/analytics', () => require('@/test/mocks').mockAnalytics());
jest.mock('posthog-react-native', () => ({
  PostHogMaskView: ({ children }: { children: unknown }) => children,
}));
jest.mock('@/components/ui/native-toggle', () => {
  const { Pressable } = require('react-native');
  return {
    NativeToggle: ({
      value,
      onValueChange,
    }: {
      value: boolean;
      onValueChange: (v: boolean) => void;
    }) => (
      <Pressable
        testID="toggle"
        accessibilityRole="switch"
        accessibilityState={{ checked: value }}
        onPress={() => onValueChange(!value)}
      />
    ),
  };
});
jest.mock('@/lib/query-options', () => {
  const { MeDocument } = require('@motovault/graphql');
  return {
    meOptions: () => ({ queryKey: ['user', 'me'], queryFn: () => mockFetcher(MeDocument) }),
  };
});

const mockFetcher = jest.fn();
jest.mock('@/lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));

import { MeDocument, UpdateUserDocument } from '@motovault/graphql';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import '@/i18n';
import { FeedbackContactGroup } from '../feedback-contact-group';

const STORED_ON = {
  enabled: true,
  email: null,
  decidedAt: '2026-10-01T10:00:00.000Z',
  wordingVersion: 1,
  locale: 'en',
  source: 'form',
};

let preferences: Record<string, unknown>;
let updateImpl: () => Promise<unknown>;

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

async function renderGroup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  await render(
    <QueryClientProvider client={client}>
      <FeedbackContactGroup />
    </QueryClientProvider>,
  );
  await flush();
}

function sentContacts() {
  return mockFetcher.mock.calls
    .filter(([doc]) => doc === UpdateUserDocument)
    .map(
      ([, vars]) =>
        (vars as { input: { preferences: { feedbackContact: Record<string, unknown> } } }).input
          .preferences.feedbackContact,
    );
}

beforeEach(() => {
  mockFetcher.mockReset();
  preferences = {};
  updateImpl = () => Promise.resolve({ updateUser: { id: 'user-1' } });
  mockFetcher.mockImplementation((doc: unknown) => {
    if (doc === MeDocument) {
      return Promise.resolve({ me: { id: 'user-1', email: 'rider@gmail.com', preferences } });
    }
    if (doc === UpdateUserDocument) return updateImpl();
    return Promise.reject(new Error('unexpected document'));
  });
});

describe('Talk to the developer (Notifications)', () => {
  it('turning it on writes the whole object from Notifications', async () => {
    await renderGroup();
    await fireEvent.press(screen.getByTestId('toggle'));
    await flush();

    expect(sentContacts()).toEqual([
      {
        enabled: true,
        email: null,
        decidedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        wordingVersion: 1,
        locale: 'en',
        source: 'notifications',
      },
    ]);
  });

  it('two quick toggles send the latest value last', async () => {
    await renderGroup();
    await fireEvent.press(screen.getByTestId('toggle'));
    await fireEvent.press(screen.getByTestId('toggle'));
    await flush();

    expect(sentContacts().map((c) => c.enabled)).toEqual([true, false]);
    expect(screen.getByTestId('toggle').props.accessibilityState.checked).toBe(false);
  });

  it('waits for the first write before sending the second, so the server ends on the latest value', async () => {
    let releaseFirst: (value: unknown) => void = () => {};
    updateImpl = () =>
      new Promise((resolve) => {
        releaseFirst = resolve;
      });
    await renderGroup();
    await fireEvent.press(screen.getByTestId('toggle'));
    await fireEvent.press(screen.getByTestId('toggle'));
    await flush();
    expect(sentContacts().map((c) => c.enabled)).toEqual([true]);

    updateImpl = () => Promise.resolve({ updateUser: { id: 'user-1' } });
    await act(async () => releaseFirst({ updateUser: { id: 'user-1' } }));
    await flush();
    expect(sentContacts().map((c) => c.enabled)).toEqual([true, false]);
  });

  it('a failed save puts the toggle back and says so', async () => {
    updateImpl = () => Promise.reject(new Error('Network request failed'));
    await renderGroup();
    await fireEvent.press(screen.getByTestId('toggle'));
    await flush();

    expect(screen.getByTestId('toggle').props.accessibilityState.checked).toBe(false);
    expect(screen.getByTestId('notifications-feedback-error')).toHaveTextContent(
      "Couldn't save that change. Check your connection and try again.",
    );
  });

  it('saves an edited email and keeps the opt-in on', async () => {
    preferences = { feedbackContact: STORED_ON };
    await renderGroup();
    await fireEvent.press(screen.getByTestId('notifications-feedback-email'));
    await fireEvent.changeText(screen.getByTestId('contact-email-input'), 'me@proton.me');
    await fireEvent.press(screen.getByTestId('contact-email-save'));
    await flush();

    expect(sentContacts()).toEqual([
      expect.objectContaining({ enabled: true, email: 'me@proton.me', source: 'notifications' }),
    ]);
    expect(screen.queryByTestId('contact-email-input')).toBeNull();
  });

  it('clearing the email saves null (use the account email)', async () => {
    preferences = { feedbackContact: { ...STORED_ON, email: 'old@proton.me' } };
    await renderGroup();
    await fireEvent.press(screen.getByTestId('notifications-feedback-email'));
    expect(screen.getByTestId('contact-email-input').props.value).toBe('old@proton.me');
    await fireEvent.changeText(screen.getByTestId('contact-email-input'), '');
    await fireEvent.press(screen.getByTestId('contact-email-save'));
    await flush();

    expect(sentContacts()).toEqual([expect.objectContaining({ enabled: true, email: null })]);
  });

  it('an address with a newline shows an error and the sheet stays open', async () => {
    preferences = { feedbackContact: STORED_ON };
    await renderGroup();
    await fireEvent.press(screen.getByTestId('notifications-feedback-email'));
    await fireEvent.changeText(screen.getByTestId('contact-email-input'), 'me@proton.me\nx');
    await fireEvent.press(screen.getByTestId('contact-email-save'));
    await flush();

    expect(sentContacts()).toEqual([]);
    expect(screen.getByTestId('contact-email-error')).toHaveTextContent(
      "That email doesn't look right. Check it and try again.",
    );
    expect(screen.getByTestId('contact-email-input')).toBeTruthy();
  });
});
