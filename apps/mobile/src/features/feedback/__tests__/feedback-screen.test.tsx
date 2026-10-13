// "Write to the developer": what the form sends, what it keeps after a failed
// send, and how the contact email field starts.
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
jest.mock('expo-application', () => ({ nativeApplicationVersion: '3.25.0' }));
jest.mock('expo-updates', () => ({ updateId: 'update-1' }));

let mockUuidCounter = 0;
jest.mock('expo-crypto', () => ({
  randomUUID: () => {
    mockUuidCounter += 1;
    return `00000000-0000-4000-8000-00000000000${mockUuidCounter}`;
  },
}));

const mockRouter = { back: jest.fn() };
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
  Stack: {
    Screen: ({ options }: { options?: { headerRight?: () => React.ReactNode } }) =>
      options?.headerRight?.() ?? null,
  },
}));

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

import { MeDocument, SendFeedbackDocument } from '@motovault/graphql';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import '@/i18n';
import { FeedbackScreen } from '../feedback-screen';

const GMAIL = 'rider@gmail.com';
const RELAY = 'abc123@privaterelay.appleid.com';

let me: { email: string; preferences: Record<string, unknown> };
let sendImpl: () => Promise<unknown>;

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

async function renderForm() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  await render(
    <QueryClientProvider client={client}>
      <FeedbackScreen />
    </QueryClientProvider>,
  );
  await flush();
}

function sentInputs() {
  return mockFetcher.mock.calls
    .filter(([doc]) => doc === SendFeedbackDocument)
    .map(([, vars]) => (vars as { input: Record<string, unknown> }).input);
}

async function pressSend() {
  await fireEvent.press(screen.getByTestId('feedback-send'));
  await flush();
}

beforeEach(() => {
  mockUuidCounter = 0;
  mockFetcher.mockReset();
  mockRouter.back.mockReset();
  me = { email: GMAIL, preferences: {} };
  sendImpl = () => Promise.resolve({ sendFeedback: true });
  mockFetcher.mockImplementation((doc: unknown) => {
    if (doc === MeDocument) return Promise.resolve({ me: { id: 'user-1', ...me } });
    if (doc === SendFeedbackDocument) return sendImpl();
    return Promise.reject(new Error('unexpected document'));
  });
});

describe('Feedback form', () => {
  it('sends the quick pick, message and app context, then shows the sent state', async () => {
    await renderForm();
    await fireEvent.press(screen.getByTestId('feedback-quick-pick-broken'));
    await fireEvent.changeText(screen.getByTestId('feedback-message'), '  Map freezes  ');
    await pressSend();

    expect(sentInputs()).toEqual([
      {
        clientId: '00000000-0000-4000-8000-000000000001',
        message: 'Map freezes',
        quickPick: 'broken',
        platform: 'ios',
        appVersion: '3.25.0',
        updateId: 'update-1',
        locale: 'en',
        contactOptIn: false,
        contactWordingVersion: 1,
      },
    ]);
    expect(screen.getByTestId('feedback-sent')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('feedback-done'));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('keeps the text and the draft id after a failed send, and the retry reuses the id', async () => {
    sendImpl = () => Promise.reject(new Error('Network request failed'));
    await renderForm();
    await fireEvent.changeText(screen.getByTestId('feedback-message'), 'Love the flyover');
    await pressSend();

    expect(screen.getByTestId('feedback-send-error')).toHaveTextContent(
      "Couldn't send your message. Your text is still here, so try again in a moment.",
    );
    expect(screen.getByTestId('feedback-message').props.value).toBe('Love the flyover');

    sendImpl = () => Promise.resolve({ sendFeedback: true });
    await pressSend();

    const [first, retry] = sentInputs();
    expect(retry.clientId).toBe(first.clientId);
    expect(screen.getByTestId('feedback-sent')).toBeTruthy();
  });

  it('shows its own message when the send is throttled', async () => {
    sendImpl = () =>
      Promise.reject({
        response: {
          errors: [{ message: 'Too Many Requests', extensions: { code: 'TOO_MANY_REQUESTS' } }],
        },
      });
    await renderForm();
    await fireEvent.changeText(screen.getByTestId('feedback-message'), 'Hello');
    await pressSend();

    expect(screen.getByTestId('feedback-send-error')).toHaveTextContent(
      "You've sent a few messages in a short time. Please try again a little later.",
    );
  });

  it('disables Send while the message is empty or only whitespace', async () => {
    await renderForm();
    expect(screen.getByTestId('feedback-send')).toBeDisabled();

    await fireEvent.changeText(screen.getByTestId('feedback-message'), '   ');
    expect(screen.getByTestId('feedback-send')).toBeDisabled();
    await pressSend();
    expect(sentInputs()).toEqual([]);
  });

  it('prefills a regular account email when the rider opts in', async () => {
    await renderForm();
    await fireEvent.press(screen.getByTestId('feedback-contact-opt-in'));

    expect(screen.getByTestId('feedback-contact-email').props.value).toBe(GMAIL);
  });

  it('starts the email empty with relay help for a Hide My Email account', async () => {
    me = { email: RELAY, preferences: {} };
    await renderForm();
    await fireEvent.press(screen.getByTestId('feedback-contact-opt-in'));

    expect(screen.getByTestId('feedback-contact-email').props.value).toBe('');
    expect(screen.getByText(/Hide My Email/)).toBeTruthy();
  });

  it('sends an opt-in with the typed email', async () => {
    await renderForm();
    await fireEvent.press(screen.getByTestId('feedback-contact-opt-in'));
    await fireEvent.changeText(screen.getByTestId('feedback-contact-email'), 'me@proton.me');
    await fireEvent.changeText(screen.getByTestId('feedback-message'), 'Hi');
    await pressSend();

    expect(sentInputs()[0]).toMatchObject({ contactOptIn: true, contactEmail: 'me@proton.me' });
  });

  it('unticking hides the field and sends no contact email', async () => {
    me = {
      email: GMAIL,
      preferences: {
        feedbackContact: {
          enabled: true,
          email: 'old@proton.me',
          decidedAt: '2026-10-01T10:00:00.000Z',
          wordingVersion: 1,
          locale: 'en',
          source: 'notifications',
        },
      },
    };
    await renderForm();
    await fireEvent.changeText(screen.getByTestId('feedback-contact-email'), 'typed@proton.me');
    await fireEvent.press(screen.getByTestId('feedback-contact-opt-in'));
    expect(screen.queryByTestId('feedback-contact-email')).toBeNull();

    await fireEvent.changeText(screen.getByTestId('feedback-message'), 'Hi');
    await pressSend();

    const [input] = sentInputs();
    expect(input.contactOptIn).toBe(false);
    expect(input).not.toHaveProperty('contactEmail');
  });

  it('rejects an email with a line break inline and sends nothing', async () => {
    await renderForm();
    await fireEvent.press(screen.getByTestId('feedback-contact-opt-in'));
    await fireEvent.changeText(
      screen.getByTestId('feedback-contact-email'),
      'me@proton.me\nBcc: x@y.z',
    );
    await fireEvent.changeText(screen.getByTestId('feedback-message'), 'Hi');
    await pressSend();

    expect(screen.getByTestId('feedback-email-error')).toBeTruthy();
    expect(sentInputs()).toEqual([]);
  });
});
