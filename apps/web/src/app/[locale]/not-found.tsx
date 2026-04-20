import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function NotFound() {
  const t = useTranslations('NotFound');

  return (
    <div
      className="mv-marketing"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        background: 'var(--mv-bg)',
        color: 'var(--mv-ink)',
        textAlign: 'center',
        overflow: 'hidden',
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
          width: '800px',
          height: '600px',
          background:
            'radial-gradient(ellipse 60% 50% at 50% 50%, oklch(0.76 0.18 60 / 0.06), transparent 70%)',
          zIndex: -1,
          pointerEvents: 'none',
        }}
      />

      {/* Mono label */}
      <div className="mv-section-meta" style={{ justifyContent: 'center', display: 'inline-flex' }}>
        {t('label')}
      </div>

      {/* Large 404 */}
      <h1
        style={{
          fontSize: 'clamp(120px, 20vw, 240px)',
          fontWeight: 500,
          letterSpacing: '-0.06em',
          lineHeight: 0.85,
          margin: 0,
          color: 'oklch(1 0 0 / 0.04)',
          position: 'relative',
        }}
      >
        <span
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background:
              'linear-gradient(180deg, var(--mv-warm-400), var(--mv-warm-500), var(--mv-warm-900))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          {t('code')}
        </span>
        {t('code')}
      </h1>

      {/* Message */}
      <p
        style={{
          marginTop: '32px',
          fontSize: '18px',
          color: 'var(--mv-ink-3)',
          lineHeight: 1.55,
          letterSpacing: '-0.01em',
          maxWidth: '420px',
        }}
      >
        {t('message')}
      </p>

      {/* CTA */}
      <Link
        href="/"
        style={{
          marginTop: '48px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '10px',
          padding: '14px 28px',
          borderRadius: '999px',
          fontWeight: 600,
          fontSize: '14px',
          textDecoration: 'none',
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
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        {t('backHome')}
      </Link>

      {/* Decorative road line */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '2px',
          height: '120px',
          background:
            'linear-gradient(180deg, oklch(0.76 0.18 60 / 0.3), transparent)',
        }}
      />
    </div>
  );
}
