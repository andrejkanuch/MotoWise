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
import { gpsStartCount, probeLocationRecording } from '../../utils/ride-location';
import { RIDE_PHASE, readRideRecord } from '../../utils/ride-storage';

/**
 * Whether the open ride is really recording, checked at launch and on every
 * return to the foreground. A relaunched process cannot know whether the OS
 * restarted the GPS task, and a live one can lose it (the OS stopped it, the
 * rider force-stopped location). GPS is deliberately NOT restarted here: reviving
 * a ride without the rider is how a ride an older version had already ended
 * would be recorded onto. An unconfirmed ride sends the rider to Start Ride (or
 * the head unit) to choose Resume or End.
 *
 * Marking the ride interrupted needs care: a (re)start that began while GPS was
 * being asked would be overwritten and its ride routed to Start Ride. The GPS
 * start counter rules that out: the flag is set only when no start began during
 * the check.
 */
async function checkRecording(): Promise<void> {
  const record = readRideRecord();
  if (!record || record.phase === RIDE_PHASE.ENDED) return;
  const generation = gpsStartCount();
  const recording = await probeLocationRecording();
  // A failed query says nothing either way.
  if (recording === null) return;
  // The ride may have moved on (ended, replaced) while we asked.
  const current = readRideRecord();
  if (current?.rideId !== record.rideId || current.phase === RIDE_PHASE.ENDED) return;
  if (recording) {
    useRideStore.setState({ recordingInterrupted: false });
    return;
  }
  if (gpsStartCount() !== generation) return;
  useRideStore.setState({ recordingInterrupted: true });
}

function hydrateRide(source: string): void {
  try {
    useRideStore.getState().hydrate();
    void checkRecording().catch((err) => captureException(err, { source: `${source}.gps` }));
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
