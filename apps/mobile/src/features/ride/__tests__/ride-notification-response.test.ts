// What each press on a forgotten-ride notification does. The one rule that matters
// most: only the explicit "End ride" button ends a ride — a plain tap navigates.

jest.mock('../../../lib/notifications', () => ({
  NOTIFICATION_ACTION: { END_RIDE: 'END_RIDE', KEEP_RIDING: 'KEEP_RIDING' },
}));
jest.mock('../../../stores/ride.store', () => {
  const store = { status: 'recording' as string };
  return { useRideStore: { getState: () => store } };
});
jest.mock('../../../utils/ride-storage', () => {
  const state = { currentId: 'ride-1' as string | undefined };
  return { __state: state, rideMMKV: { getCurrentId: () => state.currentId } };
});
jest.mock('../ride-controller', () => ({
  endRideSession: jest.fn(() => ({ rideId: 'ride-1' })),
  buildRideSummaryHref: jest.fn(() => '/summary-href'),
}));
jest.mock('../ride-reminders', () => ({
  armRideReminders: jest.fn(() => Promise.resolve()),
  rideEndTrimTarget: jest.fn(() => 4_000_000),
}));

import { useRideStore } from '../../../stores/ride.store';
import * as storage from '../../../utils/ride-storage';
import { endRideSession } from '../ride-controller';
import {
  __resetRideIdleResponsesForTest,
  handleRideIdleResponse,
  rideIdleResponseKey,
} from '../ride-notification-response';
import { armRideReminders } from '../ride-reminders';

// biome-ignore lint/suspicious/noExplicitAny: reaching into the mock's mutable state
const state = (storage as any).__state as { currentId: string | undefined };
const store = useRideStore.getState() as { status: string };
const endRide = endRideSession as jest.Mock;
const arm = armRideReminders as jest.Mock;
const DEFAULT_TAP = 'expo.modules.notifications.actions.DEFAULT';

let n = 0;
const key = () => `notif-${++n}`;

beforeEach(() => {
  jest.clearAllMocks();
  __resetRideIdleResponsesForTest();
  state.currentId = 'ride-1';
  store.status = 'recording';
});

it('"End ride" ends the ride trimmed to the last movement and opens the summary', () => {
  const target = handleRideIdleResponse(key(), 'END_RIDE', { rideId: 'ride-1' });
  expect(endRide).toHaveBeenCalledWith('phone', { endAt: 4_000_000 });
  expect(target).toBe('/summary-href');
});

it('a plain tap never ends the ride — it opens the live HUD', () => {
  const target = handleRideIdleResponse(key(), DEFAULT_TAP, { rideId: 'ride-1' });
  expect(endRide).not.toHaveBeenCalled();
  expect(target).toBe('/(modals)/ride-hud');
});

it('after an app kill a plain tap opens Start Ride, which offers Resume / End', () => {
  store.status = 'idle';
  expect(handleRideIdleResponse(key(), DEFAULT_TAP, { rideId: 'ride-1' })).toBe(
    '/(modals)/start-ride',
  );
});

it('"Still riding" restarts the reminder clock and stays put', () => {
  expect(handleRideIdleResponse(key(), 'KEEP_RIDING', { rideId: 'ride-1' })).toBeNull();
  expect(arm).toHaveBeenCalledTimes(1);
  expect(endRide).not.toHaveBeenCalled();
});

it('an already auto-ended ride opens the saved ride', () => {
  expect(handleRideIdleResponse(key(), DEFAULT_TAP, { rideId: 'ride-9', autoEnded: true })).toBe(
    '/ride/ride-9',
  );
});

it('ignores a reminder for a ride that is no longer the active one', () => {
  state.currentId = 'ride-2';
  expect(handleRideIdleResponse(key(), 'END_RIDE', { rideId: 'ride-1' })).toBeNull();
  state.currentId = undefined;
  expect(handleRideIdleResponse(key(), 'END_RIDE', { rideId: 'ride-1' })).toBeNull();
  expect(endRide).not.toHaveBeenCalled();
});

it('acts on the same response only once (listener + cold-start check)', () => {
  const k = key();
  handleRideIdleResponse(k, 'END_RIDE', { rideId: 'ride-1' });
  expect(handleRideIdleResponse(k, 'END_RIDE', { rideId: 'ride-1' })).toBeNull();
  expect(endRide).toHaveBeenCalledTimes(1);
});

it('keys a response by notification and button', () => {
  const response = {
    actionIdentifier: 'END_RIDE',
    notification: { request: { identifier: 'n1' } },
  };
  expect(rideIdleResponseKey(response)).toBe('n1:END_RIDE');
});
