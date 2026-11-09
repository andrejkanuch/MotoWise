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

function hydrateRide(source: string): void {
  try {
    useRideStore.getState().hydrate();
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
