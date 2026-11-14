// Lives outside src/app on purpose: expo-router turns every file under src/app
// into a route, so a test there would be bundled into the app as a screen.
//
// issue 365 T13b (FS-OB1c, V4 a1): bike setup kept the picked make and the typed
// model in component state, so a relaunch landed on the empty make list. The
// search in progress is now the onboarding store's `bikeDraft`.
jest.mock('react-native-mmkv', () => require('../../test/mocks').makeMmkvMock());
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  useReducedMotion: () => true,
}));
jest.mock('expo-haptics', () => ({ ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' } }));
jest.mock('../../utils/haptics', () => ({
  triggerImpact: jest.fn(),
  triggerNotification: jest.fn(),
  triggerSelection: jest.fn(),
}));
const mockGoNext = jest.fn();
jest.mock('../../hooks/use-onboarding-flow', () => ({
  useOnboardingNext: () => mockGoNext,
}));
jest.mock('../../hooks/use-onboarding-back', () => ({ useOnboardingBack: () => jest.fn() }));
jest.mock('../../hooks/use-mileage-unit', () => ({ useMileageUnit: () => 'km' }));
jest.mock('../../lib/analytics', () => ({
  AnalyticsEvent: new Proxy({}, { get: (_target, key) => String(key) }),
  captureException: jest.fn(),
  trackEvent: jest.fn(),
}));
jest.mock('../../lib/onboarding-analytics', () => ({ trackOnboardingEvent: jest.fn() }));
jest.mock('../../components/onboarding/bike-setup/use-bike-setup-telemetry', () => {
  const telemetry = {
    noteMakeQuery: jest.fn(),
    noteModelQuery: jest.fn(),
    noteMakePicked: jest.fn(),
    noteModelPicked: jest.fn(),
    noteModelListSize: jest.fn(),
    noteModelFetch: jest.fn(),
    finish: jest.fn(),
  };
  return { useBikeSetupTelemetry: () => telemetry };
});
jest.mock('../../components/onboarding/bike-setup/bike-photo-field', () => ({
  BikePhotoField: () => null,
}));
jest.mock('../../components/onboarding/onboarding-bike-plate', () => {
  const { Text } = require('react-native');
  return {
    OnboardingBikePlate: ({ make, year }: { make: string; year: number | null }) => (
      <Text testID="bike-plate">{`${make} ${year ?? ''}`}</Text>
    ),
  };
});
jest.mock('../../components/onboarding/onboarding-shell', () => {
  const { Pressable, Text, View } = require('react-native');
  return {
    OnboardingTextButton: ({ label, onPress }: { label: string; onPress: () => void }) => (
      <Pressable onPress={onPress}>
        <Text>{label}</Text>
      </Pressable>
    ),
    OnboardingShell: ({
      children,
      primary,
    }: {
      children: import('react').ReactNode;
      primary?: { label: string; onPress: () => void };
    }) => (
      <View>
        {children}
        {primary ? (
          <Pressable testID="shell-primary" onPress={primary.onPress}>
            <Text>{primary.label}</Text>
          </Pressable>
        ) : null}
      </View>
    ),
  };
});
jest.mock('../../lib/graphql-client', () => {
  const graphql = require('@motovault/graphql');
  return {
    gqlFetcher: (doc: unknown) => {
      if (doc === graphql.MotorcycleMakesDocument)
        return Promise.resolve({
          motorcycleMakes: [
            { makeId: 474, makeName: 'HONDA' },
            { makeId: 485, makeName: 'YAMAHA' },
          ],
        });
      if (doc === graphql.MotorcycleModelsDocument)
        return Promise.resolve({ motorcycleModels: [{ modelId: 1, modelName: 'Africa Twin' }] });
      return Promise.resolve({ makeStats: [] });
    },
  };
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import '../../i18n';
import BikeSetupScreen from '../../app/(onboarding)/bike-setup';
import { useOnboardingStore } from '../../stores/onboarding.store';

async function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = await render(
    <QueryClientProvider client={client}>
      <BikeSetupScreen />
    </QueryClientProvider>,
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  return view;
}

beforeEach(() => {
  useOnboardingStore.getState().reset();
  mockGoNext.mockReset();
});

describe('Onboarding bike setup keeps the search in progress', () => {
  it('restores the picked make, the typed model and the year from the draft', async () => {
    useOnboardingStore.setState({
      bikeDraft: { makeId: 474, make: 'HONDA', modelQuery: 'Africa', year: 2021 },
    });

    await renderScreen();

    expect(screen.getByTestId('bike-plate').props.children).toBe('HONDA 2021');
    expect(screen.queryByText('Popular makes')).toBeNull();
    expect(screen.getByDisplayValue('Africa')).toBeTruthy();
  });

  it('writes the draft while the rider picks a make and types a model', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByText('HONDA'));
    expect(useOnboardingStore.getState().bikeDraft).toMatchObject({
      makeId: 474,
      make: 'HONDA',
      modelQuery: '',
    });

    await fireEvent.changeText(screen.getByPlaceholderText('Search HONDA models…'), 'Africa');
    expect(useOnboardingStore.getState().bikeDraft).toMatchObject({
      makeId: 474,
      make: 'HONDA',
      modelQuery: 'Africa',
    });
  });

  it('a draft wins over a saved bike: the last search on screen comes back', async () => {
    useOnboardingStore.getState().setBikeData({
      year: 2020,
      make: 'YAMAHA',
      makeId: 485,
      model: 'MT-09',
      type: 'naked',
      currentMileage: 0,
      mileageUnit: 'km',
    } as never);
    useOnboardingStore.setState({
      bikeDraft: { makeId: 474, make: 'HONDA', modelQuery: 'Afr', year: 2019 },
    });

    await renderScreen();

    expect(screen.getByTestId('bike-plate').props.children).toBe('HONDA 2019');
    expect(screen.getByDisplayValue('Afr')).toBeTruthy();
  });

  it('a picked model comes back picked, so Continue keeps it', async () => {
    useOnboardingStore.setState({
      bikeDraft: {
        makeId: 474,
        make: 'HONDA',
        modelQuery: 'Africa Twin',
        year: 2021,
        modelPicked: true,
      },
    });

    await renderScreen();
    await fireEvent.press(screen.getByTestId('shell-primary'));

    expect(useOnboardingStore.getState().bikeData?.model).toBe('Africa Twin');
  });

  it('revisiting a saved bike and coming back keeps its model', async () => {
    useOnboardingStore.getState().setBikeData({
      year: 2020,
      make: 'YAMAHA',
      makeId: 485,
      model: 'MT-09',
      type: 'naked',
      currentMileage: 0,
      mileageUnit: 'km',
    } as never);

    // First visit (Back to the step) writes the draft from the saved bike; the
    // rider leaves without Continue, and the next mount starts from that draft.
    await renderScreen();
    expect(useOnboardingStore.getState().bikeDraft).toMatchObject({
      modelQuery: 'MT-09',
      modelPicked: true,
    });
    await cleanup();

    await renderScreen();
    await fireEvent.press(screen.getByTestId('shell-primary'));

    expect(useOnboardingStore.getState().bikeData?.model).toBe('MT-09');
  });

  it('a typed search is not a picked model', async () => {
    useOnboardingStore.setState({
      bikeDraft: { makeId: 474, make: 'HONDA', modelQuery: 'Africa', year: 2021 },
    });

    await renderScreen();
    await fireEvent.press(screen.getByTestId('shell-primary'));

    expect(useOnboardingStore.getState().bikeData?.model).toBe('');
  });

  it('completing the step drops the draft', async () => {
    useOnboardingStore.setState({
      bikeDraft: { makeId: 474, make: 'HONDA', modelQuery: '', year: 2021 },
    });

    await renderScreen();
    await fireEvent.press(screen.getByTestId('shell-primary'));

    expect(useOnboardingStore.getState().bikeData?.make).toBe('HONDA');
    expect(useOnboardingStore.getState().bikeDraft).toBeNull();
    expect(mockGoNext).toHaveBeenCalled();
  });
});
