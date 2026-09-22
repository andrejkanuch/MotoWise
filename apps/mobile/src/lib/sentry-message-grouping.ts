// -------------------------------------------------------------------
// Stable grouping for intentional `captureMessage` signals
// -------------------------------------------------------------------
// `@sentry/react-native` defaults `attachStacktrace` to true
// (node_modules/@sentry/react-native/dist/js/sdk.js), so every MESSAGE event
// carries a SYNTHETIC stack of whatever frames happened to be live at capture
// time — and Sentry's default grouping hashes that stack, not the message.
//
// One string therefore fragments across several issues, each titled after an
// unrelated frame rather than the message:
//
//   -2T  "captureMessage"      <- "Sign-out with unsynced ride data…"
//   -39  "anonymous"           <- the same string, captured from inside the
//                                 Supabase auth listener's async callback
//   -33  "I18n#loadLanguages"  <- "Auth hydration timeout — forcing app ready"
//
// Fingerprinting on the message collapses each signal back to one issue.
// Flipping `attachStacktrace` off globally would fix it too, but would also
// change grouping for every ERROR event — including the tuned GraphQL
// fingerprints in analytics.ts (MOTO-VAULT-REACT-NATIVE-1J / -1M). Scope the
// change to message events only.
//
// Extracted from analytics.ts so the rule is unit-testable without the Sentry
// SDK, and so `sentryBeforeSend` gains exactly one short block.
// -------------------------------------------------------------------

/** Namespace so a message fingerprint can never collide with a GraphQL one. */
export const MESSAGE_FINGERPRINT_PREFIX = 'motovault.message';

/** The minimal event shape this module reads — avoids importing Sentry types. */
export interface FingerprintableEvent {
  exception?: unknown;
  message?: unknown;
}

/**
 * True for a message event.
 *
 * In the Sentry JS SDK a `captureMessage` event is an `ErrorEvent` with no
 * `exception` payload and a string `message`. That is also why the existing
 * `sentryBeforeSend` filters never touched these events: every branch keys off
 * `event.exception?.values?.[0]`, which is undefined here.
 */
export function isMessageEvent(event: FingerprintableEvent): boolean {
  return !event.exception && typeof event.message === 'string';
}

/** One issue per distinct message string, regardless of the synthetic stack. */
export function messageFingerprint(message: string): string[] {
  return [MESSAGE_FINGERPRINT_PREFIX, message];
}
