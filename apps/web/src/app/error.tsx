'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

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
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        background: 'oklch(0.12 0.01 55)',
        color: 'oklch(0.98 0.006 80)',
        textAlign: 'center',
        position: 'relative',
        isolation: 'isolate',
      }}
    >
      {/* Radial glow */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '40%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '600px',
          height: '400px',
          background:
            'radial-gradient(ellipse 60% 50% at 50% 50%, oklch(0.76 0.18 60 / 0.05), transparent 70%)',
          zIndex: -1,
          pointerEvents: 'none',
        }}
      />

      {/* Mono label */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '16px',
          fontFamily: "'Geist Mono', monospace",
          fontSize: '11px',
          color: 'oklch(0.58 0.012 65)',
          letterSpacing: '0.2em',
          textTransform: 'uppercase' as const,
          marginBottom: '32px',
        }}
      >
        <span
          style={{
            width: '28px',
            height: '1px',
            background: 'oklch(0.76 0.18 60)',
          }}
        />
        Error
      </div>

      {/* Warning icon */}
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '16px',
          background: 'oklch(1 0 0 / 0.04)',
          border: '1px solid oklch(1 0 0 / 0.07)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '32px',
        }}
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="oklch(0.76 0.18 60)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>

      <h1
        style={{
          fontSize: 'clamp(28px, 4vw, 44px)',
          fontWeight: 500,
          letterSpacing: '-0.03em',
          lineHeight: 1,
          margin: 0,
        }}
      >
        Hit a rough patch
      </h1>

      <p
        style={{
          marginTop: '16px',
          fontSize: '16px',
          color: 'oklch(0.58 0.012 65)',
          lineHeight: 1.55,
          maxWidth: '420px',
        }}
      >
        Something broke on our end, not yours. Try reloading the page — if it keeps happening, reach
        out to{' '}
        <a href="mailto:support@motovault.app" style={{ color: 'oklch(0.84 0.15 68)' }}>
          support@motovault.app
        </a>
        .
      </p>

      {error.digest && (
        <p
          style={{
            marginTop: '12px',
            fontFamily: "'Geist Mono', monospace",
            fontSize: '11px',
            color: 'oklch(0.4 0.012 60)',
            letterSpacing: '0.04em',
          }}
        >
          REF: {error.digest}
        </p>
      )}

      <button
        type="button"
        onClick={reset}
        style={{
          marginTop: '40px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '10px',
          padding: '14px 28px',
          borderRadius: '999px',
          fontWeight: 600,
          fontSize: '14px',
          cursor: 'pointer',
          letterSpacing: '-0.005em',
          background: 'oklch(0.98 0.006 80)',
          color: 'oklch(0.15 0.02 55)',
          border: 'none',
          transition: 'opacity 0.2s',
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M23 4v6h-6M1 20v-6h6" />
          <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
        </svg>
        Try again
      </button>
    </div>
  );
}
