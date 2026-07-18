import type { ErrorEvent } from '@sentry/nextjs';
import type { CaptureResult } from 'posthog-js';

/**
 * Client-side error-tracking noise filter, shared by Sentry and PostHog.
 *
 * Marketing pages are viewed heavily inside in-app browser webviews (the iOS
 * Google/Facebook apps) and behind third-party scripts (Meta Pixel, PostHog).
 * Those environments surface errors through the global `onerror` /
 * `onunhandledrejection` handlers that never originate in first-party code —
 * they arrive stackless or with a single opaque `undefined`-filename frame.
 *
 * Both Sentry (`capture_exceptions` off; wired via `beforeSend`) and PostHog
 * (`capture_exceptions: true`; wired via `before_send`) autocapture these
 * globals, so the drop rules live here once and are applied to both. Sentry's
 * `ErrorEvent` and PostHog's `$exception` event carry the same exception shape
 * (`type` / `value` / `mechanism.type` / `stacktrace.frames[].filename`), so
 * each adapter just projects its event onto the minimal shape below.
 *
 * Each rule is scoped so a genuine first-party error carrying real
 * `/_next/static` frames still reports. Returning `true` drops the event.
 */
interface NoiseException {
  type?: string;
  value?: string;
  mechanism?: { type?: string };
  stacktrace?: { frames?: { filename?: string }[] };
}

/**
 * The shared drop decision. Operates on the exception list common to both
 * Sentry and PostHog; the per-provider adapters below extract it.
 */
function shouldDropExceptions(exceptions: NoiseException[] | undefined): boolean {
  if (!exceptions?.length) return false;

  // Presence of a first-party `/_next/static` frame anywhere in the event's
  // exception chain. Computed across ALL exceptions (not per-exception) so a
  // frameless third-party throw never drops an event that also carries a
  // genuine first-party frame on a different exception in the list.
  const hasFirstPartyFrame = exceptions.some((e) =>
    e.stacktrace?.frames?.some((f) => f.filename?.includes('/_next/static')),
  );

  // ResizeObserver loop notifications — benign browser churn, never actionable.
  if (exceptions.some((e) => e.value?.includes('ResizeObserver loop'))) {
    return true;
  }

  // Un-actionable third-party "SecurityError: The request was denied."
  // (DOMException 18) unhandled rejections. These come from third-party scripts
  // or in-app-browser webviews accessing storage/Web APIs the device denies —
  // never from first-party code, so they arrive stackless. Only the frameless
  // ones are suppressed; a genuine first-party SecurityError carries a
  // stacktrace and still reports.
  if (
    exceptions.some(
      (e) =>
        e.type === 'SecurityError' &&
        e.value?.includes('The request was denied') &&
        !e.stacktrace?.frames?.length,
    )
  ) {
    return true;
  }

  // "Connection closed." unhandled rejections from the React RSC/Flight stream
  // (MOTOVAULT-WEB-V/H). The server stream is severed mid-render when the user
  // navigates away, backgrounds the tab, or drops the network — the framework
  // recovers by refetching, so nothing is user-visible or actionable. Scoped to
  // the global unhandledrejection mechanism so a future subsystem that throws
  // (and reports) the same generic message still surfaces.
  if (
    exceptions.some(
      (e) =>
        e.value === 'Connection closed.' &&
        e.mechanism?.type?.endsWith('onunhandledrejection') === true,
    )
  ) {
    return true;
  }

  // "window.webkit.messageHandlers" TypeErrors (MOTOVAULT-WEB-Y). Injected by
  // the Meta in-app browser (Instagram/Facebook webview) — its native bridge
  // shims (`sendDataToNative`/`sendPageHideMessage`) probe `window.webkit`,
  // which is absent/undefined in that webview, and the throw bubbles to our
  // global onerror. Our marketing pages never touch the webkit bridge, so any
  // report carrying this message is third-party. Scoped to events with no
  // first-party `/_next/static` frame — a genuine first-party throw would carry
  // one and still report.
  if (
    !hasFirstPartyFrame &&
    exceptions.some(
      (e) => e.type === 'TypeError' && e.value?.includes('window.webkit.messageHandlers'),
    )
  ) {
    return true;
  }

  // "Maximum call stack size exceeded" with no first-party frames
  // (MOTOVAULT-WEB-X). Injected by iOS in-app-browser webviews (e.g. the Google
  // app) and surfaced via the global onerror handler as a single opaque
  // `undefined`-filename frame. The routes that report it (e.g. the blog
  // article page) are fully server-rendered with trivial client components, so
  // no first-party recursion is possible. A real recursion in our bundle
  // carries `/_next/static` frames (with filenames) and still reports.
  if (
    exceptions.some(
      (e) =>
        e.value?.includes('Maximum call stack size exceeded') &&
        !e.stacktrace?.frames?.some((f) => f.filename),
    )
  ) {
    return true;
  }

  return false;
}

/**
 * Sentry adapter — `beforeSend` in instrumentation-client.ts.
 */
export function shouldDropClientEvent(event: ErrorEvent): boolean {
  return shouldDropExceptions(event.exception?.values);
}

/**
 * PostHog adapter — `before_send` in instrumentation-client.ts.
 *
 * PostHog's `$exception` autocapture stores the exception chain on
 * `properties.$exception_list`. Non-`$exception` events carry no such list, so
 * `shouldDropExceptions` returns `false` and they pass through untouched.
 */
export function shouldDropPostHogEvent(event: CaptureResult | null): boolean {
  if (!event) return false;
  return shouldDropExceptions(event.properties?.$exception_list as NoiseException[] | undefined);
}
