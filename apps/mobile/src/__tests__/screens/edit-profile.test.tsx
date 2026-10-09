// Lives outside src/app on purpose: expo-router turns every file under src/app
// into a route, so a test there would be bundled into the app as a screen.
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));
jest.mock('nativewind', () => ({
  ...jest.requireActual('nativewind'),
  useColorScheme: () => ({ colorScheme: 'dark' }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 54, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('../../utils/haptics', () => ({
  triggerImpact: jest.fn(),
  triggerNotification: jest.fn(),
  triggerSelection: jest.fn(),
}));
jest.mock('../../lib/analytics', () => require('../../test/mocks').mockAnalytics());
jest.mock('../../components/ui/native-toggle', () => {
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

// The header's Save button is rendered through Stack.Screen options.
const mockRouter = { back: jest.fn() };
jest.mock('expo-router', () => ({
  // A getter: the factory runs before `mockRouter` is initialised.
  get router() {
    return mockRouter;
  },
  useNavigation: () => ({ dispatch: jest.fn() }),
  Stack: {
    Screen: ({ options }: { options?: { headerRight?: () => React.ReactNode } }) =>
      options?.headerRight?.() ?? null,
  },
}));
jest.mock('expo-router/react-navigation', () => ({ usePreventRemove: jest.fn() }));

type MockUser = {
  publicUsername: string | null;
  displayName: string | null;
  bio: string | null;
  city: string | null;
  isPublic: boolean;
  fullName: string | null;
  preferences: { experienceLevel?: string; ridingGoals?: string[] } | null;
};
let mockUser: MockUser;
jest.mock('../../lib/query-options', () => ({
  meOptions: () => ({ queryKey: ['me'], queryFn: async () => ({ me: mockUser }) }),
}));

const mockGqlFetcher = jest.fn();
jest.mock('../../lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockGqlFetcher(...args),
}));

import { UpdateMyProfileDocument, UpdateUserDocument } from '@motovault/graphql';
import { USERNAME_MAX_LENGTH } from '@motovault/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import EditProfileScreen from '../../app/(tabs)/(profile)/edit-profile';

function callsTo(document: unknown) {
  return mockGqlFetcher.mock.calls.filter(([doc]) => doc === document);
}

async function renderScreen() {
  // gcTime: Infinity schedules no garbage-collection timer, so Jest can exit.
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
  await render(
    <QueryClientProvider client={client}>
      <EditProfileScreen />
    </QueryClientProvider>,
  );
  await screen.findByTestId('edit-profile-full-name');
}

async function save() {
  await fireEvent.press(screen.getByTestId('edit-profile-save'));
}

let alertSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = {
    publicUsername: 'rider_one',
    displayName: null,
    bio: null,
    city: null,
    isPublic: false,
    fullName: 'Jane Rider',
    preferences: { experienceLevel: 'beginner', ridingGoals: [] },
  };
  mockGqlFetcher.mockResolvedValue({});
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  alertSpy.mockRestore();
});

describe('EditProfileScreen', () => {
  it('saves a trimmed name, then leaves without an unsaved-changes state', async () => {
    await renderScreen();
    await fireEvent.changeText(screen.getByTestId('edit-profile-full-name'), 'Jane Doe ');
    await save();

    await waitFor(() => expect(mockRouter.back).toHaveBeenCalledTimes(1));
    expect(callsTo(UpdateUserDocument)).toEqual([
      [UpdateUserDocument, { input: { fullName: 'Jane Doe' } }],
    ]);
    expect(callsTo(UpdateMyProfileDocument)).toHaveLength(0);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('a trailing space alone is not a change', async () => {
    await renderScreen();
    await fireEvent.changeText(screen.getByTestId('edit-profile-full-name'), 'Jane Rider ');
    await save();
    expect(mockGqlFetcher).not.toHaveBeenCalled();
  });

  it('going public never copies the private name into the public display name', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByTestId('toggle'));
    await save();

    await waitFor(() => expect(callsTo(UpdateMyProfileDocument)).toHaveLength(1));
    const [, { input }] = callsTo(UpdateMyProfileDocument)[0] as [
      unknown,
      { input: Record<string, unknown> },
    ];
    expect(input).toEqual({ isPublic: true });
    expect(input).not.toHaveProperty('displayName');
  });

  it('partial failure: names what saved, keeps the saved half as the baseline, stays on screen', async () => {
    mockGqlFetcher.mockImplementation(async (doc: unknown) => {
      if (doc === UpdateUserDocument) throw new Error('boom');
      return {};
    });
    await renderScreen();
    await fireEvent.press(screen.getByTestId('toggle'));
    await fireEvent.changeText(screen.getByTestId('edit-profile-full-name'), 'Jane Doe');
    await save();

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    expect(alertSpy.mock.calls[0]?.[0]).toBe('community.partialSaveTitle');
    expect(alertSpy.mock.calls[0]?.[1]).toContain('community.partialSavePublicSaved');
    expect(mockRouter.back).not.toHaveBeenCalled();

    // Saving again only retries the half that failed.
    mockGqlFetcher.mockClear();
    mockGqlFetcher.mockResolvedValue({});
    await save();
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalledTimes(1));
    expect(callsTo(UpdateMyProfileDocument)).toHaveLength(0);
    expect(callsTo(UpdateUserDocument)).toEqual([
      [UpdateUserDocument, { input: { fullName: 'Jane Doe' } }],
    ]);
  });

  it('username check matches the server: 3-20 characters, reserved names rejected', async () => {
    await renderScreen();
    const field = screen.getByTestId('edit-profile-username');
    expect(field.props.maxLength).toBe(USERNAME_MAX_LENGTH);

    await fireEvent.changeText(field, 'admin');
    await waitFor(() => expect(screen.getByText('community.usernameInvalid')).toBeTruthy(), {
      timeout: 2000,
    });

    await fireEvent.changeText(field, 'a'.repeat(USERNAME_MAX_LENGTH + 1));
    await waitFor(() => expect(screen.getByText('community.usernameInvalid')).toBeTruthy(), {
      timeout: 2000,
    });

    await fireEvent.changeText(field, 'new_rider');
    await waitFor(() => expect(screen.queryByText('community.usernameInvalid')).toBeNull(), {
      timeout: 2000,
    });
  });

  it('total failure shows the error and saves nothing as the baseline', async () => {
    mockGqlFetcher.mockRejectedValue(new Error('offline'));
    await renderScreen();
    await fireEvent.changeText(screen.getByTestId('edit-profile-full-name'), 'Jane Doe');
    await save();

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    expect(alertSpy.mock.calls[0]?.[0]).toBe('common.error');
    expect(mockRouter.back).not.toHaveBeenCalled();
  });
});
