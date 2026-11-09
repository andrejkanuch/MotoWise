jest.mock('react-native-mmkv', () => require('@/test/mocks').makeMmkvMock());
const mockReadEndedSummary = jest.fn();
jest.mock('../ride-controller', () => ({
  readEndedRideSummary: () => mockReadEndedSummary(),
  buildRideSummaryHref: (summary: { rideId: string }, opts: { recovered?: boolean }) => ({
    pathname: '/(modals)/ride-summary',
    params: { rideId: summary.rideId, recovered: opts.recovered ? '1' : '' },
  }),
}));

import { RIDE_ROUTE, rideEntryHref, rideRouteFor } from '../ride-route';

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

describe('rideEntryHref — an ended ride opens its review directly', () => {
  it('opens the stored summary of an ended ride, keeping its recovered flag', () => {
    mockReadEndedSummary.mockReturnValue({ rideId: 'ride-7', recovered: true });
    expect(rideEntryHref({ status: 'ended', recordingInterrupted: false })).toEqual({
      pathname: '/(modals)/ride-summary',
      params: { rideId: 'ride-7', recovered: '1' },
    });
  });

  it('falls back to Start Ride (which offers Review) when the summary is unreadable', () => {
    mockReadEndedSummary.mockReturnValue(null);
    expect(rideEntryHref({ status: 'ended', recordingInterrupted: false })).toBe(RIDE_ROUTE.START);
  });

  it('routes every other state exactly like rideRouteFor', () => {
    mockReadEndedSummary.mockClear();
    expect(rideEntryHref({ status: 'recording', recordingInterrupted: false })).toBe(
      RIDE_ROUTE.HUD,
    );
    expect(rideEntryHref({ status: 'recording', recordingInterrupted: true })).toBe(
      RIDE_ROUTE.START,
    );
    expect(rideEntryHref({ status: 'idle', recordingInterrupted: false })).toBe(RIDE_ROUTE.START);
    expect(mockReadEndedSummary).not.toHaveBeenCalled();
  });
});
