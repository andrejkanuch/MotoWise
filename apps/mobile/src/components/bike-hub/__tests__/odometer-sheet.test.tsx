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
jest.mock('@expo/ui/community/datetime-picker', () => ({ __esModule: true, default: () => null }));

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
import { Alert } from 'react-native';
import '../../../i18n';
import { BIKE_A, TODAY } from '../../../test/bike-hub-fixtures';
import { OdometerSheet } from '../sheets/odometer-sheet';
import type { HubBike } from '../shell/use-bike-hub-data';

const LATEST = {
  id: 'reading-1',
  value: 38_167,
  recordedAt: new Date(2026, 8, 28, 12).toISOString(),
  source: 'manual',
  rideId: null,
};
const clients: QueryClient[] = [];
const onClose = jest.fn();

interface Scenario {
  bike?: Record<string, unknown>;
  readings?: unknown[];
  pending?: { rideCount: number; distance: number };
  saveFails?: boolean;
}

async function renderSheet(scenario: Scenario = {}) {
  mockFetcher.mockImplementation((document: unknown) => {
    if (document === OdometerReadingsDocument) {
      return Promise.resolve({ odometerReadings: scenario.readings ?? [LATEST] });
    }
    if (document === PendingRideDistanceDocument) {
      return Promise.resolve({
        pendingRideDistance: scenario.pending ?? { rideCount: 4, distance: 1240 },
      });
    }
    if (document === LogOdometerReadingDocument) {
      return scenario.saveFails
        ? Promise.reject(new Error('offline'))
        : Promise.resolve({ logOdometerReading: { id: BIKE_A.id } });
    }
    return Promise.resolve(undefined);
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { gcTime: 0 } },
  });
  clients.push(client);
  await render(
    <QueryClientProvider client={client}>
      <OdometerSheet
        bike={{ ...BIKE_A, ...scenario.bike } as unknown as HubBike}
        onClose={onClose}
        now={TODAY}
      />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(client.isFetching()).toBe(0));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function type(digits: string) {
  for (const digit of digits) await fireEvent.press(screen.getByTestId(`key-${digit}`));
}

const saved = () =>
  mockFetcher.mock.calls.filter(([document]) => document === LogOdometerReadingDocument);

beforeEach(() => jest.clearAllMocks());
afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
  jest.restoreAllMocks();
});

describe('OdometerSheet', () => {
  it('typing 3-9-4-0-7 shows the entry, the delta line and the save label', async () => {
    await renderSheet();
    await type('39407');
    expect(screen.getByTestId('odometer-entry')).toHaveTextContent('39,407');
    expect(screen.getByText('+1,240 km since Sep 28 · was 38,167')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Save 39,407 km' })).toBeEnabled();
    expect(screen.getByText('+1,240 from 4 tracked rides')).toBeOnTheScreen();
  });

  it('saves a higher reading for today without a timestamp, then closes', async () => {
    await renderSheet();
    await type('39407');
    await fireEvent.press(screen.getByTestId('odometer-save'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(saved()).toEqual([
      [
        LogOdometerReadingDocument,
        { input: { motorcycleId: BIKE_A.id, value: 39_407, recordedAt: undefined } },
      ],
    ]);
    const { trackEvent } = jest.requireMock('../../../lib/analytics') as { trackEvent: jest.Mock };
    expect(trackEvent).toHaveBeenCalledWith('ODOMETER_UPDATED', {
      motorcycle_id: BIKE_A.id,
      source: 'sheet',
      delta: 1240,
      backdated: false,
      used_quick_add: false,
    });
  });

  it('"+100" from an empty entry yields the last reading + 100; chips add to the entry', async () => {
    await renderSheet();
    await fireEvent.press(screen.getByTestId('chip-100'));
    expect(screen.getByTestId('odometer-entry')).toHaveTextContent('38,267');
    await fireEvent.press(screen.getByTestId('chip-50'));
    expect(screen.getByTestId('odometer-entry')).toHaveTextContent('38,317');
  });

  it('the rides chip adds the pending ride distance to the entry', async () => {
    await renderSheet();
    await fireEvent.press(screen.getByTestId('chip-rides'));
    expect(screen.getByRole('button', { name: 'Save 39,407 km' })).toBeOnTheScreen();
  });

  it('hides the rides chip when no ride is pending', async () => {
    await renderSheet({ pending: { rideCount: 0, distance: 0 } });
    expect(screen.queryByTestId('chip-rides')).toBeNull();
  });

  it('a lower value asks first and saves only on confirm', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderSheet();
    await type('38000');
    expect(screen.getByText('−167 km · was 38,167')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('odometer-save'));
    expect(saved()).toHaveLength(0);
    expect(alert).toHaveBeenCalledWith(
      'Lower than the last reading',
      'Lower than the last reading (38,167 km). Save anyway?',
      expect.any(Array),
    );
    const buttons = alert.mock.calls[0]?.[2] ?? [];
    await act(async () => buttons.find((button) => button.text === 'Save')?.onPress?.());
    await waitFor(() => expect(saved()).toHaveLength(1));
    expect(saved()[0]?.[1]).toMatchObject({ input: { value: 38_000 } });
  });

  it('an equal value keeps Save disabled', async () => {
    await renderSheet();
    await type('38167');
    expect(screen.getByText('Same as the last reading · 38,167')).toBeOnTheScreen();
    expect(screen.getByTestId('odometer-save')).toBeDisabled();
  });

  it('an empty entry keeps Save disabled and shows the last reading', async () => {
    await renderSheet();
    expect(screen.getByTestId('odometer-save')).toBeDisabled();
    expect(screen.getByText('Last reading 38,167 km · Sep 28')).toBeOnTheScreen();
  });

  it('delete removes a digit; long-press clears', async () => {
    await renderSheet();
    await type('394');
    await fireEvent.press(screen.getByRole('button', { name: 'Delete digit' }));
    expect(screen.getByTestId('odometer-entry')).toHaveTextContent('39');
    await fireEvent(screen.getByTestId('key-delete'), 'longPress');
    expect(screen.getByTestId('odometer-save')).toBeDisabled();
  });

  it('a miles bike shows mi everywhere — the value is not converted', async () => {
    await renderSheet({ bike: { distanceUnit: 'mi' } });
    await type('39407');
    expect(screen.getByText('+1,240 mi since Sep 28 · was 38,167')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Save 39,407 mi' })).toBeOnTheScreen();
  });

  it('a bike without an odometer: no "was" line, Save enabled from the first digit', async () => {
    await renderSheet({ bike: { currentMileage: null }, readings: [] });
    expect(screen.getByText('First reading for this bike')).toBeOnTheScreen();
    await type('5');
    expect(screen.getByRole('button', { name: 'Save 5 km' })).toBeEnabled();
  });

  it('a failed save keeps the sheet open with the entry and says so', async () => {
    await renderSheet({ saveFails: true });
    await type('39407');
    await fireEvent.press(screen.getByTestId('odometer-save'));
    expect(await screen.findByText("Couldn't save the reading. Try again.")).toBeOnTheScreen();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('odometer-entry')).toHaveTextContent('39,407');
  });
});
