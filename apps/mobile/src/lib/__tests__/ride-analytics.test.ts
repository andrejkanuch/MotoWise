const mockTrackEvent = jest.fn();
jest.mock('../analytics', () => ({
  AnalyticsEvent: { RIDE_COMPLETED: 'ride_completed' },
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

import { RIDE_SAVE_TRIGGER, rideCompletedProperties, trackRideCompleted } from '../ride-analytics';

beforeEach(() => mockTrackEvent.mockClear());

describe('rideCompletedProperties', () => {
  it('describes a ride saved from the summary', () => {
    expect(
      rideCompletedProperties({
        trigger: RIDE_SAVE_TRIGGER.SUMMARY,
        rideId: 'r1',
        motorcycleId: 'b1',
        distanceM: 42_349.6,
        durationS: 3_600.4,
        properties: { shared_to_discover: true },
      }),
    ).toEqual({
      shared_to_discover: true,
      ride_id: 'r1',
      motorcycle_id: 'b1',
      distance_m: 42_350,
      distance_km: 42.4,
      duration_s: 3_600,
      below_min_ride: false,
      save_trigger: 'summary',
      auto_ended: false,
    });
  });

  it('flags the headless auto-end and normalises a missing bike to null', () => {
    const props = rideCompletedProperties({
      trigger: RIDE_SAVE_TRIGGER.AUTO_END,
      rideId: 'r2',
      motorcycleId: '',
      distanceM: 0,
      durationS: 0,
    });
    expect(props).toMatchObject({
      motorcycle_id: null,
      distance_m: 0,
      distance_km: 0,
      save_trigger: 'auto_end',
      auto_ended: true,
      below_min_ride: true,
    });
  });

  it('tags rides under either HUD floor as below_min_ride', () => {
    const base = { trigger: RIDE_SAVE_TRIGGER.AUTO_END, rideId: 'r4', motorcycleId: 'b1' };
    // A Start tap left alone until the 30-minute auto-end: long, but nowhere.
    expect(
      rideCompletedProperties({ ...base, distanceM: 12, durationS: 1_800 }).below_min_ride,
    ).toBe(true);
    expect(
      rideCompletedProperties({ ...base, distanceM: 5_000, durationS: 20 }).below_min_ride,
    ).toBe(true);
    expect(rideCompletedProperties({ ...base, distanceM: 50, durationS: 30 }).below_min_ride).toBe(
      false,
    );
  });

  it('never lets path extras overwrite the canonical fields', () => {
    const props = rideCompletedProperties({
      trigger: RIDE_SAVE_TRIGGER.SUMMARY,
      rideId: 'r3',
      motorcycleId: null,
      distanceM: 1_000,
      durationS: 60,
      properties: { ride_id: 'spoofed', auto_ended: true },
    });
    expect(props.ride_id).toBe('r3');
    expect(props.auto_ended).toBe(false);
  });
});

describe('trackRideCompleted', () => {
  it('sends ride_completed with the built properties', () => {
    trackRideCompleted({
      trigger: RIDE_SAVE_TRIGGER.AUTO_END,
      rideId: 'r4',
      motorcycleId: 'b4',
      distanceM: 12_000,
      durationS: 900,
    });
    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).toHaveBeenCalledWith(
      'ride_completed',
      expect.objectContaining({ ride_id: 'r4', distance_km: 12, auto_ended: true }),
    );
  });
});
