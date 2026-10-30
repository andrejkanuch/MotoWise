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
      }}
    >
      {/* Icon: one step up the ramp, hairline — no glow */}
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: 'var(--mv-radius-card)',
          background: 'var(--mv-surface)',
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
          stroke="var(--mv-ink-2)"
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
        className="mv-display"
        style={{
          fontSize: 'clamp(32px, 4.5vw, 52px)',
          fontWeight: 700,
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
          className="mv-figure"
          style={{
            marginTop: '12px',
            fontSize: '13px',
            color: 'var(--mv-ink-4)',
          }}
        >
          Ref: {error.digest}
        </p>
      )}

      <button
        onClick={reset}
        type="button"
        className="mv-btn mv-btn-primary"
        style={{ marginTop: '40px' }}
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
