jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 54, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('../../../lib/analytics', () => require('../../../test/mocks').mockAnalytics());
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}));

const mockRouter = { back: jest.fn(), push: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
}));
type PreventCallback = (options: { data: { action: { type: string } } }) => void;
const mockPreventRemove: { prevent: boolean; callback: PreventCallback | null } = {
  prevent: false,
  callback: null,
};
const mockDispatch = jest.fn();
jest.mock('expo-router/react-navigation', () => ({
  useNavigation: () => ({ dispatch: mockDispatch }),
  usePreventRemove: (prevent: boolean, callback: PreventCallback) => {
    mockPreventRemove.prevent = prevent;
    mockPreventRemove.callback = callback;
  },
}));

interface MockDatePickerProps {
  selection: Date;
  onDateChange: (date: Date) => void;
}
let mockDatePicker: MockDatePickerProps | null = null;
jest.mock('@expo/ui/swift-ui', () => ({
  Host: ({ children }: { children: unknown }) => children,
  DatePicker: (props: MockDatePickerProps) => {
    mockDatePicker = props;
    return null;
  },
}));
jest.mock('@expo/ui/swift-ui/modifiers', () => ({
  datePickerStyle: () => ({}),
  environment: () => ({}),
  labelsHidden: () => ({}),
  tint: () => ({}),
}));
// The Android date dialog is never opened here (the iOS picker is driven instead).
jest.mock('@expo/ui/community/datetime-picker', () => ({
  __esModule: true,
  default: () => null,
}));

/**
 * `process.env.EXPO_OS` is inlined at build time, so the platform is switched
 * through the guard's platform set: emptied, a POP means "already dismissed"
 * exactly as on Android.
 */
const mockGuardPlatforms = new Set<string>(['ios']);
// A live getter: the factory runs before this file's constants are initialised
// (an object-literal getter would be evaluated once, by the spread helper).
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

const mockFetcher = jest.fn();
jest.mock('../../../lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));

import {
  LogOdometerReadingDocument,
  OdometerReadingsDocument,
  PendingRideDistanceDocument,
} from '@motovault/graphql';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useState } from 'react';
import { Alert, type AlertButton } from 'react-native';
import '../../../i18n';
import { useSheetDraftStore } from '../../../stores/sheet-draft.store';
import { BIKE_A, TODAY } from '../../../test/bike-hub-fixtures';
import { OdometerSheet } from '../sheets/odometer-sheet';
import { useDiscardReadingGuard } from '../sheets/use-log-odometer';
import type { HubBike } from '../shell/use-bike-hub-data';

/**
 * Android's draggable form sheet ignores `preventNativeDismiss`: a drag-down
 * reaches the guard as a POP for a sheet that is already gone. The reading is
 * parked instead of lost, and offered back when the sheet opens again.
 */
const POP = { type: 'POP' };
const GO_BACK = { type: 'GO_BACK' };
const PICKED = new Date(2026, 8, 20);
const alertButtons = (alert: jest.SpyInstance): AlertButton[] =>
  (alert.mock.calls[0]?.[2] as AlertButton[] | undefined) ?? [];

/** The route, minus `useHubBike`: the sheet wired to the real discard guard. */
function Route() {
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const guard = useDiscardReadingGuard(dirty, saving);
  return (
    <OdometerSheet
      bike={BIKE_A as unknown as HubBike}
      onClose={guard.closeAfterSave}
      onCancel={guard.cancel}
      onDirtyChange={setDirty}
      onSavingChange={setSaving}
      exit={guard.exit}
      now={TODAY}
    />
  );
}

async function renderRoute() {
  mockFetcher.mockImplementation((document: unknown) => {
    if (document === OdometerReadingsDocument) return Promise.resolve({ odometerReadings: [] });
    if (document === PendingRideDistanceDocument) {
      return Promise.resolve({ pendingRideDistance: { rideCount: 0, distance: 0 } });
    }
    if (document === LogOdometerReadingDocument) {
      return Promise.resolve({ logOdometerReading: { id: 'reading-1' } });
    }
    return Promise.resolve(undefined);
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const view = await render(
    <QueryClientProvider client={client}>
      <Route />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(client.isFetching()).toBe(0));
  return view;
}

/** Above any last reading, so Save goes straight through. */
async function typeReading() {
  for (let digit = 0; digit < 6; digit += 1) await fireEvent.press(screen.getByTestId('key-9'));
}

/** What a drag-down does on Android: a POP the guard lets through, then the sheet unmounts. */
async function dragDown(view: { unmount: () => void }) {
  await act(async () => mockPreventRemove.callback?.({ data: { action: POP } }));
  expect(mockDispatch).toHaveBeenCalledWith(POP);
  await act(async () => view.unmount());
}

/** Opens the sheet, types a reading and drags the sheet away. */
async function leaveTypedReading() {
  const view = await renderRoute();
  await typeReading();
  await dragDown(view);
}

const parked = () => useSheetDraftStore.getState().readings[BIKE_A.id];

beforeEach(() => {
  jest.clearAllMocks();
  useSheetDraftStore.setState({ notes: {}, readings: {} });
  mockPreventRemove.prevent = false;
  mockPreventRemove.callback = null;
  mockDatePicker = null;
});
afterEach(() => {
  asIos();
  jest.restoreAllMocks();
});

describe('Odometer sheet — Android drag-down keeps the reading', () => {
  beforeEach(asAndroid);

  it('parks the typed reading and picked date, and restores them with a notice', async () => {
    const view = await renderRoute();
    expect(screen.queryByTestId('odometer-restored')).toBeNull();
    await typeReading();
    await act(async () => mockDatePicker?.onDateChange(PICKED));
    await dragDown(view);
    expect(parked()).toEqual({
      digits: '999999',
      pickedDate: PICKED.getTime(),
      usedQuickAdd: false,
    });

    await renderRoute();
    expect(screen.getByTestId('odometer-entry')).toHaveTextContent('999,999');
    expect(screen.getByText('Restored your reading')).toBeTruthy();
    expect(mockDatePicker?.selection).toEqual(PICKED);
    // Restored work is unsaved work: the guard is on again.
    expect(mockPreventRemove.prevent).toBe(true);
  });

  it('Clear empties the entry and the store, and hides the notice', async () => {
    await leaveTypedReading();
    await renderRoute();
    await fireEvent.press(screen.getByTestId('odometer-restored-clear'));
    expect(screen.queryByTestId('odometer-restored')).toBeNull();
    expect(screen.getByTestId('odometer-entry')).toHaveTextContent('— — —');
    expect(parked()).toBeUndefined();
  });

  it('Cancel → Discard clears the parked reading', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await leaveTypedReading();
    const view = await renderRoute();
    await fireEvent.press(screen.getByTestId('odometer-cancel'));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    // The Cancel's back() is held by the guard and asked about.
    await act(async () => mockPreventRemove.callback?.({ data: { action: GO_BACK } }));
    await act(async () => alertButtons(alert)[1]?.onPress?.());
    expect(mockDispatch).toHaveBeenLastCalledWith(GO_BACK);
    await act(async () => view.unmount());
    expect(parked()).toBeUndefined();
  });

  it('a saved reading clears the parked one', async () => {
    await leaveTypedReading();
    const view = await renderRoute();
    await waitFor(() => expect(screen.getByTestId('odometer-save')).toBeEnabled());
    await fireEvent.press(screen.getByTestId('odometer-save'));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalledTimes(1));
    expect(parked()).toBeUndefined();
    await act(async () => view.unmount());
    expect(parked()).toBeUndefined();
  });

  it('dragged away mid-save: parked, then cleared when the save lands', async () => {
    const view = await renderRoute();
    let release: () => void = () => {};
    const answer = mockFetcher.getMockImplementation();
    mockFetcher.mockImplementation((document: unknown, variables: unknown) =>
      document === LogOdometerReadingDocument
        ? new Promise((resolve) => {
            release = () => resolve({ logOdometerReading: { id: 'reading-1' } });
          })
        : answer?.(document, variables),
    );
    await typeReading();
    await fireEvent.press(screen.getByTestId('odometer-save'));
    await dragDown(view);
    expect(parked()?.digits).toBe('999999');
    await act(async () => release());
    await waitFor(() => expect(parked()).toBeUndefined());
  });

  it('a clean sheet parks nothing', async () => {
    const view = await renderRoute();
    await act(async () => view.unmount());
    expect(parked()).toBeUndefined();
  });
});

describe('Odometer sheet — iOS is unchanged', () => {
  beforeEach(asIos);

  it('a swipe asks "Discard reading?"; Discard leaves nothing parked', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const view = await renderRoute();
    await typeReading();
    await act(async () => mockPreventRemove.callback?.({ data: { action: POP } }));
    expect(alert).toHaveBeenCalledWith(
      'Discard reading?',
      "The number you typed won't be saved.",
      expect.any(Array),
    );
    expect(mockDispatch).not.toHaveBeenCalled();
    await act(async () => alertButtons(alert)[1]?.onPress?.());
    expect(mockDispatch).toHaveBeenCalledTimes(1);
    await act(async () => view.unmount());
    expect(parked()).toBeUndefined();
  });
});
