jest.mock('react-native-mmkv', () => require('../../../test/mocks').makeMmkvMock());
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 54, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('../../../lib/analytics', () => require('../../../test/mocks').mockAnalytics());
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({
  // A getter: the factory runs at import time, before `mockRouter` is initialised.
  get router() {
    return mockRouter;
  },
  useLocalSearchParams: () => ({ motorcycleId: 'bike-a' }),
}));

// Each receipt renders as a marker, so a test can tell which one the sheet drew.
jest.mock('lucide-react-native', () => {
  const actual = jest.requireActual('lucide-react-native');
  const { Text } = jest.requireActual('react-native');
  const marker = (name: string) => () => <Text testID={`icon-${name}`}>{name}</Text>;
  return {
    ...actual,
    Receipt: marker('Receipt'),
    ReceiptEuro: marker('ReceiptEuro'),
    ReceiptPoundSterling: marker('ReceiptPoundSterling'),
    ReceiptText: marker('ReceiptText'),
  };
});

const mockFetcher = jest.fn();
jest.mock('../../../lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Dimensions, StyleSheet } from 'react-native';
import LogEntrySheet from '../../../app/(tabs)/(garage)/log-entry';
import '../../../i18n';
import { LOG_OPTION } from '../../../lib/bike-hub/constants';
import { useAuthStore } from '../../../stores/auth.store';
import { BIKE_A } from '../../../test/bike-hub-fixtures';
import { SHEET_BOTTOM_PADDING, SHEET_TOP_CLEARANCE } from '../sheets/sheet-scroll';

const clients: QueryClient[] = [];

async function renderSheet(bike: Record<string, unknown> = BIKE_A) {
  mockFetcher.mockResolvedValue({ myMotorcycles: [bike] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  await render(
    <QueryClientProvider client={client}>
      <LogEntrySheet />
    </QueryClientProvider>,
  );
  await screen.findByText(/^Log on the/);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});
afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
  jest.useRealTimers();
});

describe('Log sheet', () => {
  it('titles the sheet with the bike and lists the six options in order', async () => {
    await renderSheet();
    await act(async () => jest.advanceTimersByTimeAsync(0));
    expect(await screen.findByText('Log on the Africa Twin')).toBeOnTheScreen();
    expect(screen.getAllByTestId(/^log-option-/).map((row) => row.props.testID)).toEqual([
      'log-option-expense',
      'log-option-past_work',
      'log-option-odometer',
      'log-option-note',
      'log-option-task',
      'log-option-document',
    ]);
    // Planning reads as planning, not as one more thing to log.
    expect(screen.getByText('Plan a task')).toBeOnTheScreen();
    expect(screen.queryByText('Maintenance task')).toBeNull();
  });

  it('uses the nickname in quotes when the bike has one', async () => {
    await renderSheet({ ...BIKE_A, nickname: 'Big Red' });
    await act(async () => jest.advanceTimersByTimeAsync(0));
    expect(await screen.findByText('Log on the “Big Red”')).toBeOnTheScreen();
  });

  it('choosing an option replaces the sheet with the form in ONE navigation action', async () => {
    await renderSheet();
    await act(async () => jest.advanceTimersByTimeAsync(0));
    await screen.findByText('Log on the Africa Twin');
    await fireEvent.press(screen.getByTestId('log-option-expense'));
    expect(mockRouter.replace).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: '/(tabs)/(garage)/add-expense',
      params: {
        motorcycleId: BIKE_A.id,
        bikeName: '2022 Honda Africa Twin',
        entrySource: 'bike_hub',
      },
    });
    const { trackEvent } = jest.requireMock('../../../lib/analytics') as { trackEvent: jest.Mock };
    expect(trackEvent).toHaveBeenCalledWith('BIKE_LOG_OPTION_SELECTED', {
      motorcycle_id: BIKE_A.id,
      option: LOG_OPTION.EXPENSE,
    });
    // Never a dismiss followed by a later push: two separate modal updates can
    // overlap natively and leave the sheet stack desynced (screens issue 4446).
    await act(async () => jest.advanceTimersByTimeAsync(2000));
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('Note opens the note sheet with the bike', async () => {
    await renderSheet();
    await act(async () => jest.advanceTimersByTimeAsync(0));
    await screen.findByText('Log on the Africa Twin');
    await fireEvent.press(screen.getByTestId('log-option-note'));
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: '/(tabs)/(garage)/note',
      params: { motorcycleId: BIKE_A.id },
    });
  });

  it('Odometer opens the odometer sheet with ONE replace — never back() then push()', async () => {
    await renderSheet();
    await act(async () => jest.advanceTimersByTimeAsync(0));
    await screen.findByText('Log on the Africa Twin');
    expect(
      screen.getByRole('button', { name: 'Odometer. Update the reading from your dash' }),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('log-option-odometer'));
    await act(async () => jest.advanceTimersByTimeAsync(2000));
    expect(mockRouter.replace).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: '/(tabs)/(garage)/odometer',
      params: { motorcycleId: BIKE_A.id },
    });
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled();
    const { trackEvent } = jest.requireMock('../../../lib/analytics') as { trackEvent: jest.Mock };
    expect(trackEvent).toHaveBeenCalledWith('BIKE_LOG_OPTION_SELECTED', {
      motorcycle_id: BIKE_A.id,
      option: LOG_OPTION.ODOMETER,
    });
  });

  it('a second tap before the replace lands does not navigate again', async () => {
    await renderSheet();
    await act(async () => jest.advanceTimersByTimeAsync(0));
    await screen.findByText('Log on the Africa Twin');
    await fireEvent.press(screen.getByTestId('log-option-expense'));
    await fireEvent.press(screen.getByTestId('log-option-task'));
    await fireEvent.press(screen.getByText('Cancel'));
    expect(mockRouter.replace).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/(tabs)/(garage)/add-expense' }),
    );
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('an option tapped while Cancel is closing the sheet does nothing (it would replace the hub)', async () => {
    await renderSheet();
    await act(async () => jest.advanceTimersByTimeAsync(0));
    await fireEvent.press(await screen.findByText('Cancel'));
    await fireEvent.press(screen.getByTestId('log-option-note'));
    await fireEvent.press(screen.getByText('Cancel'));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('Cancel dismisses without opening anything', async () => {
    await renderSheet();
    await act(async () => jest.advanceTimersByTimeAsync(0));
    await fireEvent.press(await screen.findByText('Cancel'));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});

describe('Log sheet — largest text sizes (visual QA round 2)', () => {
  it('everything sits in one vertical scroll view that stops at the top of the screen', async () => {
    await renderSheet();
    await act(async () => jest.advanceTimersByTimeAsync(0));
    const scroll = await screen.findByTestId('log-sheet-scroll');
    const { height } = Dimensions.get('window');
    const style = StyleSheet.flatten(scroll.props.style);
    expect(style.flexGrow).toBe(0);
    expect(style.maxHeight).toBe(height - 54 - SHEET_TOP_CLEARANCE);
    // Android: the form sheet's drag must not steal this scroll view's pan.
    expect(scroll.props.nestedScrollEnabled).toBe(true);
    expect(within(scroll).getByText('Log on the Africa Twin')).toBeOnTheScreen();
    // The last option is inside it, so it can be scrolled to at AX5.
    expect(within(scroll).getByTestId('log-option-document')).toBeOnTheScreen();
  });

  it('option titles and sub-lines are capped at 1.3x, so no title breaks mid-word', async () => {
    await renderSheet();
    await act(async () => jest.advanceTimersByTimeAsync(0));
    expect((await screen.findByText('Plan a task')).props.maxFontSizeMultiplier).toBe(1.3);
    expect(
      screen.getByText('Something to do, due by date or distance').props.maxFontSizeMultiplier,
    ).toBe(1.3);
  });
});

describe('Log sheet — no dead space under the last option', () => {
  it('iOS lifts the sheet above the home indicator itself: no safe-area inset added on top', async () => {
    await renderSheet();
    await act(async () => jest.advanceTimersByTimeAsync(0));
    const scroll = await screen.findByTestId('log-sheet-scroll');
    const content = StyleSheet.flatten(scroll.props.contentContainerStyle);
    // The inset (34) is not added; was 34 + 8.
    expect(content.paddingBottom).toBe(SHEET_BOTTOM_PADDING);
    expect(content.gap).toBe(8);
  });
});

describe('Log sheet — the Expense receipt follows the rider’s currency', () => {
  afterEach(() => useAuthStore.setState({ currency: 'USD' }));

  it.each([
    ['EUR', 'ReceiptEuro'],
    ['USD', 'Receipt'],
    ['GBP', 'ReceiptPoundSterling'],
    ['SEK', 'ReceiptText'],
  ] as const)('%s rider: %s', async (currency, icon) => {
    useAuthStore.setState({ currency });
    await renderSheet();
    await act(async () => jest.advanceTimersByTimeAsync(0));
    const expense = await screen.findByTestId('log-option-expense');
    expect(within(expense).getByTestId(`icon-${icon}`)).toBeOnTheScreen();
  });
});
