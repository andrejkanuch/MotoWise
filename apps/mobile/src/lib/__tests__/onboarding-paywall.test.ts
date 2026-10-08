const mockPresentPaywall = jest.fn();
const mockSetOnboardingAttributes = jest.fn();
const mockWaitForRevenueCatLogin = jest.fn();

jest.mock('../subscription', () => ({
  presentPaywall: (...args: unknown[]) => mockPresentPaywall(...args),
  setOnboardingAttributes: (...args: unknown[]) => mockSetOnboardingAttributes(...args),
  waitForRevenueCatLogin: (...args: unknown[]) => mockWaitForRevenueCatLogin(...args),
}));

jest.mock('../pending-intent', () => ({
  isMaintenanceIntent: (intent: { kind?: string } | null) => intent?.kind === 'maintenance',
}));

import { REVENUECAT_ENTITLEMENT_PRO } from '@motovault/types';
import {
  isServerOnboardingComplete,
  ONBOARDING_PAYWALL_SURFACE,
  presentOnboardingPaywall,
  resolveOnboardingPaywallPlacement,
} from '../onboarding-paywall';

const baseInput = {
  ridingGoals: ['discover_routes', 'track_rides'],
  bikeData: { make: 'Honda', model: 'Africa Twin', year: 2022 },
  experienceLevel: 'intermediate',
  pendingIntent: null,
} as unknown as Parameters<typeof presentOnboardingPaywall>[0];

beforeEach(() => {
  jest.clearAllMocks();
  mockPresentPaywall.mockResolvedValue('cancelled');
  mockSetOnboardingAttributes.mockResolvedValue(undefined);
  mockWaitForRevenueCatLogin.mockResolvedValue(undefined);
});

describe('resolveOnboardingPaywallPlacement', () => {
  it('maps the highest-priority goal to its placement', () => {
    // track_rides outranks discover_routes regardless of tap order.
    expect(resolveOnboardingPaywallPlacement(baseInput)).toEqual({
      primaryGoal: 'track_rides',
      placement: 'onboarding_rides',
      goals: 'discover_routes,track_rides',
    });
  });

  it('routes-only riders get the routes placement', () => {
    expect(
      resolveOnboardingPaywallPlacement({ ...baseInput, ridingGoals: ['discover_routes'] })
        .placement,
    ).toBe('onboarding_routes');
  });

  it('maintenance-intent riders get the maintenance placement whatever their goal', () => {
    expect(
      resolveOnboardingPaywallPlacement({
        ...baseInput,
        pendingIntent: { kind: 'maintenance' },
      } as unknown as typeof baseInput).placement,
    ).toBe('onboarding_maintenance');
  });
});

describe('presentOnboardingPaywall', () => {
  it('waits for RevenueCat logIn before presenting, so Pro riders are recognised', async () => {
    const order: string[] = [];
    mockWaitForRevenueCatLogin.mockImplementation(async () => {
      order.push('login');
    });
    mockPresentPaywall.mockImplementation(async () => {
      order.push('present');
      return 'not_presented';
    });

    const result = await presentOnboardingPaywall(baseInput, {
      surface: ONBOARDING_PAYWALL_SURFACE.GARAGE_READY,
      shouldAbort: () => false,
    });

    expect(order).toEqual(['login', 'present']);
    // Attributes are written after login, onto the signed-in customer.
    expect(mockWaitForRevenueCatLogin.mock.invocationCallOrder[0]).toBeLessThan(
      mockSetOnboardingAttributes.mock.invocationCallOrder[0],
    );
    expect(result).toBe('not_presented');
  });

  it('presents with the Pro entitlement gate, the goal placement and the surface', async () => {
    await presentOnboardingPaywall(baseInput, {
      surface: ONBOARDING_PAYWALL_SURFACE.STEP,
      shouldAbort: () => false,
    });

    expect(mockSetOnboardingAttributes).toHaveBeenCalledWith(
      expect.objectContaining({ primaryGoal: 'track_rides', bikeMake: 'Honda' }),
    );
    expect(mockPresentPaywall).toHaveBeenCalledWith(
      expect.objectContaining({
        requiredEntitlementIdentifier: REVENUECAT_ENTITLEMENT_PRO,
        placement: 'onboarding_rides',
        surface: 'onboarding_paywall',
        source: 'onboarding',
        silentOnError: true,
      }),
    );
  });

  it('passes the caller abort check through to the native present', async () => {
    let aborted = false;
    await presentOnboardingPaywall(baseInput, {
      surface: ONBOARDING_PAYWALL_SURFACE.STEP,
      shouldAbort: () => aborted,
    });
    const { shouldAbort } = mockPresentPaywall.mock.calls[0][0];
    expect(shouldAbort()).toBe(false);
    aborted = true;
    expect(shouldAbort()).toBe(true);
  });
});

describe('presentOnboardingPaywall when the rider escaped during the wait', () => {
  it('returns not_presented without calling presentPaywall', async () => {
    let escaped = false;
    mockWaitForRevenueCatLogin.mockImplementation(async () => {
      escaped = true;
    });

    const result = await presentOnboardingPaywall(baseInput, {
      surface: ONBOARDING_PAYWALL_SURFACE.STEP,
      shouldAbort: () => escaped,
    });

    expect(result).toBe('not_presented');
    expect(mockPresentPaywall).not.toHaveBeenCalled();
  });
});

describe('isServerOnboardingComplete', () => {
  it('is false while a garage_first rider is waiting on "Open my garage"', () => {
    expect(isServerOnboardingComplete({ onboardingCompleted: true }, true)).toBe(false);
  });

  it('follows the server flag once the rider is not waiting', () => {
    expect(isServerOnboardingComplete({ onboardingCompleted: true }, false)).toBe(true);
    expect(isServerOnboardingComplete({ onboardingCompleted: false }, false)).toBe(false);
    expect(isServerOnboardingComplete(null, false)).toBe(false);
  });
});
