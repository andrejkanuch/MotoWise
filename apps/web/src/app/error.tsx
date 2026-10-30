'use client';

import * as Sentry from '@sentry/nextjs';
import { RotateCw } from 'lucide-react';
import { useEffect } from 'react';
import '@/components/marketing/design-system.css';

// Root-level error.tsx renders outside the [locale] segment, so next-intl is
// unavailable here. Strings are English only.

/* Condensed headline, body face, one copper action; left-aligned on the ground. */
const ERROR_CSS = `
.err {
  min-height: 100vh;
  display: flex; flex-direction: column; justify-content: center;
  max-width: var(--mv-container);
  margin: 0 auto;
  padding: 120px 40px 80px;
  background: var(--mv-bg);
}
.err-status { margin: 0 0 24px; font-size: 14px; color: var(--mv-ink-3); }
.err-title {
  margin: 0 0 20px;
  font-family: var(--mv-font-display); font-weight: 700;
  font-size: clamp(48px, 7vw, 96px); line-height: 0.94; letter-spacing: 0.002em;
  color: var(--mv-ink); text-wrap: balance;
}
.err-message { max-width: 50ch; margin: 0; font-size: 17px; line-height: 1.55; color: var(--mv-ink-2); }
.err-message a { color: var(--mv-copper-text); text-decoration: underline; text-underline-offset: 3px; }
.err-ref { margin: 12px 0 0; font-family: var(--mv-font-mono); font-size: 12px; color: var(--mv-ink-3); overflow-wrap: anywhere; }
.err-actions { margin-top: 36px; }
@media (max-width: 600px) { .err { padding: 100px 24px 64px; } }
`;

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="mv-marketing">
      <style>{ERROR_CSS}</style>
      <main className="err">
        <p className="err-status">Something went wrong</p>
        <h1 className="err-title">Hit a rough patch.</h1>
        <p className="err-message">
          Something broke on our end, not yours. Try again — if it keeps happening, write to{' '}
          <a href="mailto:support@motovault.app">support@motovault.app</a>.
        </p>
        {error.digest && <p className="err-ref">Ref: {error.digest}</p>}
        <div className="err-actions">
          <button type="button" onClick={reset} className="mv-btn mv-btn-primary">
            <RotateCw size={16} aria-hidden="true" />
            Try again
          </button>
        </div>
      </main>
    </div>
  );
}
