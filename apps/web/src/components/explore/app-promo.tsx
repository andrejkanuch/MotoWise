import { MonoLabel } from './primitives';

export function AppPromo() {
  return (
    <section
      style={{
        position: 'relative',
        padding: '48px 40px',
        background: 'linear-gradient(135deg, oklch(0.18 0.02 50), oklch(0.11 0.01 30))',
        border: '1px solid var(--mv-line)',
        borderRadius: 22,
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: '1.4fr 1fr',
        gap: 40,
        alignItems: 'center',
      }}
    >
      <div>
        <MonoLabel>Companion · iOS · Android</MonoLabel>
        <h2
          style={{
            marginTop: 14,
            fontSize: 'clamp(34px, 4vw, 52px)',
            fontWeight: 500,
            letterSpacing: '-0.03em',
            lineHeight: 1.0,
          }}
        >
          Take the routes{' '}
          <span className="mv-serif" style={{ color: 'var(--mv-warm-400)' }}>
            off-grid.
          </span>
        </h2>
        <p
          style={{
            marginTop: 14,
            color: 'var(--mv-ink-2)',
            fontSize: 15,
            lineHeight: 1.55,
            maxWidth: 480,
          }}
        >
          Download routes, log rides, and share your tracks. Works without signal — every turn
          pre-rendered before you leave.
        </p>
        <div style={{ marginTop: 22, display: 'flex', gap: 10 }}>
          <a
            href="https://apps.apple.com/us/app/motovault/id6760291360"
            className="mv-btn mv-btn-primary"
          >
            <span>App Store</span>
          </a>
          <a
            href="https://play.google.com/store/apps/details?id=com.motovault.app"
            className="mv-btn mv-btn-ghost"
          >
            Google Play
          </a>
        </div>
      </div>
      <div style={{ position: 'relative', height: 240 }}>
        <div
          style={{
            position: 'absolute',
            right: 20,
            top: 0,
            width: 180,
            height: 240,
            borderRadius: 22,
            border: '1px solid var(--mv-line)',
            background: 'linear-gradient(135deg, oklch(0.20 0.03 60), oklch(0.11 0.01 50))',
            transform: 'rotate(6deg)',
            boxShadow: '0 30px 60px -10px oklch(0 0 0 / 0.5)',
            padding: 14,
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-geist-mono, monospace)',
              fontSize: 9,
              color: 'var(--mv-ink-3)',
              letterSpacing: '0.12em',
            }}
          >
            OFFLINE · CACHED
          </div>
          <div style={{ marginTop: 6, fontSize: 13, fontWeight: 500 }}>Tail of the Dragon</div>
          <div
            style={{
              marginTop: 14,
              height: 110,
              borderRadius: 10,
              background: 'oklch(0.13 0.02 200)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <svg
              viewBox="0 0 160 110"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
              aria-hidden="true"
            >
              <path
                d="M10 90 Q 30 40, 60 60 T 110 30 Q 130 25, 150 50"
                stroke="oklch(0.84 0.15 68)"
                strokeWidth="2.5"
                fill="none"
              />
              <circle cx="10" cy="90" r="3" fill="oklch(0.84 0.15 68)" />
              <circle cx="150" cy="50" r="3" fill="oklch(0.84 0.15 68)" />
            </svg>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
            <span
              style={{
                fontFamily: 'var(--font-geist-mono, monospace)',
                fontSize: 9.5,
                color: 'var(--mv-ink-2)',
              }}
            >
              18 KM
            </span>
            <span
              style={{
                fontFamily: 'var(--font-geist-mono, monospace)',
                fontSize: 9.5,
                color: 'var(--mv-ink-2)',
              }}
            >
              ↑ 320 M
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
