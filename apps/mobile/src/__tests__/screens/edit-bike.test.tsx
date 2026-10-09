// Lives outside src/app on purpose: expo-router turns every file under src/app
// into a route, so a test there would be bundled into the app as a screen.
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 54, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('react-native-mmkv', () => require('../../test/mocks').makeMmkvMock());
jest.mock('../../utils/haptics', () => ({
  triggerImpact: jest.fn(),
  triggerNotification: jest.fn(),
  triggerSelection: jest.fn(),
}));
jest.mock('../../lib/analytics', () => require('../../test/mocks').mockAnalytics());
jest.mock('../../hooks/use-currency', () => ({ useCurrency: () => ({ symbol: '€' }) }));
jest.mock('../../hooks/use-mileage-unit', () => ({ useMileageUnit: () => 'km' }));
jest.mock('../../lib/store-review', () => ({
  maybeRequestReview: jest.fn(),
  REVIEW_MILESTONE: { BIKE_EDITED: 'bike_edited' },
}));
jest.mock('../../lib/notifications', () => ({
  cancelDocumentNotificationsForBike: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../lib/image-upload', () => ({
  pickImage: jest.fn(),
  takePhoto: jest.fn(),
  uploadBikePhoto: jest.fn(),
}));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('posthog-react-native', () => ({
  PostHogMaskView: ({ children }: { children: unknown }) => children,
}));
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

let mockParams: Record<string, string | undefined> = {};
const mockRouter = { back: jest.fn(), dismiss: jest.fn() };
jest.mock('expo-router', () => ({
  // A getter: the factory runs before `mockRouter` is initialised.
  get router() {
    return mockRouter;
  },
  useLocalSearchParams: () => mockParams,
}));

// The unsaved-work guard, captured per render.
type PreventCallback = (options: { data: { action: { type: string } } }) => void;
const mockPreventRemove: { prevent: boolean; callback: PreventCallback | null } = {
  prevent: false,
  callback: null,
};
const mockNavigation = { dispatch: jest.fn(), setOptions: jest.fn() };
jest.mock('expo-router/react-navigation', () => ({
  useNavigation: () => mockNavigation,
  usePreventRemove: (prevent: boolean, callback: PreventCallback) => {
    mockPreventRemove.prevent = prevent;
    mockPreventRemove.callback = callback;
  },
}));

const mockFetcher = jest.fn();
jest.mock('../../lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));

import {
  DeleteMotorcycleDocument,
  MotorcycleMakesDocument,
  MotorcycleModelsDocument,
  MyMotorcyclesDocument,
  UpdateMotorcycleDocument,
} from '@motovault/graphql';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';
import '../../i18n';
import EditBikeScreen from '../../app/(tabs)/(garage)/edit-bike';
import { queryKeys } from '../../lib/query-keys';

const BIKE_ID = 'bike-a';
const HONDA = { makeId: 474, makeName: 'Honda' };
const AFRICA_TWIN = { modelId: 10, modelName: 'Africa Twin' };
const BIKE = {
  id: BIKE_ID,
  nickname: 'Twin',
  year: 2022,
  make: HONDA.makeName,
  model: AFRICA_TWIN.modelName,
  currentMileage: 12000,
  isPrimary: true,
  primaryPhotoUrl: null,
  purchasePrice: null,
  vin: null,
  variant: null,
};
const BIKE_NAME = `${BIKE.year} ${BIKE.make} ${BIKE.model}`;
const ACTION = { type: 'GO_BACK' };

const TEST_ID = {
  NICKNAME: 'edit-bike-nickname',
  SAVE: 'edit-bike-save',
  DELETE: 'edit-bike-delete',
} as const;

interface Deferred {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

/** The pending DeleteMotorcycle request, settled by the test. */
let pendingDelete: Deferred | null = null;

function serve() {
  mockFetcher.mockImplementation((document: unknown) => {
    if (document === MyMotorcyclesDocument) return Promise.resolve({ myMotorcycles: [BIKE] });
    if (document === MotorcycleMakesDocument) {
      return Promise.resolve({ motorcycleMakes: [HONDA] });
    }
    if (document === MotorcycleModelsDocument) {
      return Promise.resolve({ motorcycleModels: [AFRICA_TWIN] });
    }
    if (document === UpdateMotorcycleDocument) {
      return Promise.resolve({ updateMotorcycle: { id: BIKE_ID } });
    }
    if (document === DeleteMotorcycleDocument) {
      return new Promise((resolve, reject) => {
        pendingDelete = { resolve, reject };
      });
    }
    return Promise.resolve(undefined);
  });
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

async function renderScreen() {
  mockParams = { id: BIKE_ID };
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
    },
  });
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  await render(
    <QueryClientProvider client={client}>
      <EditBikeScreen />
    </QueryClientProvider>,
  );
  await flush();
  return { client, invalidate };
}

/** The footer's Cancel button (the delete confirmation is mocked, so it is the only one). */
function cancelButton() {
  return screen.getByRole('button', { name: 'Cancel' });
}

/** The rider swipes the sheet down (or taps back): what the guard does with it. */
async function attemptDismiss() {
  await act(async () => {
    if (mockPreventRemove.prevent) mockPreventRemove.callback?.({ data: { action: ACTION } });
  });
}

beforeEach(() => {
  pendingDelete = null;
  mockPreventRemove.prevent = false;
  mockPreventRemove.callback = null;
  serve();
});

afterEach(async () => {
  onlineManager.setOnline(true);
  await flush();
  jest.restoreAllMocks();
  mockFetcher.mockReset();
  mockRouter.back.mockReset();
  mockRouter.dismiss.mockReset();
  mockNavigation.dispatch.mockReset();
  mockNavigation.setOptions.mockReset();
});

describe('Edit Motorcycle — unsaved changes guard', () => {
  it('lets an untouched sheet close without asking', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderScreen();
    expect(screen.getByTestId(TEST_ID.NICKNAME).props.value).toBe('Twin');

    await attemptDismiss();

    expect(mockPreventRemove.prevent).toBe(false);
    expect(alert).not.toHaveBeenCalled();
  });

  it('asks before discarding an edit, and leaves on Discard', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderScreen();
    await fireEvent.changeText(screen.getByTestId(TEST_ID.NICKNAME), 'Big Twin');

    await attemptDismiss();

    expect(alert).toHaveBeenCalledWith('Discard changes?', expect.any(String), expect.any(Array));
    const buttons = alert.mock.calls.at(-1)?.[2] as AlertButton[];
    await act(async () => {
      buttons.find((button) => button.style === 'destructive')?.onPress?.();
    });
    expect(mockNavigation.dispatch).toHaveBeenCalledWith(ACTION);
  });

  it('does not ask after a save, and closes the sheet', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { invalidate } = await renderScreen();
    await fireEvent.changeText(screen.getByTestId(TEST_ID.NICKNAME), 'Big Twin');
    expect(mockPreventRemove.prevent).toBe(true);

    await fireEvent.press(screen.getByTestId(TEST_ID.SAVE));
    await flush();

    expect(mockFetcher).toHaveBeenCalledWith(
      UpdateMotorcycleDocument,
      expect.objectContaining({
        id: BIKE_ID,
        input: expect.objectContaining({ nickname: 'Big Twin' }),
      }),
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.motorcycles.all });
    expect(mockPreventRemove.prevent).toBe(false);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    await attemptDismiss();
    expect(alert).not.toHaveBeenCalled();
  });
});

describe('Edit Motorcycle — delete', () => {
  /** Opens the delete confirmation and confirms it (iOS: typed name; Android: a button). */
  async function confirmDelete() {
    const prompt = jest.spyOn(Alert, 'prompt').mockImplementation(() => {});
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await fireEvent.press(screen.getByTestId(TEST_ID.DELETE));
    const isIos = process.env.EXPO_OS === 'ios';
    const calls = isIos ? prompt.mock.calls : alert.mock.calls;
    const buttons = calls.at(-1)?.[2] as AlertButton[];
    const destructive = buttons.find((button) => button.style === 'destructive');
    await act(async () => {
      (destructive?.onPress as ((value?: string) => void) | undefined)?.(
        isIos ? BIKE_NAME : undefined,
      );
    });
    await flush();
  }

  it('deletes after the confirmation, then closes the sheet and the bike screen', async () => {
    const { invalidate } = await renderScreen();

    await confirmDelete();
    expect(mockFetcher).toHaveBeenCalledWith(DeleteMotorcycleDocument, { id: BIKE_ID });

    await act(async () => {
      pendingDelete?.resolve({ deleteMotorcycle: true });
    });
    await flush();

    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.motorcycles.all });
    expect(mockRouter.dismiss).toHaveBeenCalledWith(2);
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('holds the sheet while the delete is in flight', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderScreen();

    await confirmDelete();
    alert.mockClear();

    // Swipe-down / back / Cancel while deleting: held, silently, with the gesture off.
    expect(mockPreventRemove.prevent).toBe(true);
    expect(mockNavigation.setOptions).toHaveBeenLastCalledWith({ gestureEnabled: false });
    expect(cancelButton()).toBeDisabled();
    await attemptDismiss();
    expect(alert).not.toHaveBeenCalled();
    expect(mockNavigation.dispatch).not.toHaveBeenCalled();

    await act(async () => {
      pendingDelete?.resolve({ deleteMotorcycle: true });
    });
    await flush();

    expect(mockPreventRemove.prevent).toBe(false);
    expect(mockRouter.dismiss).toHaveBeenCalledWith(2);
  });

  it('releases the hold when the delete fails', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderScreen();

    await confirmDelete();
    expect(mockPreventRemove.prevent).toBe(true);
    expect(cancelButton()).toBeDisabled();

    await act(async () => {
      pendingDelete?.reject(new Error('Network request failed'));
    });
    await flush();

    expect(mockPreventRemove.prevent).toBe(false);
    expect(mockNavigation.setOptions).toHaveBeenLastCalledWith({ gestureEnabled: true });
    expect(cancelButton()).toBeEnabled();
    expect(mockRouter.dismiss).not.toHaveBeenCalled();
  });

  it('does not hold the sheet while an offline delete is paused, and finishes on reconnect', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderScreen();
    onlineManager.setOnline(false);

    await confirmDelete();

    // Parked by TanStack (pending + paused): the rider can still leave.
    expect(mockFetcher).not.toHaveBeenCalledWith(DeleteMotorcycleDocument, expect.anything());
    expect(mockPreventRemove.prevent).toBe(false);
    expect(mockNavigation.setOptions).toHaveBeenLastCalledWith({ gestureEnabled: true });
    expect(cancelButton()).toBeEnabled();

    // Back online, the queued delete runs and holds the sheet until it lands.
    await act(async () => {
      onlineManager.setOnline(true);
    });
    await flush();
    expect(mockFetcher).toHaveBeenCalledWith(DeleteMotorcycleDocument, { id: BIKE_ID });
    expect(mockPreventRemove.prevent).toBe(true);
    expect(cancelButton()).toBeDisabled();

    await act(async () => {
      pendingDelete?.resolve({ deleteMotorcycle: true });
    });
    await flush();
    expect(mockRouter.dismiss).toHaveBeenCalledWith(2);
  });

  it('on iOS, a mistyped name does not delete', async () => {
    if (process.env.EXPO_OS !== 'ios') return;
    const prompt = jest.spyOn(Alert, 'prompt').mockImplementation(() => {});
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderScreen();

    await fireEvent.press(screen.getByTestId(TEST_ID.DELETE));
    const buttons = prompt.mock.calls.at(-1)?.[2] as AlertButton[];
    await act(async () => {
      (buttons.find((button) => button.style === 'destructive')?.onPress as (v: string) => void)(
        'Honda',
      );
    });

    expect(alert).toHaveBeenCalledWith('Name does not match', expect.any(String));
    expect(mockFetcher).not.toHaveBeenCalledWith(DeleteMotorcycleDocument, expect.anything());
  });
});
