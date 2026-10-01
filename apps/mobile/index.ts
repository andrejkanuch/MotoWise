// Bundle entry. CarPlay must register BEFORE the router: a CarPlay-only cold launch
// (rider taps the MotoVault tile with the phone app not running) has no phone window
// scene, so the expo-router root layout — and every effect in it — may never mount.
// A side effect imported here runs when the bundle is evaluated, independent of any
// surface. Imports only, and the order is load-bearing (pinned by carplay-entry.test):
// the timer swap must precede every module that might capture setTimeout.
import './src/features/carplay/install-timers';
import '@expo/metro-runtime';
import './src/features/carplay/carplay-entry';
import 'expo-router/entry';
