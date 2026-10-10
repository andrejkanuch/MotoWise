import { MeasurementSystem, RIDE_MILESTONE_PAYWALL } from '@motovault/types';
import {
  distanceInRiderUnit,
  evaluateRideTeaser,
  isQualifyingRide,
  RIDE_TEASER_TRIGGER,
  type RideTeaserInput,
  rideTeaserEvaluatedProperties,
  summaryMovingTimeS,
  TEASER_SUPPRESSION,
} from '../ride-milestone-trigger';

jest.mock('react-native-mmkv', () => ({
  createMMKV: () => {
    const store = new Map<string, unknown>();
    return {
      set: (k: string, v: unknown) => store.set(k, v),
      getBoolean: (k: string) => store.get(k) as boolean | undefined,
      getNumber: (k: string) => store.get(k) as number | undefined,
      getString: (k: string) => store.get(k) as string | undefined,
      remove: (k: string) => store.delete(k),
    };
  },
}));
jest.mock('../analytics', () => ({
  AnalyticsEvent: { RIDE_PAYWALL_TEASER_EVALUATED: 'ride_paywall_teaser_evaluated' },
  trackEvent: jest.fn(),
}));

const NOW = Date.UTC(2026, 9, 10, 12);
const HOUR = 3_600_000;

/** A plain free rider on a 12 km, 20-minute phone ride with four qualifying rides behind them. */
function input(over: Partial<RideTeaserInput> = {}): RideTeaserInput {
  return {
    ride: { distanceM: 12_000, movingS: 1_200, systemEnded: false },
    priorStats: { qualifyingRideCount: 4, longestQualifyingDistanceM: 20_000 },
    isPro: false,
    isTrialing: false,
    carPlayConnected: false,
    activeRide: false,
    onboardingPaywallDismissedAt: null,
    measurementSystem: MeasurementSystem.METRIC,
    shownTriggers: new Set(),
    liveEnabled: false,
    now: NOW,
    ...over,
  };
}

describe('evaluateRideTeaser', () => {
  it('AE1: the fifth qualifying ride is due, and in the shadow phase it would show but does not', () => {
    const result = evaluateRideTeaser(input());
    expect(result).toMatchObject({
      trigger: RIDE_TEASER_TRIGGER.MILESTONE,
      wouldShow: true,
      shown: false,
      suppressionReason: TEASER_SUPPRESSION.LIVE_OFF,
      qualifyingRideCount: 5,
      isQualifyingRide: true,
    });
  });

  it('shows once live cards are on', () => {
    const result = evaluateRideTeaser(input({ liveEnabled: true }));
    expect(result).toMatchObject({ wouldShow: true, shown: true, suppressionReason: null });
  });

  it('R1: a 400 m test tap never qualifies and never counts', () => {
    const result = evaluateRideTeaser(
      input({ ride: { distanceM: 400, movingS: 60, systemEnded: false } }),
    );
    expect(result).toMatchObject({
      trigger: null,
      wouldShow: false,
      suppressionReason: TEASER_SUPPRESSION.RIDE_NOT_QUALIFYING,
      isQualifyingRide: false,
    });
  });

  it('R1: a system-ended ride never qualifies', () => {
    const result = evaluateRideTeaser(
      input({ ride: { distanceM: 12_000, movingS: 1_200, systemEnded: true } }),
    );
    expect(result.suppressionReason).toBe(TEASER_SUPPRESSION.RIDE_NOT_QUALIFYING);
  });

  it('R1: too little moving time never qualifies', () => {
    const result = evaluateRideTeaser(
      input({
        ride: {
          distanceM: 12_000,
          movingS: RIDE_MILESTONE_PAYWALL.QUALIFYING_MIN_MOVING_S - 1,
          systemEnded: false,
        },
      }),
    );
    expect(result.suppressionReason).toBe(TEASER_SUPPRESSION.RIDE_NOT_QUALIFYING);
  });

  it('R7: a failed stats read suppresses rather than guesses', () => {
    const result = evaluateRideTeaser(input({ priorStats: null }));
    expect(result).toMatchObject({
      trigger: null,
      suppressionReason: TEASER_SUPPRESSION.STATS_UNAVAILABLE,
      qualifyingRideCount: null,
    });
  });

  it('is not due on the fourth qualifying ride', () => {
    const result = evaluateRideTeaser(
      input({ priorStats: { qualifyingRideCount: 3, longestQualifyingDistanceM: 20_000 } }),
    );
    expect(result).toMatchObject({ trigger: null, suppressionReason: TEASER_SUPPRESSION.NOT_DUE });
  });

  it('R2 late window and launch backfill: still due on the ninth ride when never shown', () => {
    const result = evaluateRideTeaser(
      input({ priorStats: { qualifyingRideCount: 8, longestQualifyingDistanceM: 20_000 } }),
    );
    expect(result.trigger).toBe(RIDE_TEASER_TRIGGER.MILESTONE);
  });

  it('R10: once per account ever', () => {
    const result = evaluateRideTeaser(
      input({ shownTriggers: new Set([RIDE_TEASER_TRIGGER.MILESTONE]) }),
    );
    expect(result).toMatchObject({
      trigger: null,
      suppressionReason: TEASER_SUPPRESSION.ALREADY_SHOWN,
    });
  });

  it('AE3: a 32 mi ride for a miles rider whose longest is 28 mi is due, but the milestone wins when both are due', () => {
    const miles = (mi: number) => mi * 1609.344;
    const both = evaluateRideTeaser(
      input({
        measurementSystem: MeasurementSystem.IMPERIAL,
        ride: { distanceM: miles(52), movingS: 3_600, systemEnded: false },
        priorStats: { qualifyingRideCount: 4, longestQualifyingDistanceM: miles(28) },
      }),
    );
    expect(both.trigger).toBe(RIDE_TEASER_TRIGGER.MILESTONE);

    const longOnly = evaluateRideTeaser(
      input({
        measurementSystem: MeasurementSystem.IMPERIAL,
        ride: { distanceM: miles(52), movingS: 3_600, systemEnded: false },
        priorStats: { qualifyingRideCount: 9, longestQualifyingDistanceM: miles(28) },
        shownTriggers: new Set([RIDE_TEASER_TRIGGER.MILESTONE]),
      }),
    );
    expect(longOnly.trigger).toBe(RIDE_TEASER_TRIGGER.LONG_RIDE);
  });

  it('R3: 50 km reads in the rider unit, so 52 km is not a long ride for a miles rider', () => {
    const result = evaluateRideTeaser(
      input({
        measurementSystem: MeasurementSystem.IMPERIAL,
        ride: { distanceM: 52_000, movingS: 3_600, systemEnded: false },
        priorStats: { qualifyingRideCount: 2, longestQualifyingDistanceM: 20_000 },
      }),
    );
    expect(result).toMatchObject({ trigger: null, suppressionReason: TEASER_SUPPRESSION.NOT_DUE });
  });

  it('R3: riders already past 50 before go-live never get the long-ride teaser', () => {
    const result = evaluateRideTeaser(
      input({
        ride: { distanceM: 60_000, movingS: 3_600, systemEnded: false },
        priorStats: { qualifyingRideCount: 9, longestQualifyingDistanceM: 55_000 },
        shownTriggers: new Set([RIDE_TEASER_TRIGGER.MILESTONE]),
      }),
    );
    expect(result.trigger).toBeNull();
  });

  it('AE2: an onboarding paywall dismissed 10 hours ago suppresses, 80 hours ago does not', () => {
    const recent = evaluateRideTeaser(input({ onboardingPaywallDismissedAt: NOW - 10 * HOUR }));
    expect(recent).toMatchObject({
      trigger: RIDE_TEASER_TRIGGER.MILESTONE,
      wouldShow: false,
      suppressionReason: TEASER_SUPPRESSION.ONBOARDING_PAYWALL_COOLDOWN,
    });
    const old = evaluateRideTeaser(input({ onboardingPaywallDismissedAt: NOW - 80 * HOUR }));
    expect(old.wouldShow).toBe(true);
  });

  it.each([
    ['isPro', TEASER_SUPPRESSION.IS_PRO],
    ['isTrialing', TEASER_SUPPRESSION.IS_TRIALING],
    ['carPlayConnected', TEASER_SUPPRESSION.CARPLAY_CONNECTED],
    ['activeRide', TEASER_SUPPRESSION.ACTIVE_RIDE],
  ] as const)('R4: %s suppresses a due trigger and keeps the trigger on the event', (flag, reason) => {
    const result = evaluateRideTeaser(input({ [flag]: true }));
    expect(result).toMatchObject({
      trigger: RIDE_TEASER_TRIGGER.MILESTONE,
      wouldShow: false,
      suppressionReason: reason,
    });
  });
});

describe('distanceInRiderUnit', () => {
  it('converts to km or miles', () => {
    expect(distanceInRiderUnit(50_000, MeasurementSystem.METRIC)).toBe(50);
    expect(distanceInRiderUnit(1609.344, MeasurementSystem.IMPERIAL)).toBe(1);
  });
});

describe('summaryMovingTimeS', () => {
  /** The server's computeMovingTimeS, which the phone must agree with (R1). */
  const serverMovingTimeS = (elapsedS: number, pausedS: number, autoPausedS: number) =>
    Math.max(0, elapsedS - pausedS - autoPausedS);

  it('R1: a 4-minute ride with a 90 s auto-pause is not qualifying on the phone, as on the server', () => {
    const elapsedS = 240;
    const autoPausedS = 90;
    // The summary's durationS already excludes manual pauses (none here).
    const movingS = summaryMovingTimeS(elapsedS, autoPausedS);

    expect(movingS).toBe(serverMovingTimeS(elapsedS, 0, autoPausedS));
    expect(movingS).toBeLessThan(RIDE_MILESTONE_PAYWALL.QUALIFYING_MIN_MOVING_S);
    expect(isQualifyingRide({ distanceM: 2_000, movingS, systemEnded: false })).toBe(false);
  });

  it('subtracts nothing when there was no auto-pause and never goes negative', () => {
    expect(summaryMovingTimeS(1_200, 0)).toBe(1_200);
    expect(summaryMovingTimeS(30, 90)).toBe(0);
  });
});

describe('rideTeaserEvaluatedProperties', () => {
  it('carries every R11 field', () => {
    const props = rideTeaserEvaluatedProperties(evaluateRideTeaser(input()), {
      rideId: 'ride-1',
      distanceM: 12_000.4,
      hasHadTrial: false,
      isPro: false,
      isTrialing: false,
    });
    expect(props).toMatchObject({
      ride_id: 'ride-1',
      trigger: RIDE_TEASER_TRIGGER.MILESTONE,
      would_show: true,
      shown: false,
      suppression_reason: TEASER_SUPPRESSION.LIVE_OFF,
      qualifying_ride_count: 5,
      distance_m: 12_000,
      has_had_trial: false,
    });
    expect(typeof props.platform).toBe('string');
  });
});
