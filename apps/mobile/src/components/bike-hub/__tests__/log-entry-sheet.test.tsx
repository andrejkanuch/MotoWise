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

const mockRouter = { push: jest.fn(), back: jest.fn() };
// The garage stack: bike hub beneath, the Log sheet on top.
let mockStackState = { index: 1, routes: [{ key: 'bike-1' }, { key: 'log-entry-1' }] };
// What the dismissed sheet's own navigation object keeps reporting: the stack
// as it was BEFORE the pop. The fallback must not trust it.
const mockSheetState = { index: 1, routes: [{ key: 'bike-1' }, { key: 'log-entry-1' }] };
let mockParentReadable = true;
let mockTransitionEnd: ((event: { data: { closing: boolean } }) => void) | undefined;
jest.mock('expo-router', () => ({
  // A getter: the factory runs at import time, before `mockRouter` is initialised.
  get router() {
    return mockRouter;
  },
  useLocalSearchParams: () => ({ motorcycleId: 'bike-a' }),
  useNavigation: () => ({
    addListener: (_event: string, listener: typeof mockTransitionEnd) => {
      mockTransitionEnd = listener;
      return () => {};
    },
    getState: () => mockSheetState,
    // The tabs navigator above the garage stack: it outlives the sheet and its
    // focused route carries the stack's live state.
    getParent: () =>
      mockParentReadable
        ? { getState: () => ({ index: 0, routes: [{ key: 'garage-tab', state: mockStackState }] }) }
        : undefined,
  }),
}));

const mockFetcher = jest.fn();
jest.mock('../../../lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import LogEntrySheet from '../../../app/(tabs)/(garage)/log-entry';
import '../../../i18n';
import { LOG_OPTION } from '../../../lib/bike-hub/constants';
import { BIKE_A } from '../../../test/bike-hub-fixtures';

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
  mockParentReadable = true;
  mockStackState = { index: 1, routes: [{ key: 'bike-1' }, { key: 'log-entry-1' }] };
  // Going back pops the sheet: the hub is the top screen again.
  mockRouter.back.mockImplementation(() => {
    mockStackState = { index: 0, routes: [{ key: 'bike-1' }] };
  });
});
afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
  jest.useRealTimers();
});

describe('Log sheet', () => {
  it('titles the sheet with the bike and lists the five options in order', async () => {
    await renderSheet();
    await act(async () => jest.advanceTimersByTimeAsync(0));
    expect(await screen.findByText('Log on the Africa Twin')).toBeOnTheScreen();
    expect(screen.getAllByTestId(/^log-option-/).map((row) => row.props.testID)).toEqual([
      'log-option-expense',
      'log-option-task',
      'log-option-past_work',
      'log-option-note',
      'log-option-document',
    ]);
  });

  it('uses the nickname in quotes when the bike has one', async () => {
    await renderSheet({ ...BIKE_A, nickname: 'Big Red' });
    await act(async () => jest.advanceTimersByTimeAsync(0));
    expect(await screen.findByText('Log on the “Big Red”')).toBeOnTheScreen();
  });

  it('choosing an option dismisses the sheet first and opens the form when the dismissal ends', async () => {
    await renderSheet();
    await act(async () => jest.advanceTimersByTimeAsync(0));
    await screen.findByText('Log on the Africa Twin');
    await fireEvent.press(screen.getByTestId('log-option-expense'));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.push).not.toHaveBeenCalled();
    const { trackEvent } = jest.requireMock('../../../lib/analytics') as { trackEvent: jest.Mock };
    expect(trackEvent).toHaveBeenCalledWith('BIKE_LOG_OPTION_SELECTED', {
      motorcycle_id: BIKE_A.id,
      option: LOG_OPTION.EXPENSE,
    });

    await act(async () => mockTransitionEnd?.({ data: { closing: true } }));
    expect(mockRouter.push).toHaveBeenCalledTimes(1);
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/(tabs)/(garage)/add-expense',
      params: { motorcycleId: BIKE_A.id, bikeName: '2022 Honda Africa Twin' },
    });
    // The fallback timer must not open it a second time.
    await act(async () => jest.advanceTimersByTimeAsync(2000));
    expect(mockRouter.push).toHaveBeenCalledTimes(1);
  });

  it('opens the form by the fallback timer if the closing transition never reports', async () => {
    await renderSheet();
    await act(async () => jest.advanceTimersByTimeAsync(0));
    await screen.findByText('Log on the Africa Twin');
    await fireEvent.press(screen.getByTestId('log-option-note'));
    expect(mockRouter.push).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTimeAsync(700));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/(tabs)/(garage)/note',
      params: { motorcycleId: BIKE_A.id },
    });
  });

  it('a second tap while the sheet is closing does not pop another screen or open a second form', async () => {
    await renderSheet();
    await act(async () => jest.advanceTimersByTimeAsync(0));
    await screen.findByText('Log on the Africa Twin');
    await fireEvent.press(screen.getByTestId('log-option-expense'));
    await fireEvent.press(screen.getByTestId('log-option-task'));
    await fireEvent.press(screen.getByTestId('log-option-expense'));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    await act(async () => jest.advanceTimersByTimeAsync(2000));
    expect(mockRouter.push).toHaveBeenCalledTimes(1);
    expect(mockRouter.push).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/(tabs)/(garage)/add-expense' }),
    );
  });

  it('the fallback opens the form when the rider is still on the screen beneath the sheet', async () => {
    await renderSheet();
    await act(async () => jest.advanceTimersByTimeAsync(0));
    await screen.findByText('Log on the Africa Twin');
    await fireEvent.press(screen.getByTestId('log-option-document'));
    await act(async () => jest.advanceTimersByTimeAsync(700));
    expect(mockRouter.push).toHaveBeenCalledTimes(1);
  });

  it('the fallback is cancelled when the rider has moved to another screen meanwhile', async () => {
    await renderSheet();
    await act(async () => jest.advanceTimersByTimeAsync(0));
    await screen.findByText('Log on the Africa Twin');
    await fireEvent.press(screen.getByTestId('log-option-document'));
    mockStackState = { index: 1, routes: [{ key: 'bike-1' }, { key: 'notes-1' }] };
    await act(async () => jest.advanceTimersByTimeAsync(700));
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('opens the form when the stack cannot be read at all — a chosen option never ends in nothing', async () => {
    mockParentReadable = false;
    await renderSheet();
    await act(async () => jest.advanceTimersByTimeAsync(0));
    await screen.findByText('Log on the Africa Twin');
    await fireEvent.press(screen.getByTestId('log-option-expense'));
    await act(async () => jest.advanceTimersByTimeAsync(700));
    expect(mockRouter.push).toHaveBeenCalledTimes(1);
  });

  it('Cancel dismisses without opening anything', async () => {
    await renderSheet();
    await act(async () => jest.advanceTimersByTimeAsync(0));
    await fireEvent.press(await screen.findByText('Cancel'));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});
