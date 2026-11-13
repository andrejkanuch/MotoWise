/**
 * The root screen tracker also reports the post-onboarding landing (issue 365
 * T05d): the first `(tabs)` screen after onboarding completes on personalizing.
 */
const mockRouter = { segments: ['(onboarding)', 'personalizing'], pathname: '/personalizing' };
jest.mock('expo-router', () => ({
  usePathname: () => mockRouter.pathname,
  useSegments: () => mockRouter.segments,
  useGlobalSearchParams: () => ({}),
}));
const mockAuth = { onboardingCompleted: false };
jest.mock('../../stores/auth.store', () => ({
  useAuthStore: (select: (state: typeof mockAuth) => unknown) => select(mockAuth),
}));
jest.mock('../../lib/analytics', () => ({
  ...require('../../test/mocks').mockAnalytics(),
  trackScreen: jest.fn(),
}));
jest.mock('../../lib/onboarding-experiment', () => ({ getOnboardingVariant: () => 'invested' }));

import { renderHook } from '@testing-library/react-native';
import { AnalyticsEvent, trackEvent, trackScreen } from '../../lib/analytics';
import { useScreenTracking } from '../use-screen-tracking';

const landed = () =>
  jest
    .mocked(trackEvent)
    .mock.calls.filter(([event]) => event === AnalyticsEvent.POST_ONBOARDING_LANDED);

describe('useScreenTracking — post_onboarding_landed', () => {
  it('fires once when the rider lands on a tab after finishing onboarding', async () => {
    const { rerender } = await renderHook(() => useScreenTracking());
    expect(trackScreen).toHaveBeenLastCalledWith('/(onboarding)/personalizing', expect.anything());

    // "Open my garage": completion flips while personalizing is on screen…
    mockAuth.onboardingCompleted = true;
    await rerender({});
    // …then the root guard moves to Home.
    mockRouter.segments = ['(tabs)', '(home)'];
    mockRouter.pathname = '/';
    await rerender({});
    mockRouter.segments = ['(tabs)', '(garage)'];
    await rerender({});

    expect(landed()).toEqual([
      [
        AnalyticsEvent.POST_ONBOARDING_LANDED,
        expect.objectContaining({
          screen: '/(tabs)/(home)',
          onboarding_variant: 'invested',
          overlay: 'none',
          ms_since_cta: expect.any(Number),
        }),
      ],
    ]);
  });
});
