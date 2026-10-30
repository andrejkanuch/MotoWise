'use client';

import * as Sentry from '@sentry/nextjs';
import { RotateCw } from 'lucide-react';
import { useEffect } from 'react';
import '@/components/marketing/design-system.css';

// Root-level error.tsx renders outside the [locale] segment, so next-intl is
// unavailable here. Strings are English only.

/* The shared hero shell on the page container; H1 at the page-title size,
   body face, one copper action; left-aligned on the ground. The copy names
   what failed and the way out. */
const ERROR_CSS = `
.err {
  min-height: 100vh;
  display: flex; flex-direction: column; justify-content: center;
  max-width: var(--mv-container);
  margin: 0 auto;
  background: var(--mv-bg);
}
.err-status { margin: 0 0 24px; font-size: 15px; line-height: 20px; color: var(--mv-ink-3); }
.err-title { margin: 0 0 20px; color: var(--mv-ink); }
.err-message { max-width: 50ch; margin: 0; font-size: 17px; line-height: 1.55; color: var(--mv-ink-2); text-wrap: pretty; }
.err-ref { margin: 12px 0 0; font-family: var(--mv-font-mono); font-size: 12px; line-height: 16px; color: var(--mv-ink-3); overflow-wrap: anywhere; }
.err-actions { margin-top: 32px; }
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
      <main className="err mv-section-hero">
        <p className="err-status">Error</p>
        <h1 className="mv-section-title err-title">This page didn&apos;t load.</h1>
        <p className="err-message">
          Try again. If it keeps failing, write to{' '}
          <a href="mailto:support@motovault.app" className="mv-link">
            support@motovault.app
          </a>
          .
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
