'use client';

import { useTranslations } from 'next-intl';

export default function MarketingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('Error');

  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '120px 24px',
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
      <div className="mv-section-meta" style={{ justifyContent: 'center', display: 'inline-flex' }}>
        {t('label')}
      </div>

      {/* Icon */}
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '16px',
          background: 'oklch(1 0 0 / 0.04)',
          border: '1px solid var(--mv-line)',
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
          stroke="var(--mv-warm-500)"
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

      <h2
        style={{
          fontSize: 'clamp(28px, 4vw, 44px)',
          fontWeight: 500,
          letterSpacing: '-0.03em',
          lineHeight: 1,
          margin: 0,
          color: 'var(--mv-ink)',
        }}
      >
        {t('title')}
      </h2>

      <p
        style={{
          marginTop: '16px',
          fontSize: '16px',
          color: 'var(--mv-ink-3)',
          lineHeight: 1.55,
          maxWidth: '420px',
        }}
      >
        {t('message')}
      </p>

      {error.digest && (
        <p
          className="mv-mono"
          style={{
            marginTop: '12px',
            fontSize: '11px',
            color: 'var(--mv-ink-4)',
            letterSpacing: '0.04em',
          }}
        >
          REF: {error.digest}
        </p>
      )}

      <button
        onClick={reset}
        type="button"
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
          background: 'var(--mv-ink)',
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
        {t('retry')}
      </button>
    </div>
  );
}
