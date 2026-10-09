// Lives outside src/app on purpose: expo-router turns every file under src/app
// into a route, so a test there would be bundled into the app as a screen.
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 54, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('../../utils/haptics', () => ({
  triggerImpact: jest.fn(),
  triggerNotification: jest.fn(),
  triggerSelection: jest.fn(),
}));
jest.mock('react-native-mmkv', () => require('../../test/mocks').makeMmkvMock());
jest.mock('../../lib/analytics', () => require('../../test/mocks').mockAnalytics());
jest.mock('../../lib/meta-analytics', () => ({
  MetaAnalytics: { trackAddToGarage: jest.fn() },
}));

const mockRequireAccess = jest.fn();
jest.mock('../../hooks/use-pro-gate', () => ({
  useProGate: () => ({ requireAccess: mockRequireAccess }),
}));

const mockRouter = { back: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));

const mockFetcher = jest.fn();
jest.mock('../../lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));

import {
  CreateMotorcycleDocument,
  MotorcycleMakesDocument,
  MotorcycleModelsDocument,
} from '@motovault/graphql';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import '../../i18n';
import AddBikeScreen from '../../app/(tabs)/(garage)/add-bike';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { GRAPHQL_ERROR_CODE } from '../../lib/graphql-error-classification';
import { queryKeys } from '../../lib/query-keys';

const HONDA = { makeId: 474, makeName: 'HONDA' };
const AFRICA_TWIN = { modelId: 10, modelName: 'Africa Twin' };
const NEXT_YEAR = new Date().getFullYear() + 1;

const TEST_ID = {
  YEAR: 'add-bike-year',
  MAKE_SEARCH: 'add-bike-make-search',
  MAKE_OPTION: `add-bike-make-option-${HONDA.makeId}`,
  MODEL_SEARCH: 'add-bike-model-search',
  MODEL_OPTION: `add-bike-model-option-${AFRICA_TWIN.modelId}`,
  SUBMIT: 'add-bike-submit',
} as const;

/** Answers the NHTSA queries; `create` decides the CreateMotorcycle outcome. */
function serve(create: () => Promise<unknown> = () => Promise.resolve({ createMotorcycle: {} })) {
  mockFetcher.mockImplementation((document: unknown) => {
    if (document === MotorcycleMakesDocument) {
      return Promise.resolve({ motorcycleMakes: [HONDA, { makeId: 1, makeName: 'YAMAHA' }] });
    }
    if (document === MotorcycleModelsDocument) {
      return Promise.resolve({ motorcycleModels: [AFRICA_TWIN] });
    }
    if (document === CreateMotorcycleDocument) return create();
    return Promise.resolve(undefined);
  });
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

async function renderScreen() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      mutations: { retry: false, gcTime: Number.POSITIVE_INFINITY },
    },
  });
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  await render(
    <QueryClientProvider client={client}>
      <AddBikeScreen />
    </QueryClientProvider>,
  );
  await flush();
  return { client, invalidate };
}

const submitDisabled = () =>
  screen.getByTestId(TEST_ID.SUBMIT).props.accessibilityState?.disabled === true;

async function typeYear(year: string) {
  await fireEvent.changeText(screen.getByTestId(TEST_ID.YEAR), year);
  await flush();
}

async function chooseHonda() {
  await fireEvent.changeText(screen.getByTestId(TEST_ID.MAKE_SEARCH), 'hon');
  await fireEvent.press(screen.getByTestId(TEST_ID.MAKE_OPTION));
  await flush();
}

async function chooseAfricaTwin() {
  await fireEvent.press(screen.getByTestId(TEST_ID.MODEL_OPTION));
  await flush();
}

beforeEach(() => {
  serve();
  mockRequireAccess.mockReturnValue(false);
});

afterEach(async () => {
  await flush();
  jest.restoreAllMocks();
  mockFetcher.mockReset();
  mockRequireAccess.mockReset();
  mockRouter.back.mockReset();
  jest.mocked(trackEvent).mockReset();
});

describe('Add a Bike — year and model gating', () => {
  it('keeps the model locked until there is a make and a valid year', async () => {
    await renderScreen();
    expect(screen.queryByTestId(TEST_ID.MODEL_SEARCH)).toBeNull();

    await typeYear('2022');
    // A valid year alone does not unlock it.
    expect(screen.queryByTestId(TEST_ID.MODEL_SEARCH)).toBeNull();

    await typeYear('20');
    await chooseHonda();
    // A make with a partial year does not either.
    expect(screen.queryByTestId(TEST_ID.MODEL_SEARCH)).toBeNull();
    expect(mockFetcher).not.toHaveBeenCalledWith(MotorcycleModelsDocument, expect.anything());

    await typeYear('2022');
    expect(screen.getByTestId(TEST_ID.MODEL_OPTION)).toBeOnTheScreen();
    expect(mockFetcher).toHaveBeenCalledWith(MotorcycleModelsDocument, {
      makeId: HONDA.makeId,
      year: 2022,
    });
  });

  it('enables Add only for a valid year, and a new year clears the model', async () => {
    await renderScreen();
    await typeYear('2022');
    await chooseHonda();
    await chooseAfricaTwin();
    expect(submitDisabled()).toBe(false);

    // Out of range (before 1900, after next year) or not four digits: no submit.
    for (const year of ['1899', String(NEXT_YEAR + 1), '202']) {
      await typeYear(year);
      expect(submitDisabled()).toBe(true);
    }

    // Back to a valid year: the model it had was for another year, so pick again.
    await typeYear(String(NEXT_YEAR));
    expect(submitDisabled()).toBe(true);
    await chooseAfricaTwin();
    expect(submitDisabled()).toBe(false);
  });

  it('keeps only digits in the year field', async () => {
    await renderScreen();
    await typeYear('2O2x2');
    expect(screen.getByTestId(TEST_ID.YEAR).props.value).toBe('222');
  });
});

describe('Add a Bike — save', () => {
  it('creates the bike, refreshes the garage, tracks it and closes', async () => {
    const { invalidate } = await renderScreen();
    await typeYear('2022');
    await chooseHonda();
    await chooseAfricaTwin();
    await fireEvent.changeText(screen.getByTestId('add-bike-nickname'), '  Twin  ');

    await fireEvent.press(screen.getByTestId(TEST_ID.SUBMIT));
    await flush();

    expect(mockFetcher).toHaveBeenCalledWith(CreateMotorcycleDocument, {
      input: { year: 2022, make: HONDA.makeName, model: AFRICA_TWIN.modelName, nickname: 'Twin' },
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.motorcycles.all });
    expect(trackEvent).toHaveBeenCalledWith(AnalyticsEvent.GARAGE_BIKE_ADDED, {
      make: HONDA.makeName,
      model: AFRICA_TWIN.modelName,
      year: 2022,
    });
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('opens the paywall when the free bike limit rejects the save', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    serve(() =>
      Promise.reject({
        response: {
          errors: [
            {
              message: 'Your free plan includes 1 motorcycle',
              extensions: { code: GRAPHQL_ERROR_CODE.FORBIDDEN },
            },
          ],
        },
      }),
    );
    await renderScreen();
    await typeYear('2022');
    await chooseHonda();
    await chooseAfricaTwin();

    await fireEvent.press(screen.getByTestId(TEST_ID.SUBMIT));
    await flush();

    expect(mockRequireAccess).toHaveBeenCalledWith('MAX_BIKES', Number.POSITIVE_INFINITY);
    // The paywall is the answer: no error alert on top, nothing tracked, sheet stays.
    expect(alert).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it("says why when the app thinks the rider is Pro but the server's limit still applies", async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockRequireAccess.mockReturnValue(true);
    serve(() =>
      Promise.reject({
        response: {
          errors: [
            {
              message: 'Your free plan includes 1 motorcycle',
              extensions: { code: GRAPHQL_ERROR_CODE.FORBIDDEN },
            },
          ],
        },
      }),
    );
    await renderScreen();
    await typeYear('2022');
    await chooseHonda();
    await chooseAfricaTwin();

    await fireEvent.press(screen.getByTestId(TEST_ID.SUBMIT));
    await flush();

    expect(alert).toHaveBeenCalledWith('Error', 'Your free plan includes 1 motorcycle');
  });
});
