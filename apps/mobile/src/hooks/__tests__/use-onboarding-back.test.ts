// Issue 365 T04b — the onboarding chevron reports `onboarding_back` as `button`:
// a pop marks itself for the `beforeRemove` that follows, the replace fallback
// (no history) reports directly.
jest.mock('react-native-mmkv', () => require('../../test/mocks').makeMmkvMock());
const mockRouter = { canGoBack: jest.fn(), back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('../use-onboarding-flow', () => ({ useOnboardingVariant: () => 'shipped' }));
const mockMark = jest.fn();
const mockReplaceBack = jest.fn();
jest.mock('../../lib/onboarding-back-marker', () => ({
  markOnboardingButtonBack: () => mockMark(),
}));
jest.mock('../../lib/onboarding-nav-analytics', () => ({
  trackOnboardingReplaceBack: (...args: unknown[]) => mockReplaceBack(...args),
}));
jest.mock('../../lib/analytics', () => ({ captureException: jest.fn() }));

import { renderHook } from '@testing-library/react-native';
import { OB_SCREEN } from '../../config/onboarding';
import { useOnboardingBack } from '../use-onboarding-back';

beforeEach(() => jest.clearAllMocks());

it('with history: marks the press as a button back, then pops', async () => {
  mockRouter.canGoBack.mockReturnValue(true);
  const { result } = await renderHook(() => useOnboardingBack(OB_SCREEN.GOALS));
  result.current();
  expect(mockMark).toHaveBeenCalledTimes(1);
  expect(mockMark.mock.invocationCallOrder[0]).toBeLessThan(
    mockRouter.back.mock.invocationCallOrder[0],
  );
  expect(mockReplaceBack).not.toHaveBeenCalled();
});

it('without history: reports the replace to the previous step once', async () => {
  mockRouter.canGoBack.mockReturnValue(false);
  const { result } = await renderHook(() => useOnboardingBack(OB_SCREEN.EXPERIENCE));
  result.current();
  expect(mockReplaceBack).toHaveBeenCalledTimes(1);
  expect(mockReplaceBack).toHaveBeenCalledWith(OB_SCREEN.EXPERIENCE, '/(onboarding)');
  expect(mockRouter.replace).toHaveBeenCalledWith('/(onboarding)');
  expect(mockMark).not.toHaveBeenCalled();
});
