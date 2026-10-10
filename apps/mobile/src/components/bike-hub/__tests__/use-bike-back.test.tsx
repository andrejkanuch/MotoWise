const mockRouter = {
  back: jest.fn(),
  replace: jest.fn(),
  navigate: jest.fn(),
  dismissAll: jest.fn(),
  canGoBack: jest.fn(() => true),
  canDismiss: jest.fn(() => true),
};
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

import { renderHook } from '@testing-library/react-native';
import { BIKE_ORIGIN, type BikeOrigin } from '@/lib/bike-hub/constants';
import { useBikeBack } from '../shell/use-bike-back';

async function goBack(origin: BikeOrigin) {
  const { result } = await renderHook(() => useBikeBack(origin));
  result.current();
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRouter.canGoBack.mockReturnValue(true);
  mockRouter.canDismiss.mockReturnValue(true);
});

describe('useBikeBack', () => {
  it('from the garage: pops the bike', async () => {
    await goBack(BIKE_ORIGIN.GARAGE);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('from a notification on cold start (nothing beneath): lands on the garage list', async () => {
    mockRouter.canGoBack.mockReturnValue(false);
    await goBack(BIKE_ORIGIN.GARAGE);
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/(garage)');
  });

  it('from Home: pops the bike off the garage stack, then returns to Home', async () => {
    await goBack(BIKE_ORIGIN.HOME);
    expect(mockRouter.dismissAll).toHaveBeenCalledTimes(1);
    expect(mockRouter.navigate).toHaveBeenCalledWith('/(tabs)/(home)');
    expect(mockRouter.dismissAll.mock.invocationCallOrder[0]).toBeLessThan(
      mockRouter.navigate.mock.invocationCallOrder[0],
    );
  });

  it('from Profile: pops the bike, then returns to Profile', async () => {
    await goBack(BIKE_ORIGIN.PROFILE);
    expect(mockRouter.dismissAll).toHaveBeenCalledTimes(1);
    expect(mockRouter.navigate).toHaveBeenCalledWith('/(tabs)/(profile)');
  });

  it('does not dismiss when the bike is the only screen of the stack', async () => {
    mockRouter.canDismiss.mockReturnValue(false);
    await goBack(BIKE_ORIGIN.HOME);
    expect(mockRouter.dismissAll).not.toHaveBeenCalled();
    expect(mockRouter.navigate).toHaveBeenCalledWith('/(tabs)/(home)');
  });
});
