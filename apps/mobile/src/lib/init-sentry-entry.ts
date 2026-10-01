// Bundle-entry side effect (index.ts): initialize Sentry before CarPlay registers.
// A CarPlay-only cold launch never renders the expo-router root, and expo-router
// evaluates route modules lazily, so an initSentry() call in _layout.tsx never runs
// on that launch. Every captureException the coordinator makes there would go to an
// uninitialized client and be dropped. initSentry is a no-op without a DSN, and its
// navigation integration only needs registerNavigationContainer, which the root
// layout still calls once the phone UI mounts.
import { initSentry } from './analytics';

initSentry();
