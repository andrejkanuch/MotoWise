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
interface MockDialogProps {
  value: Date;
  maximumDate?: Date;
  presentation?: string;
  onValueChange: (event: unknown, date: Date) => void;
  onDismiss: () => void;
}
let mockDialog: MockDialogProps | null = null;
jest.mock('@expo/ui/community/datetime-picker', () => ({
  __esModule: true,
  default: (props: MockDialogProps) => {
    mockDialog = props;
    return null;
  },
}));

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
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { Alert, type AlertButton, StyleSheet } from 'react-native';
import '../../../i18n';
import { BIKE_A, TODAY } from '../../../test/bike-hub-fixtures';
import { AndroidOdometerDateChip } from '../sheets/odometer-date-chip';
import { entryRuns, OdometerSheet } from '../sheets/odometer-sheet';
import { useDiscardReadingGuard } from '../sheets/use-log-odometer';
import { sheetAlreadyDismissed } from '../sheets/use-sheet-discard-guard';
import type { HubBike } from '../shell/use-bike-hub-data';

const POP = { type: 'POP' };
const alertButtons = (alert: jest.SpyInstance): AlertButton[] =>
  (alert.mock.calls[0]?.[2] as AlertButton[] | undefined) ?? [];

beforeEach(() => {
  jest.clearAllMocks();
  mockPreventRemove.prevent = false;
  mockPreventRemove.callback = null;
  mockDatePicker = null;
  mockDialog = null;
});
afterEach(() => jest.restoreAllMocks());

describe('useDiscardReadingGuard (iOS form sheet)', () => {
  it('nothing typed: no guard, Cancel leaves with one router.back()', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { result } = await renderHook(() => useDiscardReadingGuard(false));
    expect(mockPreventRemove.prevent).toBe(false);
    await act(async () => result.current.cancel());
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(alert).not.toHaveBeenCalled();
  });

  it('something typed: the native dismiss is prevented (swipe-down springs back)', async () => {
    await renderHook(() => useDiscardReadingGuard(true));
    expect(mockPreventRemove.prevent).toBe(true);
  });

  it('a prevented swipe or Cancel asks "Discard reading?"; Discard leaves with exactly one navigation action', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { result } = await renderHook(() => useDiscardReadingGuard(true));
    // Cancel goes through router.back(), which the guard holds back natively…
    await act(async () => result.current.cancel());
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    // …and hands the held pop to the callback.
    await act(async () => mockPreventRemove.callback?.({ data: { action: POP } }));
    expect(alert).toHaveBeenCalledWith(
      'Discard reading?',
      "The number you typed won't be saved.",
      expect.any(Array),
    );
    const buttons = alertButtons(alert);
    expect(buttons.map((button) => [button.text, button.style])).toEqual([
      ['Keep editing', 'cancel'],
      ['Discard', 'destructive'],
    ]);
    await act(async () => buttons[1]?.onPress?.());
    // The held pop is re-dispatched once; no second back().
    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatch).toHaveBeenCalledWith(POP);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('Keep editing stays on the sheet', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderHook(() => useDiscardReadingGuard(true));
    await act(async () => mockPreventRemove.callback?.({ data: { action: POP } }));
    await act(async () => alertButtons(alert)[0]?.onPress?.());
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('after a save the sheet closes without asking', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { result } = await renderHook(() => useDiscardReadingGuard(true));
    await act(async () => result.current.closeAfterSave());
    await act(async () => mockPreventRemove.callback?.({ data: { action: POP } }));
    expect(alert).not.toHaveBeenCalled();
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockDispatch).toHaveBeenCalledTimes(1);
  });
});

describe('useDiscardReadingGuard — locked while the reading saves (#6)', () => {
  const GO_BACK = { type: 'GO_BACK' };

  it('a swipe during the save is held without "Discard reading?"', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderHook(() => useDiscardReadingGuard(true, true));
    expect(mockPreventRemove.prevent).toBe(true);
    await act(async () => mockPreventRemove.callback?.({ data: { action: POP } }));
    expect(alert).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('Cancel does nothing while saving', async () => {
    const { result } = await renderHook(() => useDiscardReadingGuard(true, true));
    await act(async () => result.current.cancel());
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('the save closing the sheet under an open prompt: Discard then does nothing', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { result } = await renderHook(() => useDiscardReadingGuard(true));
    await act(async () => mockPreventRemove.callback?.({ data: { action: GO_BACK } }));
    await act(async () => result.current.closeAfterSave());
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    await act(async () => alertButtons(alert)[1]?.onPress?.());
    // The stale action is never re-dispatched: no second back pops the hub.
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('a save that lands after the sheet is gone navigates nowhere', async () => {
    const { result, unmount } = await renderHook(() => useDiscardReadingGuard(true));
    const { closeAfterSave } = result.current;
    await act(async () => unmount());
    closeAfterSave();
    expect(mockRouter.back).not.toHaveBeenCalled();
  });
});

describe('useDiscardReadingGuard — system Back (one rule with the Note sheet)', () => {
  const GO_BACK = { type: 'GO_BACK' };

  it('Back with a typed reading asks first; Discard re-dispatches that Back once', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderHook(() => useDiscardReadingGuard(true));
    await act(async () => mockPreventRemove.callback?.({ data: { action: GO_BACK } }));
    expect(alert).toHaveBeenCalledTimes(1);
    await act(async () => alertButtons(alert)[1]?.onPress?.());
    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatch).toHaveBeenCalledWith(GO_BACK);
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('Back while saving is swallowed', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderHook(() => useDiscardReadingGuard(true, true));
    await act(async () => mockPreventRemove.callback?.({ data: { action: GO_BACK } }));
    expect(alert).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('a POP means "already dismissed" only where the sheet cannot refuse a swipe (Android)', () => {
    expect(sheetAlreadyDismissed(POP, 'android')).toBe(true);
    expect(sheetAlreadyDismissed(POP, 'ios')).toBe(false);
    expect(sheetAlreadyDismissed(GO_BACK, 'android')).toBe(false);
  });
});

describe('OdometerSheet — reports what the guard needs', () => {
  async function renderSheet(props: {
    onDirtyChange: jest.Mock;
    onCancel?: jest.Mock;
    onSavingChange?: jest.Mock;
  }) {
    mockFetcher.mockImplementation((document: unknown) => {
      if (document === OdometerReadingsDocument) return Promise.resolve({ odometerReadings: [] });
      if (document === PendingRideDistanceDocument) {
        return Promise.resolve({ pendingRideDistance: { rideCount: 0, distance: 0 } });
      }
      return Promise.resolve(undefined);
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    await render(
      <QueryClientProvider client={client}>
        <OdometerSheet
          bike={BIKE_A as unknown as HubBike}
          onClose={jest.fn()}
          now={TODAY}
          {...props}
        />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(client.isFetching()).toBe(0));
  }

  it('dirty once a digit is typed or a date picked; clean again when cleared', async () => {
    const onDirtyChange = jest.fn();
    await renderSheet({ onDirtyChange });
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    await fireEvent.press(screen.getByTestId('key-3'));
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    await fireEvent.press(screen.getByTestId('key-clear'));
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    await act(async () => mockDatePicker?.onDateChange(new Date(2026, 8, 1)));
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  });

  it('while saving: reports it, and the keypad, chips and date are locked', async () => {
    const onSavingChange = jest.fn();
    await renderSheet({ onDirtyChange: jest.fn(), onSavingChange });
    expect(onSavingChange).toHaveBeenLastCalledWith(false);
    let release: () => void = () => {};
    const answer = mockFetcher.getMockImplementation();
    mockFetcher.mockImplementation((document: unknown, variables: unknown) =>
      document === LogOdometerReadingDocument
        ? new Promise((resolve) => {
            release = () => resolve({ logOdometerReading: { id: 'reading-1' } });
          })
        : answer?.(document, variables),
    );
    // Above any last reading, so Save goes straight through.
    for (let digit = 0; digit < 6; digit += 1) await fireEvent.press(screen.getByTestId('key-9'));
    await fireEvent.press(screen.getByTestId('odometer-save'));
    await waitFor(() => expect(onSavingChange).toHaveBeenLastCalledWith(true));
    for (const id of ['key-1', 'key-clear', 'key-delete', 'chip-50', 'odometer-cancel']) {
      expect(screen.getByTestId(id)).toBeDisabled();
    }
    expect(screen.getByTestId('odometer-date-lock').props.accessibilityState).toEqual({
      disabled: true,
    });
    await fireEvent.press(screen.getByTestId('key-1'));
    expect(screen.getByTestId('odometer-entry')).toHaveTextContent('999,999');
    await act(async () => release());
    await waitFor(() => expect(onSavingChange).toHaveBeenLastCalledWith(false));
  });

  it('Cancel goes to the guard, not straight to close', async () => {
    const onCancel = jest.fn();
    await renderSheet({ onDirtyChange: jest.fn(), onCancel });
    await fireEvent.press(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Cancel leads the header (the sheet has its own Save), at least 44 pt tall', async () => {
    await renderSheet({ onDirtyChange: jest.fn() });
    const header = screen.getByRole('header');
    const row = header.parent;
    const first = row?.children[0];
    expect(typeof first === 'string' ? first : first?.props.testID).toBe('odometer-cancel');
    const cancel = screen.getByTestId('odometer-cancel');
    expect(StyleSheet.flatten(cancel.props.style).minHeight).toBeGreaterThanOrEqual(44);
  });
});

describe('AndroidOdometerDateChip', () => {
  it('reads "Today", opens the Material dialog over the sheet, and closes it on a pick', async () => {
    const onPick = jest.fn();
    await render(
      <AndroidOdometerDateChip value={TODAY} today={TODAY} label="Today" onPick={onPick} />,
    );
    const chip = screen.getByRole('button', { name: 'Reading date: Today' });
    expect(mockDialog).toBeNull();
    await fireEvent.press(chip);
    expect(mockDialog).toMatchObject({ presentation: 'dialog', maximumDate: TODAY, value: TODAY });
    const august = new Date(2026, 7, 1);
    await act(async () => mockDialog?.onValueChange({}, august));
    expect(onPick).toHaveBeenCalledWith(august);
  });

  it('a cancelled dialog keeps the date', async () => {
    const onPick = jest.fn();
    await render(
      <AndroidOdometerDateChip value={TODAY} today={TODAY} label="Today" onPick={onPick} />,
    );
    await fireEvent.press(screen.getByTestId('odometer-date'));
    await act(async () => mockDialog?.onDismiss());
    expect(onPick).not.toHaveBeenCalled();
  });
});

describe('entryRuns — the grouping separator sits close to its digits', () => {
  it.each([
    [
      '39,120',
      [
        { text: '3', tight: false },
        { text: '9,', tight: true },
        { text: '120', tight: false },
      ],
    ],
    [
      '39.120',
      [
        { text: '3', tight: false },
        { text: '9.', tight: true },
        { text: '120', tight: false },
      ],
    ],
    [
      '1,234,567',
      [
        { text: '1,', tight: true },
        { text: '23', tight: false },
        { text: '4,', tight: true },
        { text: '567', tight: false },
      ],
    ],
    ['950', [{ text: '950', tight: false }]],
  ])('%s', (text, runs) => {
    expect(entryRuns(text)).toEqual(runs);
    expect(
      entryRuns(text)
        .map((run) => run.text)
        .join(''),
    ).toBe(text);
  });
});
