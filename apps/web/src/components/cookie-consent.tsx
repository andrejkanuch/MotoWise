'use client';

import posthog from 'posthog-js';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const CONSENT_COOKIE = 'motovault_cookie_consent';

function getConsent(): boolean | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]*)`));
  if (!match) return null;
  return match[1] === 'granted';
}

function setConsent(granted: boolean) {
  const maxAge = 365 * 24 * 60 * 60; // 1 year
  // biome-ignore lint/suspicious/noDocumentCookie: this IS the consent primitive itself
  document.cookie = `${CONSENT_COOKIE}=${granted ? 'granted' : 'denied'}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

// PostHog is initialized with `opt_out_capturing_by_default: true` +
// `persistence: 'memory'` in instrumentation-client.ts. These helpers flip
// capture on/off based on the user's cookie-banner choice and are the
// single source of truth for PostHog consent on the web.
function applyPostHogConsent(granted: boolean) {
  if (typeof window === 'undefined') return;
  if (granted) {
    posthog.set_config({ persistence: 'localStorage+cookie' });
    posthog.opt_in_capturing();
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
// together when the user clicks Accept or Decline. Without this, each
// `useCookieConsent()` call would have its own React state and downstream
// gates would only pick up changes on the next reload.
export function CookieConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsentState] = useState<boolean | null>(null);

  useEffect(() => {
    const current = getConsent();
    setConsentState(current);
    if (current !== null) applyPostHogConsent(current);
  }, []);

  const accept = useCallback(() => {
    setConsent(true);
    setConsentState(true);
    applyPostHogConsent(true);
  }, []);

  const deny = useCallback(() => {
    setConsent(false);
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

export function CookieConsentBanner() {
  const { consent, accept, deny } = useCookieConsent();

  // Don't render if consent already given (accepted or denied)
  if (consent !== null) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(10, 10, 10, 0.95)',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '16px 24px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        backdropFilter: 'blur(8px)',
      }}
    >
      <p
        style={{
          color: 'rgba(255, 255, 255, 0.8)',
          fontSize: '14px',
          margin: 0,
          maxWidth: '600px',
          lineHeight: 1.5,
        }}
      >
        We use cookies for analytics and advertising measurement.{' '}
        <a
          href="/privacy"
          style={{ color: 'rgba(255, 255, 255, 0.9)', textDecoration: 'underline' }}
        >
          Privacy Policy
        </a>
      </p>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          type="button"
          onClick={deny}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            backgroundColor: 'transparent',
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          Decline
        </button>
        <button
          type="button"
          onClick={accept}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: '#FF6B35',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Accept
        </button>
      </div>
    </div>
  );
}
