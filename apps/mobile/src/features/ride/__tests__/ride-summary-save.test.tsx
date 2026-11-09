// The ride summary's save: opening Rider insights saves the ride and lands on
// insights; a save that fails there must not send a later plain Save to insights.
import type { ReactNode } from 'react';

jest.mock('react-native-mmkv', () => require('@/test/mocks').makeMmkvMock());
jest.mock('@/lib/analytics', () => require('@/test/mocks').mockAnalytics());
jest.mock('@/utils/haptics', () => ({ triggerImpact: jest.fn(), triggerNotification: jest.fn() }));
jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));
const mockRouter = { replace: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ rideId: 'ride-1', motorcycleId: 'bike-1', distanceM: '1000' }),
  useFocusEffect: () => {},
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@rnmapbox/maps', () => {
  const { View } = require('react-native');
  const Box = ({ children }: { children?: ReactNode }) => <View>{children}</View>;
  return {
    __esModule: true,
    default: { MapView: Box, Camera: Box, ShapeSource: Box, LineLayer: Box, PointAnnotation: Box },
  };
});
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: ({ children }: { children?: ReactNode }) => <View>{children}</View> };
});
jest.mock('@/lib/graphql-client', () => ({ gqlFetcher: () => new Promise(() => {}) }));
jest.mock('@/features/ride/ride-controller', () => ({ finalizeEndedRide: () => false }));
jest.mock('@/features/ride/ride-purpose-sheet', () => ({ RidePurposeSheet: () => null }));
jest.mock('@/features/ride/ride-summary-insights-card', () => {
  const { Pressable, Text } = require('react-native');
  return {
    RideSummaryInsightsCard: ({ onOpenInsights }: { onOpenInsights: (href: string) => void }) => (
      <Pressable testID="open-insights" onPress={() => onOpenInsights('/insights-entry')}>
        <Text>open</Text>
      </Pressable>
    ),
  };
});
jest.mock('@/components/ui/native-toggle', () => ({ NativeToggle: () => null }));
jest.mock('@/hooks/use-bike-name', () => ({ useBikeName: () => 'Bike' }));
jest.mock('@/hooks/use-measurement-system', () => ({ useMeasurementSystem: () => 'metric' }));
jest.mock('@/lib/core-action-milestones', () => ({
  CORE_ACTION_KIND: { RIDE_SAVED: 'ride_saved' },
  recordCoreAction: () => 1,
}));
jest.mock('@/lib/invalidate', () => ({ invalidateSavedRide: jest.fn() }));
jest.mock('@/lib/meta-analytics', () => ({ MetaAnalytics: { trackLogRide: jest.fn() } }));
jest.mock('@/lib/ride-analytics', () => ({
  RIDE_SAVE_TRIGGER: { SUMMARY: 'summary' },
  trackRideCompleted: jest.fn(),
}));
const mockRequestRideReview = jest.fn();
jest.mock('@/lib/store-review', () => ({
  requestRideReview: (...args: unknown[]) => mockRequestRideReview(...args),
}));
jest.mock('@/utils/ride-storage', () => ({
  getPointBuffer: () => [],
  getWaypointChunks: () => [],
}));
jest.mock('@/utils/ride-sync-queue', () => ({
  dropDeadLetteredRide: jest.fn(),
  enqueueOrExecute: jest.fn(() => Promise.resolve()),
}));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import RideSummaryScreen from '@/app/(modals)/ride-summary';
import { captureException } from '@/lib/analytics';

async function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return await render(
    <QueryClientProvider client={client}>
      <RideSummaryScreen />
    </QueryClientProvider>,
  );
}

describe('ride summary save', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opening insights saves the ride and lands on insights', async () => {
    mockRequestRideReview.mockResolvedValue(undefined);
    await renderScreen();
    await fireEvent.press(screen.getByTestId('open-insights'));
    await waitFor(() =>
      expect(mockRouter.replace).toHaveBeenCalledWith('/insights-entry', { withAnchor: true }),
    );
  });

  it('a failed save from insights does not send a later plain Save to insights', async () => {
    mockRequestRideReview.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    await renderScreen();

    await fireEvent.press(screen.getByTestId('open-insights'));
    await waitFor(() => expect(captureException).toHaveBeenCalledTimes(1));
    expect(mockRouter.replace).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByLabelText('rideSummary.saveRide'));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledTimes(1));
    expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/(profile)', { withAnchor: true });
  });
});
