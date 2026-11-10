// Profile › What's New reopens What's New as opened from Profile, and the
// Rider insights row carries the NEW chip until Road Atlas is used.
jest.mock('react-native-mmkv', () => require('../../test/mocks').makeMmkvMock());
jest.mock('../../lib/analytics', () => require('../../test/mocks').mockAnalytics());
jest.mock('expo-application', () => ({ __esModule: true, nativeApplicationVersion: '3.28.0' }));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '3.28.0' } },
}));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../../utils/haptics', () => ({ triggerImpact: jest.fn() }));
jest.mock('../../hooks/use-tab-bar-clearance', () => ({ useTabBarClearance: () => 0 }));
jest.mock('../../hooks/use-pro-gate', () => ({ useProGate: () => ({ isPro: false }) }));
jest.mock('../../hooks/use-profile-data', () => ({
  useProfileData: () => ({
    user: null,
    handleLogout: jest.fn(),
    handleDeleteAccount: jest.fn(),
    isDeleting: false,
  }),
}));
jest.mock('../../components/profile/identity-header', () => ({ IdentityHeader: () => null }));
jest.mock('../../lib/store-review', () => ({
  openStoreReviewPage: jest.fn(),
  REVIEW_STORE_SURFACE: {},
}));
jest.mock('../../lib/subscription', () => ({
  CODE_REDEMPTION_SURFACE: {},
  presentCodeRedemption: jest.fn(),
  presentPaywall: jest.fn(),
}));
const mockRouter = { push: jest.fn() };
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
}));

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import '../../i18n';
import ProfileScreen from '../../app/(tabs)/(profile)/index';
import { MODAL_ROUTE } from '../../config/routes';
import { WHATS_NEW_SOURCE } from '../../config/whats-new';
import { WHATS_NEW_FEATURE } from '../../data/whats-new-releases';
import { featureNewChipTestId } from '../../features/whats-new/feature-new-chip';
import { useWhatsNewStore } from '../../stores/whats-new.store';

const ATLAS_CHIP = featureNewChipTestId(WHATS_NEW_FEATURE.ROAD_ATLAS);

beforeEach(() => {
  mockRouter.push.mockReset();
  useWhatsNewStore.setState(useWhatsNewStore.getInitialState(), true);
});

describe('Profile', () => {
  it("opens What's New with source profile", async () => {
    await render(<ProfileScreen />);
    await fireEvent.press(screen.getByTestId('profile-whats-new'));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: MODAL_ROUTE.WHATS_NEW,
      params: { source: WHATS_NEW_SOURCE.PROFILE },
    });
  });

  it('marks Rider insights NEW until Road Atlas is used', async () => {
    await render(<ProfileScreen />);
    expect(screen.getByTestId(ATLAS_CHIP)).toBeTruthy();
    await act(async () => useWhatsNewStore.getState().markUsed(WHATS_NEW_FEATURE.ROAD_ATLAS));
    expect(screen.queryByTestId(ATLAS_CHIP)).toBeNull();
  });
});
