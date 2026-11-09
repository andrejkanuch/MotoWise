// Module-scope ride hydration, imported by the bundle entry (index.ts) before
// CarPlay registers and before the router. The ride store is a projection of the
// persisted ride (see readRideRecord); after the app is killed it starts empty,
// and every surface read it as "no ride" — the phone offered Start, CarPlay showed
// READY with Start — while a ride was still open on the phone. Projecting here
// means the first frame of any surface, CarPlay-only launches included, already
// shows the real ride.
import { AppState } from 'react-native';
import { captureException } from '../../lib/analytics';
import { useRideStore } from '../../stores/ride.store';
import { isLocationRecording } from '../../utils/ride-location';
import { RIDE_PHASE, readRideRecord } from '../../utils/ride-storage';

/**
 * Whether the open ride is really recording. A relaunched process cannot know:
 * the OS may or may not have restarted the GPS task. GPS is deliberately NOT
 * restarted here — reviving a ride without the rider is how a ride an older
 * version had already ended would be recorded onto — so an unconfirmed ride
 * sends the rider to Start Ride to choose Resume or End.
 *
 * Only ever CLEARS the flag (hydrate is what sets it, for a ride this process
 * did not see start): setting it here could overwrite a resume that finished
 * while this check was in flight, and route a recording ride to Start Ride.
 */
async function confirmRecording(): Promise<void> {
  const record = readRideRecord();
  if (!record || record.phase === RIDE_PHASE.ENDED) return;
  if (!(await isLocationRecording())) return;
  // The ride may have moved on (ended, replaced) while we asked.
  if (readRideRecord()?.rideId !== record.rideId) return;
  useRideStore.setState({ recordingInterrupted: false });
}

function hydrateRide(source: string): void {
  try {
    useRideStore.getState().hydrate();
    void confirmRecording().catch((err) => captureException(err, { source: `${source}.gps` }));
  } catch (err) {
    // A corrupt record must never abort the bundle (phone UI included).
    captureException(err, { source });
  }
}

hydrateRide('ride-entry.hydrate');

// Coming back to the foreground: the GPS task, a notification action or the
// server may have moved the ride on while this process was backgrounded.
AppState.addEventListener('change', (state) => {
  if (state === 'active') hydrateRide('ride-entry.hydrate-active');
});
