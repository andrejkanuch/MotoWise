// Module-scope CarPlay registration, imported by the bundle entry (index.ts) before
// expo-router. The library only renders a CarPlay root template that JS sets from
// inside its `didConnect` listener — with no listener registered, a head unit that
// launched the app shows a blank screen until the phone UI happens to start it.
import { captureException } from '../../lib/analytics';
import { startCarPlayCoordinator } from './carplay-coordinator';

// Runs at bundle evaluation, ahead of the router: an uncaught throw here (e.g. from
// the synchronous first render when a head unit is already attached) would abort the
// whole bundle, phone UI included.
try {
  startCarPlayCoordinator();
} catch (err) {
  captureException(err, { source: 'carplay-entry.start' });
}
