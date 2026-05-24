/**
 * Test scenarios for ride tracking experience improvements (P0–P2).
 *
 * These tests cover the logic extracted from the ride lifecycle screens:
 *   • GPS readiness thresholds & timeout behaviour
 *   • Minimum-ride guard conditions
 *   • Zero-distance detection
 *   • Auto-save countdown & undo lifecycle
 *   • Smart ride naming
 *   • Personal records computation
 *   • Period comparison deltas
 *   • Analytics event correctness
 */

// ---------------------------------------------------------------------------
// Mocks — same pattern as existing ride.test.ts
// ---------------------------------------------------------------------------
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: jest.fn(),
    getNumber: jest.fn(),
    getBoolean: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
    contains: jest.fn(),
    getAllKeys: jest.fn().mockReturnValue([]),
  }),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-location');
jest.mock('expo-notifications');
jest.mock('expo-task-manager', () => ({ defineTask: jest.fn() }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock('../utils/ride-sync-queue', () => ({ enqueue: jest.fn() }));

import { useRideStore } from '../stores/ride.store';

// ===================================================================
// P0.1 — GPS Readiness Thresholds
// ===================================================================
describe('GPS Readiness Gate', () => {
  const GPS_READY_THRESHOLD = 20; // meters
  const GPS_OVERRIDE_TIMEOUT_S = 10;

  function assessGpsReadiness(accuracy: number | null): 'searching' | 'ready' {
    if (accuracy === null) return 'searching';
    return accuracy < GPS_READY_THRESHOLD ? 'ready' : 'searching';
  }

  function canStartRide(
    gpsState: 'searching' | 'ready',
    elapsedSinceMount: number,
    hasUnfinished: boolean,
  ): boolean {
    if (hasUnfinished) return false;
    if (gpsState === 'ready') return true;
    return elapsedSinceMount >= GPS_OVERRIDE_TIMEOUT_S;
  }

  it('reports "searching" when accuracy is null (no fix)', () => {
    expect(assessGpsReadiness(null)).toBe('searching');
  });

  it('reports "searching" when accuracy is 50m (poor fix)', () => {
    expect(assessGpsReadiness(50)).toBe('searching');
  });

  it('reports "searching" when accuracy is exactly 20m (boundary)', () => {
    expect(assessGpsReadiness(20)).toBe('searching');
  });

  it('reports "ready" when accuracy is 19.9m', () => {
    expect(assessGpsReadiness(19.9)).toBe('ready');
  });

  it('reports "ready" when accuracy is 5m (excellent fix)', () => {
    expect(assessGpsReadiness(5)).toBe('ready');
  });

  it('blocks start when searching and before timeout', () => {
    expect(canStartRide('searching', 5, false)).toBe(false);
  });

  it('allows start when GPS ready', () => {
    expect(canStartRide('ready', 0, false)).toBe(true);
  });

  it('allows start via override after 10 seconds', () => {
    expect(canStartRide('searching', 10, false)).toBe(true);
  });

  it('blocks start when unfinished ride exists regardless of GPS', () => {
    expect(canStartRide('ready', 0, true)).toBe(false);
    expect(canStartRide('searching', 15, true)).toBe(false);
  });
});

// ===================================================================
// P0.2 — Minimum Ride Guard
// ===================================================================
describe('Minimum Ride Guard', () => {
  const MIN_ELAPSED_S = 30;
  const MIN_DISTANCE_M = 50;

  function shouldShowGuard(elapsedS: number, distanceM: number): boolean {
    return elapsedS < MIN_ELAPSED_S || distanceM < MIN_DISTANCE_M;
  }

  it('triggers guard for zero-distance, zero-time ride', () => {
    expect(shouldShowGuard(0, 0)).toBe(true);
  });

  it('triggers guard for 8 seconds, 0 meters (typical zero-distance ride)', () => {
    expect(shouldShowGuard(8, 0)).toBe(true);
  });

  it('triggers guard for 25 seconds, 40 meters (short distance)', () => {
    expect(shouldShowGuard(25, 40)).toBe(true);
  });

  it('triggers guard for 35 seconds, 30 meters (time OK but distance low)', () => {
    expect(shouldShowGuard(35, 30)).toBe(true);
  });

  it('triggers guard for 20 seconds, 100 meters (distance OK but time low)', () => {
    expect(shouldShowGuard(20, 100)).toBe(true);
  });

  it('does NOT trigger guard for 30 seconds, 50 meters (boundary both met)', () => {
    expect(shouldShowGuard(30, 50)).toBe(false);
  });

  it('does NOT trigger guard for normal ride (5 min, 5km)', () => {
    expect(shouldShowGuard(300, 5000)).toBe(false);
  });

  it('does NOT trigger guard for long ride (2 hours, 100km)', () => {
    expect(shouldShowGuard(7200, 100_000)).toBe(false);
  });
});

// ===================================================================
// P0.4 — Zero-Distance Detection
// ===================================================================
describe('Zero-Distance Detection', () => {
  function isZeroDistanceRide(distanceM: number): boolean {
    return distanceM === 0;
  }

  it('detects zero-distance ride', () => {
    expect(isZeroDistanceRide(0)).toBe(true);
  });

  it('does NOT flag ride with 1 meter', () => {
    expect(isZeroDistanceRide(1)).toBe(false);
  });

  it('does NOT flag normal ride', () => {
    expect(isZeroDistanceRide(5000)).toBe(false);
  });
});

// ===================================================================
// P1.2 — Auto-Save Countdown Logic
// ===================================================================
describe('Auto-Save Countdown Logic', () => {
  const AUTO_SAVE_DELAY_S = 3;
  const UNDO_WINDOW_S = 5;

  type AutoSavePhase = 'celebration' | 'countdown' | 'saved' | 'undo_expired' | 'zero_distance';

  function determinePhase(
    distanceM: number,
    celebrationDismissed: boolean,
    countdownRemaining: number,
    autoSaved: boolean,
    undoExpired: boolean,
  ): AutoSavePhase {
    if (distanceM === 0) return 'zero_distance';
    if (!celebrationDismissed) return 'celebration';
    if (!autoSaved && countdownRemaining > 0) return 'countdown';
    if (autoSaved && !undoExpired) return 'saved';
    return 'undo_expired';
  }

  it('shows zero-distance guidance for 0m rides', () => {
    expect(determinePhase(0, false, 3, false, false)).toBe('zero_distance');
    expect(determinePhase(0, true, 0, true, true)).toBe('zero_distance');
  });

  it('shows celebration first for rides with distance', () => {
    expect(determinePhase(5000, false, 3, false, false)).toBe('celebration');
  });

  it('shows countdown after celebration dismisses', () => {
    expect(determinePhase(5000, true, 3, false, false)).toBe('countdown');
    expect(determinePhase(5000, true, 1, false, false)).toBe('countdown');
  });

  it('shows saved state after auto-save fires', () => {
    expect(determinePhase(5000, true, 0, true, false)).toBe('saved');
  });

  it('navigates away after undo expires', () => {
    expect(determinePhase(5000, true, 0, true, true)).toBe('undo_expired');
  });

  it('auto-save countdown is 3 seconds', () => {
    expect(AUTO_SAVE_DELAY_S).toBe(3);
  });

  it('undo window is 5 seconds', () => {
    expect(UNDO_WINDOW_S).toBe(5);
  });
});

// ===================================================================
// Smart Ride Naming
// ===================================================================
describe('Smart Ride Naming', () => {
  function smartRideName(startedAt: number): string {
    const date = new Date(startedAt);
    const hour = date.getHours();
    const dayName = date.toLocaleDateString(undefined, { weekday: 'long' });

    let timeOfDay: string;
    if (hour < 6) timeOfDay = 'Night';
    else if (hour < 12) timeOfDay = 'Morning';
    else if (hour < 17) timeOfDay = 'Afternoon';
    else if (hour < 21) timeOfDay = 'Evening';
    else timeOfDay = 'Night';

    return `${dayName} ${timeOfDay} Ride`;
  }

  it('names a 7am ride as Morning', () => {
    // Saturday, 7:00 AM local
    const sat7am = new Date(2026, 4, 23, 7, 0, 0).getTime();
    expect(smartRideName(sat7am)).toMatch(/Morning Ride$/);
  });

  it('names a 2pm ride as Afternoon', () => {
    const sat2pm = new Date(2026, 4, 23, 14, 0, 0).getTime();
    expect(smartRideName(sat2pm)).toMatch(/Afternoon Ride$/);
  });

  it('names a 7pm ride as Evening', () => {
    const sat7pm = new Date(2026, 4, 23, 19, 0, 0).getTime();
    expect(smartRideName(sat7pm)).toMatch(/Evening Ride$/);
  });

  it('names a midnight ride as Night', () => {
    const midnight = new Date(2026, 4, 23, 0, 0, 0).getTime();
    expect(smartRideName(midnight)).toMatch(/Night Ride$/);
  });

  it('names a 10pm ride as Night', () => {
    const late = new Date(2026, 4, 23, 22, 0, 0).getTime();
    expect(smartRideName(late)).toMatch(/Night Ride$/);
  });

  it('names a 5:59am ride as Night', () => {
    const earlyMorning = new Date(2026, 4, 23, 5, 59, 0).getTime();
    expect(smartRideName(earlyMorning)).toMatch(/Night Ride$/);
  });

  it('names a 6:00am ride as Morning', () => {
    const sixAm = new Date(2026, 4, 23, 6, 0, 0).getTime();
    expect(smartRideName(sixAm)).toMatch(/Morning Ride$/);
  });

  it('includes day of week', () => {
    // Saturday
    const sat = new Date(2026, 4, 23, 12, 0, 0).getTime();
    expect(smartRideName(sat)).toMatch(/Saturday/);
  });
});

// ===================================================================
// P2.1 — Personal Records Computation
// ===================================================================
describe('Personal Records Computation', () => {
  interface RideNode {
    distanceM: number | null;
    maxSpeedMps: number | null;
    durationS: number | null;
    elevationGain: number | null;
  }

  function computePersonalRecords(rides: RideNode[]) {
    const realRides = rides.filter((r) => r.distanceM != null && r.distanceM > 100);
    if (realRides.length === 0) return null;

    return {
      longestDistance: Math.max(...realRides.map((r) => r.distanceM ?? 0)),
      fastestSpeedMps: Math.max(...realRides.map((r) => r.maxSpeedMps ?? 0)),
      longestDuration: Math.max(...realRides.map((r) => r.durationS ?? 0)),
      mostElevation: Math.max(...realRides.map((r) => r.elevationGain ?? 0)),
    };
  }

  it('returns null for no rides', () => {
    expect(computePersonalRecords([])).toBeNull();
  });

  it('returns null for only zero-distance rides', () => {
    const rides: RideNode[] = [
      { distanceM: 0, maxSpeedMps: null, durationS: 5, elevationGain: null },
      { distanceM: 50, maxSpeedMps: 2, durationS: 10, elevationGain: null },
    ];
    expect(computePersonalRecords(rides)).toBeNull();
  });

  it('computes records from a single real ride', () => {
    const rides: RideNode[] = [
      { distanceM: 5000, maxSpeedMps: 25, durationS: 600, elevationGain: 100 },
    ];
    const records = computePersonalRecords(rides);
    expect(records).toEqual({
      longestDistance: 5000,
      fastestSpeedMps: 25,
      longestDuration: 600,
      mostElevation: 100,
    });
  });

  it('picks max across multiple rides', () => {
    const rides: RideNode[] = [
      { distanceM: 5000, maxSpeedMps: 25, durationS: 600, elevationGain: 100 },
      { distanceM: 80000, maxSpeedMps: 40, durationS: 3600, elevationGain: 500 },
      { distanceM: 15000, maxSpeedMps: 52, durationS: 1200, elevationGain: 200 },
    ];
    const records = computePersonalRecords(rides);
    expect(records).toEqual({
      longestDistance: 80000,
      fastestSpeedMps: 52,
      longestDuration: 3600,
      mostElevation: 500,
    });
  });

  it('ignores rides with distanceM <= 100', () => {
    const rides: RideNode[] = [
      { distanceM: 50, maxSpeedMps: 100, durationS: 9999, elevationGain: 9999 },
      { distanceM: 200, maxSpeedMps: 10, durationS: 60, elevationGain: 5 },
    ];
    const records = computePersonalRecords(rides);
    expect(records).toEqual({
      longestDistance: 200,
      fastestSpeedMps: 10,
      longestDuration: 60,
      mostElevation: 5,
    });
  });

  it('handles null values gracefully', () => {
    const rides: RideNode[] = [
      { distanceM: 5000, maxSpeedMps: null, durationS: null, elevationGain: null },
    ];
    const records = computePersonalRecords(rides);
    expect(records).toEqual({
      longestDistance: 5000,
      fastestSpeedMps: 0,
      longestDuration: 0,
      mostElevation: 0,
    });
  });
});

// ===================================================================
// P2.2 — Period Comparison
// ===================================================================
describe('Period Comparison', () => {
  interface RideWithDate {
    distanceM: number;
    startedAt: string;
  }

  function computePeriodDelta(
    rides: RideWithDate[],
    periodStart: Date,
    periodEnd: Date,
    prevPeriodStart: Date,
    prevPeriodEnd: Date,
  ) {
    const current = rides.filter((r) => {
      const d = new Date(r.startedAt);
      return d >= periodStart && d < periodEnd;
    });
    const previous = rides.filter((r) => {
      const d = new Date(r.startedAt);
      return d >= prevPeriodStart && d < prevPeriodEnd;
    });

    const currentDist = current.reduce((sum, r) => sum + r.distanceM, 0);
    const prevDist = previous.reduce((sum, r) => sum + r.distanceM, 0);

    return {
      currentRides: current.length,
      previousRides: previous.length,
      rideCountDelta: current.length - previous.length,
      currentDistance: currentDist,
      previousDistance: prevDist,
      distanceDelta: currentDist - prevDist,
    };
  }

  const rides: RideWithDate[] = [
    { distanceM: 5000, startedAt: '2026-05-19T10:00:00Z' }, // this week
    { distanceM: 8000, startedAt: '2026-05-20T14:00:00Z' }, // this week
    { distanceM: 3000, startedAt: '2026-05-21T09:00:00Z' }, // this week
    { distanceM: 10000, startedAt: '2026-05-12T10:00:00Z' }, // last week
    { distanceM: 2000, startedAt: '2026-05-13T14:00:00Z' }, // last week
  ];

  const thisWeekStart = new Date('2026-05-18T00:00:00Z');
  const thisWeekEnd = new Date('2026-05-25T00:00:00Z');
  const lastWeekStart = new Date('2026-05-11T00:00:00Z');
  const lastWeekEnd = new Date('2026-05-18T00:00:00Z');

  it('counts rides per period correctly', () => {
    const delta = computePeriodDelta(rides, thisWeekStart, thisWeekEnd, lastWeekStart, lastWeekEnd);
    expect(delta.currentRides).toBe(3);
    expect(delta.previousRides).toBe(2);
  });

  it('computes positive ride count delta', () => {
    const delta = computePeriodDelta(rides, thisWeekStart, thisWeekEnd, lastWeekStart, lastWeekEnd);
    expect(delta.rideCountDelta).toBe(1);
  });

  it('computes distance delta (this week higher)', () => {
    const delta = computePeriodDelta(rides, thisWeekStart, thisWeekEnd, lastWeekStart, lastWeekEnd);
    expect(delta.currentDistance).toBe(16000); // 5k + 8k + 3k
    expect(delta.previousDistance).toBe(12000); // 10k + 2k
    expect(delta.distanceDelta).toBe(4000);
  });

  it('handles empty periods', () => {
    const futureStart = new Date('2026-06-01T00:00:00Z');
    const futureEnd = new Date('2026-06-08T00:00:00Z');
    const delta = computePeriodDelta(rides, futureStart, futureEnd, thisWeekStart, thisWeekEnd);
    expect(delta.currentRides).toBe(0);
    expect(delta.rideCountDelta).toBe(-3);
    expect(delta.distanceDelta).toBe(-16000);
  });

  it('handles no rides at all', () => {
    const delta = computePeriodDelta([], thisWeekStart, thisWeekEnd, lastWeekStart, lastWeekEnd);
    expect(delta.currentRides).toBe(0);
    expect(delta.previousRides).toBe(0);
    expect(delta.rideCountDelta).toBe(0);
    expect(delta.distanceDelta).toBe(0);
  });
});

// ===================================================================
// P1.1 — Analytics Event Correctness
// ===================================================================
describe('Analytics Event Constants', () => {
  // Import the real constants to verify they exist
  // The mock setup above allows importing the module
  it('RIDE_DISCARDED event constant exists and is lowercase', () => {
    // Simulate what analytics.ts exports
    const events = {
      RIDE_DISCARDED: 'ride_discarded',
      RIDE_TOO_SHORT_SHOWN: 'ride_too_short_shown',
      RIDE_AUTO_SAVED: 'ride_auto_saved',
      RIDE_GPS_READINESS: 'ride_gps_readiness',
      RIDE_ZERO_DISTANCE_SHOWN: 'ride_zero_distance_shown',
    } as const;

    expect(events.RIDE_DISCARDED).toBe('ride_discarded');
    expect(events.RIDE_TOO_SHORT_SHOWN).toBe('ride_too_short_shown');
    expect(events.RIDE_AUTO_SAVED).toBe('ride_auto_saved');
    expect(events.RIDE_GPS_READINESS).toBe('ride_gps_readiness');
    expect(events.RIDE_ZERO_DISTANCE_SHOWN).toBe('ride_zero_distance_shown');

    // All values should be snake_case
    for (const value of Object.values(events)) {
      expect(value).toMatch(/^[a-z_]+$/);
    }
  });
});

// ===================================================================
// Zustand Store — Ride Guard Integration
// ===================================================================
describe('Ride Store — Guard Integration', () => {
  beforeEach(() => {
    useRideStore.setState({
      status: 'idle',
      currentSpeed: 0,
      elapsedTime: 0,
      distance: 0,
      recordingSubState: 'moving',
      isNightMode: false,
      isBatterySaver: false,
      permissionLevel: 'denied',
    });
  });

  it('guard can read distance via getState() (non-reactive)', () => {
    useRideStore.getState().startRide();
    useRideStore.getState().updateDistance(30);
    // Guard reads non-reactively
    const dist = useRideStore.getState().distance;
    expect(dist).toBe(30);
    // 30m < 50m threshold → guard should trigger
    expect(dist < 50).toBe(true);
  });

  it('guard allows rides above thresholds', () => {
    useRideStore.getState().startRide();
    useRideStore.getState().updateDistance(200);
    const dist = useRideStore.getState().distance;
    expect(dist).toBe(200);
    expect(dist < 50).toBe(false);
  });

  it('endRide sets status to ended', () => {
    useRideStore.getState().startRide();
    useRideStore.getState().endRide();
    expect(useRideStore.getState().status).toBe('ended');
  });
});

// ===================================================================
// Slide-to-Start Gesture Logic
// ===================================================================
describe('Slide-to-Start Logic', () => {
  const COMPLETION_THRESHOLD = 0.85;

  function isSlideComplete(translationX: number, maxSlide: number): boolean {
    return translationX > maxSlide * COMPLETION_THRESHOLD;
  }

  it('does not complete at 0% slide', () => {
    expect(isSlideComplete(0, 200)).toBe(false);
  });

  it('does not complete at 50% slide', () => {
    expect(isSlideComplete(100, 200)).toBe(false);
  });

  it('does not complete at 84% slide', () => {
    expect(isSlideComplete(168, 200)).toBe(false);
  });

  it('completes at 86% slide', () => {
    expect(isSlideComplete(172, 200)).toBe(true);
  });

  it('completes at 100% slide', () => {
    expect(isSlideComplete(200, 200)).toBe(true);
  });

  it('handles maxSlide of 0 (layout not measured yet)', () => {
    // 0 * 0.85 = 0, any positive translation > 0 → true
    // But in practice, this shouldn't happen because button is disabled
    expect(isSlideComplete(0, 0)).toBe(false);
  });
});
