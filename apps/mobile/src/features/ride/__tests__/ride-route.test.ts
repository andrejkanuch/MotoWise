jest.mock('react-native-mmkv', () => require('@/test/mocks').makeMmkvMock());

import { RIDE_ROUTE, rideRouteFor } from '../ride-route';

describe('rideRouteFor — where "the ride" leads from the tab button, Home and a reminder tap', () => {
  it('opens the live HUD for a ride this app is recording or has paused', () => {
    expect(rideRouteFor({ status: 'recording', recordingInterrupted: false })).toBe(RIDE_ROUTE.HUD);
    expect(rideRouteFor({ status: 'paused', recordingInterrupted: false })).toBe(RIDE_ROUTE.HUD);
  });

  it('opens Start Ride for an open ride whose GPS is not confirmed after a relaunch', () => {
    expect(rideRouteFor({ status: 'recording', recordingInterrupted: true })).toBe(
      RIDE_ROUTE.START,
    );
    expect(rideRouteFor({ status: 'paused', recordingInterrupted: true })).toBe(RIDE_ROUTE.START);
  });

  it('opens Start Ride with no ride, and for an ended ride (reviewed there)', () => {
    expect(rideRouteFor({ status: 'idle', recordingInterrupted: false })).toBe(RIDE_ROUTE.START);
    expect(rideRouteFor({ status: 'ended', recordingInterrupted: false })).toBe(RIDE_ROUTE.START);
  });
});
