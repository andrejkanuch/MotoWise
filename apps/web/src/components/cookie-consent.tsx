'use client';

import posthog from 'posthog-js';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

// First-party consent cookie. Format: v1:{accepted|rejected}:{epoch}:EU
// e.g. "v1:rejected:1744329600:EU" — 6 month lifetime (EDPB 03/2022).
const CONSENT_COOKIE = 'mv_consent';
const COOKIE_MAX_AGE = 15_552_000; // 6 months in seconds

type Decision = 'accepted' | 'rejected';

function parseConsent(): Decision | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]*)`));
  if (!match) return null;
  const parts = decodeURIComponent(match[1]).split(':');
  if (parts.length < 2 || parts[0] !== 'v1') return null;
  if (parts[1] === 'accepted' || parts[1] === 'rejected') return parts[1];
  return null;
}

function writeConsent(decision: Decision) {
  const epoch = Math.floor(Date.now() / 1000);
  const value = `v1:${decision}:${epoch}:EU`;
  // Use runtime protocol detection so `Secure` is added for any HTTPS origin
  // (production, Vercel previews, staging) and omitted for plain http://
  // (local `next start`, docker dev) where the flag would silently reject
  // the cookie. `location.protocol` is preferred over `NODE_ENV` which is
  // `'production'` even in preview + local HTTPS builds.
  const secure =
    typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
  // biome-ignore lint/suspicious/noDocumentCookie: this IS the consent primitive itself
  document.cookie = `${CONSENT_COOKIE}=${value}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

// PostHog is initialized with `opt_out_capturing_by_default: true` +
// `persistence: 'memory'` in instrumentation-client.ts. These helpers flip
// capture on/off based on the user's cookie-banner choice and are the
// single source of truth for PostHog consent on the web.
let posthogScrollDepthStarted = false;

function startPostHogScrollDepthOnce() {
  if (posthogScrollDepthStarted || typeof window === 'undefined') return;
  posthogScrollDepthStarted = true;
  posthog.scrollManager.startMeasuringScrollPosition();
}

function applyPostHogConsent(granted: boolean) {
  if (typeof window === 'undefined') return;
  if (granted) {
    posthog.set_config({ persistence: 'localStorage+cookie' });
    posthog.opt_in_capturing();
    startPostHogScrollDepthOnce();
    posthog.capture('$consent_granted');
  } else {
    posthog.opt_out_capturing();
  }
}

type ConsentContextValue = {
  consent: boolean | null;
  accept: () => void;
  deny: () => void;
};

const ConsentContext = createContext<ConsentContextValue | null>(null);

// Shared consent state provider. Mount once near the root so every consumer
// (cookie banner, analytics-consent gate) sees the same value and re-renders
// together when the user clicks Accept or Reject. Without this, each
// `useCookieConsent()` call would have its own React state and downstream
// gates would only pick up changes on the next reload.
export function CookieConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsentState] = useState<boolean | null>(null);

  useEffect(() => {
    const current = parseConsent();
    const asBool = current === null ? null : current === 'accepted';
    setConsentState(asBool);
    if (asBool !== null) applyPostHogConsent(asBool);
  }, []);

  const accept = useCallback(() => {
    writeConsent('accepted');
    setConsentState(true);
    applyPostHogConsent(true);
  }, []);

  const deny = useCallback(() => {
    writeConsent('rejected');
    setConsentState(false);
    applyPostHogConsent(false);
  }, []);

  return (
    <ConsentContext.Provider value={{ consent, accept, deny }}>{children}</ConsentContext.Provider>
  );
}

export function useCookieConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) {
    throw new Error('useCookieConsent must be used within a CookieConsentProvider');
  }
  return ctx;
}

/**
 * Slim, edge-anchored cookie consent bar.
 *
 * Design notes:
 * - NOT a modal dialog — it is an `aria-live` region that the user can freely ignore.
 * - Three buttons with identical visual weight (Reject / Preferences / Accept) per
 *   EDPB Guidelines 03/2022 on deceptive design patterns.
 * - 44×44 min tap target, visible focus ring, 2px offset per WCAG 2.2.
 * - Mobile: floats 8px above the bottom edge, ~8vh tall on 390×844.
 * - Desktop: pinned to bottom-center, max-w 720px.
 */
export function CookieConsentBanner() {
  const { consent, accept, deny } = useCookieConsent();
  const [mounted, setMounted] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Avoid SSR hydration mismatch — render nothing until we've parsed the cookie.
  if (!mounted) return null;
  if (consent !== null) return null;

  return (
    <>
      <section
        aria-label="Cookie consent"
        aria-live="polite"
        className="fixed inset-x-2 bottom-2 z-[9999] rounded-2xl border border-neutral-800 bg-neutral-950/95 px-4 py-3 shadow-2xl backdrop-blur-md sm:left-1/2 sm:right-auto sm:inset-x-auto sm:max-w-[720px] sm:-translate-x-1/2 sm:bottom-4 sm:px-5 sm:py-3.5"
      >
        <div className="flex flex-col gap-2 min-[380px]:flex-row min-[380px]:items-center min-[380px]:gap-3">
          <p className="flex-1 text-[13px] leading-snug text-neutral-300">
            We use a cookie for privacy-friendly analytics (PostHog) to improve MotoVault. No ads,
            no cross-site tracking.{' '}
            <a href="/privacy" className="text-amber-400 underline hover:text-amber-300">
              Privacy policy
            </a>
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={deny}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 px-3 text-[13px] font-medium text-neutral-200 transition-colors hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
            >
              Reject all
            </button>
            <button
              type="button"
              onClick={() => setPrefsOpen(true)}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 px-3 text-[13px] font-medium text-neutral-200 transition-colors hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
            >
              Preferences
            </button>
            <button
              type="button"
              onClick={accept}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 px-3 text-[13px] font-medium text-neutral-200 transition-colors hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
            >
              Accept all
            </button>
          </div>
        </div>
      </section>

      {prefsOpen && (
        <PreferencesDialog
          onAcceptAll={() => {
            setPrefsOpen(false);
            accept();
          }}
          onRejectAll={() => {
            setPrefsOpen(false);
            deny();
          }}
          onClose={() => setPrefsOpen(false)}
        />
      )}
    </>
  );
}

// Minimal modal dialog stub. Intentionally lightweight — there's only a single
// analytics category right now, so "Accept essential only" === reject, and
// "Accept all" === accept. This is a real `role="dialog"` with focus trap
// and Esc handling so it can be expanded into a full category picker later.
function PreferencesDialog({
  onAcceptAll,
  onRejectAll,
  onClose,
}: {
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstButtonRef.current?.focus();

    // Lock body scroll while the dialog is open so background content doesn't
    // scroll behind the modal on mobile.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        // If focus has escaped the dialog (e.g. onto the backdrop), pull it
        // back in rather than cycling past.
        if (!dialogRef.current.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
          return;
        }
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center px-4">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close cookie preferences"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-neutral-950/80 backdrop-blur-sm"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-prefs-title"
        className="relative w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl"
      >
        <h2 id="cookie-prefs-title" className="text-lg font-semibold text-neutral-50">
          Cookie preferences
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-400">
          MotoVault uses one privacy-friendly analytics cookie (PostHog) to understand how visitors
          use the site. No advertising, no cross-site tracking, no data sold.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            ref={firstButtonRef}
            type="button"
            onClick={onAcceptAll}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-800 px-4 text-sm font-medium text-neutral-50 transition-colors hover:bg-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
          >
            Accept all
          </button>
          <button
            type="button"
            onClick={onRejectAll}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900 px-4 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
          >
            Accept essential only
          </button>
        </div>
      </div>
    </div>
  );
}
