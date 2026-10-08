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

// iOS date chip: the system compact picker. The stand-in hands its props to the test.
interface MockDatePickerProps {
  selection: Date;
  range?: { start?: Date; end?: Date };
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
  datePickerStyle: (style: string) => ({ style }),
  environment: (key: string, value: string) => ({ key, value }),
  labelsHidden: () => ({}),
  tint: (color: string) => ({ color }),
}));

const mockFetcher = jest.fn();
jest.mock('../../../lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));

import {
  LogOdometerReadingDocument,
  type LogOdometerReadingMutationVariables,
  OdometerReadingsDocument,
  type OdometerReadingsQuery,
  PendingRideDistanceDocument,
  type PendingRideDistanceQuery,
} from '@motovault/graphql';
import { ODOMETER_MAX } from '@motovault/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { endOfDay } from 'date-fns';
import { Alert } from 'react-native';
import '../../../i18n';
import { BIKE_A, TODAY } from '../../../test/bike-hub-fixtures';
import { OdometerSheet } from '../sheets/odometer-sheet';
import type { HubBike } from '../shell/use-bike-hub-data';

type Reading = OdometerReadingsQuery['odometerReadings'][number];
type PendingRides = PendingRideDistanceQuery['pendingRideDistance'];

const LATEST: Reading = {
  id: 'reading-1',
  value: 38_167,
  recordedAt: new Date(2026, 8, 28, 12).toISOString(),
  source: 'manual',
  rideId: null,
};
const NO_PENDING_RIDES: PendingRides = { rideCount: 0, distance: 0 };
const BACKDATED_NOTICE =
  'Dated before your latest reading: it is logged, and the odometer stays at 38,167 km.';

const clients: QueryClient[] = [];
const onClose = jest.fn();

interface Scenario {
  bike?: Partial<Record<keyof typeof BIKE_A, unknown>>;
  readings?: Reading[];
  pending?: PendingRides;
}

async function renderSheet(scenario: Scenario = {}) {
  mockFetcher.mockImplementation((document: unknown) => {
    if (document === OdometerReadingsDocument) {
      return Promise.resolve({ odometerReadings: scenario.readings ?? [LATEST] });
    }
    if (document === PendingRideDistanceDocument) {
      return Promise.resolve({ pendingRideDistance: scenario.pending ?? NO_PENDING_RIDES });
    }
    if (document === LogOdometerReadingDocument) {
      return Promise.resolve({ logOdometerReading: { id: BIKE_A.id } });
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

/** Chooses `date` in the date chip's native picker, as iOS would report it. */
async function pickDate(date: Date) {
  await act(async () => mockDatePicker?.onDateChange(date));
}

const savedInputs = (): LogOdometerReadingMutationVariables['input'][] =>
  mockFetcher.mock.calls
    .filter(([document]) => document === LogOdometerReadingDocument)
    .map(([, variables]) => (variables as LogOdometerReadingMutationVariables).input);

beforeEach(() => {
  jest.clearAllMocks();
  mockDatePicker = null;
});
afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
  jest.restoreAllMocks();
});

describe('OdometerSheet — a back-dated reading', () => {
  const AUGUST_1 = new Date(2026, 7, 1, 9, 30);

  it('a lower value dated before the latest reading is saved without asking', async () => {
    // Arrange
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderSheet();
    await pickDate(AUGUST_1);
    await type('37000');

    // Act
    await fireEvent.press(screen.getByTestId('odometer-save'));

    // Assert
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(alert).not.toHaveBeenCalled();
    expect(savedInputs()).toEqual([
      {
        motorcycleId: BIKE_A.id,
        value: 37_000,
        recordedAt: endOfDay(AUGUST_1).toISOString(),
      },
    ]);
  });

  it('says before saving that the odometer will stay where it is', async () => {
    await renderSheet();
    await pickDate(AUGUST_1);
    await type('37000');
    expect(screen.getByTestId('odometer-delta')).toHaveTextContent(BACKDATED_NOTICE);
    expect(mockDatePicker?.selection).toEqual(AUGUST_1);
  });

  it('reports the save as back-dated', async () => {
    await renderSheet();
    await pickDate(AUGUST_1);
    await type('37000');
    await fireEvent.press(screen.getByTestId('odometer-save'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const { trackEvent } = jest.requireMock('../../../lib/analytics') as { trackEvent: jest.Mock };
    expect(trackEvent).toHaveBeenCalledWith(
      'ODOMETER_UPDATED',
      expect.objectContaining({ backdated: true, delta: -1167 }),
    );
  });

  it('a back-dated reading equal to the latest value can be saved', async () => {
    await renderSheet();
    await pickDate(AUGUST_1);
    await type('38167');
    expect(screen.getByTestId('odometer-save')).toBeEnabled();
  });

  it('back at today the same lower value asks again', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderSheet();
    await pickDate(AUGUST_1);
    await pickDate(TODAY);
    await type('37000');
    await fireEvent.press(screen.getByTestId('odometer-save'));
    expect(alert).toHaveBeenCalledTimes(1);
    expect(savedInputs()).toHaveLength(0);
    expect(mockDatePicker?.selection).toEqual(TODAY);
  });

  it('a lower value dated after the latest reading, but before today, still asks', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderSheet();
    await pickDate(new Date(2026, 8, 30));
    await type('38000');
    await fireEvent.press(screen.getByTestId('odometer-save'));
    expect(alert).toHaveBeenCalledWith(
      'Lower than 38,167 km',
      'Save it only if the last reading was wrong.',
      expect.any(Array),
    );
    expect(savedInputs()).toHaveLength(0);
  });

  it('the date sits in the reading row and the keypad stays put — no key, no "Done"', async () => {
    await renderSheet();
    expect(screen.queryByTestId('key-date')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
    await pickDate(AUGUST_1);
    expect(screen.getByTestId('key-1')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
  });

  it('the picker cannot go past today', async () => {
    await renderSheet();
    expect(mockDatePicker?.range?.end).toEqual(TODAY);
  });

  it('a future date, should the picker ever hand one over, blocks Save and says why', async () => {
    await renderSheet();
    await pickDate(new Date(2026, 9, 3));
    await type('39407');
    expect(screen.getByTestId('odometer-save')).toBeDisabled();
    expect(screen.getByTestId('odometer-notice')).toHaveTextContent(
      "The date can't be in the future.",
    );
  });
});

describe('OdometerSheet — readings cache behind the bike (ride end not refetched yet)', () => {
  // The cache still holds Sep 28 / 38,167; a ride ended Oct 1 18:00 and moved the bike to 38,400.
  const RIDE_ENDED = new Date(2026, 9, 1, 18).toISOString();
  const SEPTEMBER_30 = new Date(2026, 8, 30, 9);
  const NOTICE_400 =
    'Dated before your latest reading: it is logged, and the odometer stays at 38,400 km.';

  it("judges back-dating against the bike's mileageUpdatedAt, as the server will", async () => {
    await renderSheet({ bike: { currentMileage: 38_400, mileageUpdatedAt: RIDE_ENDED } });
    await pickDate(SEPTEMBER_30);
    await type('38300');
    expect(screen.getByTestId('odometer-delta')).toHaveTextContent(NOTICE_400);
  });

  it('with no mileageUpdatedAt, any past day is treated as back-dated', async () => {
    await renderSheet({ bike: { currentMileage: 38_400, mileageUpdatedAt: null } });
    await pickDate(SEPTEMBER_30);
    await type('38500');
    expect(screen.getByTestId('odometer-delta')).toHaveTextContent(NOTICE_400);
  });
});

describe('OdometerSheet — the day of the latest reading', () => {
  // The latest reading was logged in the evening; the rider picks that same day.
  const EVENING: Reading = { ...LATEST, recordedAt: new Date(2026, 8, 28, 18, 30).toISOString() };

  it('a higher reading is sent with a timestamp after the latest one, so the odometer moves', async () => {
    // Arrange
    await renderSheet({ readings: [EVENING] });
    await pickDate(new Date(2026, 8, 28));
    await type('38300');

    // Act
    await fireEvent.press(screen.getByTestId('odometer-save'));

    // Assert
    await waitFor(() => expect(savedInputs()).toHaveLength(1));
    const sentAt = Date.parse(savedInputs()[0]?.recordedAt ?? '');
    expect(sentAt).toBeGreaterThan(Date.parse(EVENING.recordedAt));
  });

  it('shows no back-dated notice, and a lower value asks like any correction', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderSheet({ readings: [EVENING] });
    await pickDate(new Date(2026, 8, 28));
    await type('38000');
    expect(screen.getByTestId('odometer-delta')).not.toHaveTextContent(BACKDATED_NOTICE);
    await fireEvent.press(screen.getByTestId('odometer-save'));
    expect(alert).toHaveBeenCalledTimes(1);
    expect(savedInputs()).toHaveLength(0);
  });

  it('the day before it is back-dated and says so', async () => {
    await renderSheet({ readings: [EVENING] });
    await pickDate(new Date(2026, 8, 27));
    await type('38300');
    expect(screen.getByTestId('odometer-delta')).toHaveTextContent(BACKDATED_NOTICE);
  });
});

describe('OdometerSheet — lower than the last reading', () => {
  it('Cancel in the confirmation saves nothing and keeps the entry', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderSheet();
    await type('38000');
    await fireEvent.press(screen.getByTestId('odometer-save'));
    const buttons = alert.mock.calls[0]?.[2] ?? [];
    await act(async () => buttons.find((button) => button.style === 'cancel')?.onPress?.());
    expect(savedInputs()).toHaveLength(0);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('odometer-entry')).toHaveTextContent('38,000');
  });

  it('one below the last reading already asks', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderSheet();
    await type('38166');
    await fireEvent.press(screen.getByTestId('odometer-save'));
    expect(alert).toHaveBeenCalledTimes(1);
  });

  it('typing past an equal value enables Save again', async () => {
    await renderSheet();
    await type('38167');
    expect(screen.getByTestId('odometer-save')).toBeDisabled();
    await type('0');
    expect(screen.getByRole('button', { name: 'Save 381,670 km' })).toBeEnabled();
  });

  it('a bike with an odometer but no logged reading compares against the bike’s value', async () => {
    await renderSheet({ readings: [] });
    await type('38167');
    expect(screen.getByTestId('odometer-save')).toBeDisabled();
    await fireEvent(screen.getByTestId('key-delete'), 'longPress');
    await type('39407');
    expect(screen.getByTestId('odometer-delta')).toHaveTextContent('+1,240 km');
    expect(screen.queryByText(/was 38,167/)).toBeNull();
  });
});

describe('OdometerSheet — maximum value', () => {
  const MAX_TEXT = '9,999,999';

  it('an eighth digit is ignored: the entry stops at the maximum', async () => {
    await renderSheet();
    await type('99999999');
    expect(screen.getByTestId('odometer-entry')).toHaveTextContent(MAX_TEXT);
    expect(screen.getByRole('button', { name: `Save ${MAX_TEXT} km` })).toBeEnabled();
  });

  it('a quick-add chip at the maximum stays at the maximum, and saves it', async () => {
    await renderSheet();
    await type('9999999');
    await fireEvent.press(screen.getByTestId('chip-250'));
    expect(screen.getByTestId('odometer-entry')).toHaveTextContent(MAX_TEXT);
    await fireEvent.press(screen.getByTestId('odometer-save'));
    await waitFor(() => expect(savedInputs()).toHaveLength(1));
    expect(savedInputs()[0]?.value).toBe(ODOMETER_MAX);
  });
});

describe('OdometerSheet — tracked rides chip', () => {
  it('is hidden when rideCount is 0, even if a distance came back', async () => {
    await renderSheet({ pending: { rideCount: 0, distance: 1240 } });
    expect(screen.queryByTestId('chip-rides')).toBeNull();
    expect(screen.getByTestId('chip-50')).toBeOnTheScreen();
  });

  it('reads "+1,240 from 4 tracked rides"', async () => {
    await renderSheet({ pending: { rideCount: 4, distance: 1240 } });
    expect(screen.getByText('+1,240 from 4 tracked rides')).toBeOnTheScreen();
  });

  it('one pending ride reads in the singular', async () => {
    await renderSheet({ pending: { rideCount: 1, distance: 85 } });
    expect(screen.getByText('+85 from 1 tracked ride')).toBeOnTheScreen();
  });

  it('adding the rides gives "+1,240 km since Sep 28" and "Save 39,407 km"', async () => {
    await renderSheet({ pending: { rideCount: 4, distance: 1240 } });
    await fireEvent.press(screen.getByTestId('chip-rides'));
    expect(screen.getByTestId('odometer-delta')).toHaveTextContent('+1,240 km since Sep 28');
    expect(screen.getByRole('button', { name: 'Save 39,407 km' })).toBeEnabled();
  });

  it('a save made with a chip is reported as a quick add', async () => {
    await renderSheet({ pending: { rideCount: 4, distance: 1240 } });
    await fireEvent.press(screen.getByTestId('chip-rides'));
    await fireEvent.press(screen.getByTestId('odometer-save'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const { trackEvent } = jest.requireMock('../../../lib/analytics') as { trackEvent: jest.Mock };
    expect(trackEvent).toHaveBeenCalledWith(
      'ODOMETER_UPDATED',
      expect.objectContaining({ used_quick_add: true, delta: 1240, backdated: false }),
    );
  });
});
