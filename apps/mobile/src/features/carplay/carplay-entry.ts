// Module-scope CarPlay registration, imported by the bundle entry (index.ts) before
// expo-router. The library only renders a CarPlay root template that JS sets from
// inside its `didConnect` listener — with no listener registered, a head unit that
// launched the app shows a blank screen until the phone UI happens to start it.
import { startCarPlayCoordinator } from './carplay-coordinator';

startCarPlayCoordinator();
