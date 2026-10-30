'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

/** Replaces the root layout when it crashes, so no stylesheet or font is
 *  loaded here: plain markup, the same copy as app/error.tsx (what failed
 *  and the way out), one action. */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main>
          <p>Error</p>
          <h1>This page didn&apos;t load.</h1>
          <p>
            Try again. If it keeps failing, write to{' '}
            <a href="mailto:support@motovault.app">support@motovault.app</a>.
          </p>
          {error.digest && <p>Ref: {error.digest}</p>}
          <p>
            <button type="button" onClick={() => window.location.reload()}>
              Try again
            </button>
          </p>
        </main>
      </body>
    </html>
  );
}
