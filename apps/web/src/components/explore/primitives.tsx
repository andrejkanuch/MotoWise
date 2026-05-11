import type { ReactNode } from 'react';

/* ── MonoLabel ──────────────────────────────────────────────────── */

export function MonoLabel({ children, size = 10.5 }: { children: ReactNode; size?: number }) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-geist-mono, monospace)',
        fontSize: size,
        color: 'var(--mv-ink-3)',
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </span>
  );
}

/* ── Icon ───────────────────────────────────────────────────────── */

export function Icon({
  name,
  size = 14,
  color = 'currentColor',
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  };
  switch (name) {
    case 'search':
      return (
        <svg {...common}>
          <title>Search</title>
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
      );
    case 'arrow-right':
      return (
        <svg {...common}>
          <title>Arrow</title>
          <path d="M5 12h14M13 5l7 7-7 7" />
        </svg>
      );
    case 'chevron-down':
      return (
        <svg {...common}>
          <title>Expand</title>
          <path d="M6 9l6 6 6-6" />
        </svg>
      );
    case 'sliders':
      return (
        <svg {...common}>
          <title>Filters</title>
          <path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h14M18 18h2" />
          <circle cx="16" cy="6" r="2" />
          <circle cx="8" cy="12" r="2" />
          <circle cx="16" cy="18" r="2" />
        </svg>
      );
    case 'close':
      return (
        <svg {...common}>
          <title>Close</title>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      );
    case 'map':
      return (
        <svg {...common}>
          <title>Map</title>
          <path d="M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v16M15 6v16" />
        </svg>
      );
    case 'list':
      return (
        <svg {...common}>
          <title>List</title>
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      );
    case 'pin':
      return (
        <svg {...common}>
          <title>Pin</title>
          <path d="M12 21s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z" />
          <circle cx="12" cy="9" r="2.5" />
        </svg>
      );
    case 'distance':
      return (
        <svg {...common}>
          <title>Distance</title>
          <path d="M4 12h16M4 12l4-4M4 12l4 4M20 12l-4-4M20 12l-4 4" />
        </svg>
      );
    case 'elev':
      return (
        <svg {...common}>
          <title>Elevation</title>
          <path d="M3 18l6-9 4 6 3-4 5 7H3z" />
        </svg>
      );
    case 'time':
      return (
        <svg {...common}>
          <title>Time</title>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case 'bookmark':
      return (
        <svg {...common}>
          <title>Bookmark</title>
          <path d="M6 4h12v17l-6-4-6 4V4z" />
        </svg>
      );
    case 'check':
      return (
        <svg {...common}>
          <title>Check</title>
          <path d="M5 12l4 4 10-10" />
        </svg>
      );
    case 'globe':
      return (
        <svg {...common}>
          <title>Globe</title>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <title>Icon</title>
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
  }
}

/* ── Flag ───────────────────────────────────────────────────────── */

export function Flag({ code, w = 22, h = 15 }: { code: string; w?: number; h?: number }) {
  const hash = (code || 'XX').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const hue = (hash * 47) % 360;
  return (
    <span
      style={{
        display: 'inline-block',
        width: w,
        height: h,
        borderRadius: 3,
        background: `linear-gradient(135deg, oklch(0.55 0.13 ${hue}), oklch(0.34 0.08 ${(hue + 30) % 360}))`,
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
        boxShadow: 'inset 0 0 0 1px oklch(1 0 0 / 0.08)',
      }}
    >
      <span
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          fontFamily: 'var(--font-geist-mono, monospace)',
          fontSize: Math.round(h * 0.55),
          fontWeight: 600,
          color: 'oklch(0.98 0.01 80 / 0.95)',
          letterSpacing: 0,
        }}
      >
        {code}
      </span>
    </span>
  );
}

/* ── Difficulty ─────────────────────────────────────────────────── */

const DIFFICULTY_MAP = {
  Easy: { dots: 1, color: 'oklch(0.78 0.16 145)' },
  Moderate: { dots: 2, color: 'oklch(0.84 0.15 80)' },
  Hard: { dots: 3, color: 'oklch(0.72 0.18 35)' },
  Expert: { dots: 4, color: 'oklch(0.66 0.20 18)' },
} as const;

export function Difficulty({
  kind = 'Moderate',
}: {
  kind?: 'Easy' | 'Moderate' | 'Hard' | 'Expert';
}) {
  const m = DIFFICULTY_MAP[kind] ?? DIFFICULTY_MAP.Moderate;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ display: 'inline-flex', gap: 2 }}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            style={{
              width: 5,
              height: 5,
              borderRadius: 99,
              background: i < m.dots ? m.color : 'oklch(1 0 0 / 0.12)',
            }}
          />
        ))}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-geist-mono, monospace)',
          fontSize: 10,
          color: 'var(--mv-ink-2)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        {kind}
      </span>
    </span>
  );
}

/* ── Stars ──────────────────────────────────────────────────────── */

export function Stars({ value, size = 12 }: { value: number; size?: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 1, color: 'var(--mv-warm-400)' }}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = i < Math.floor(value) ? 1 : i < value ? value - i : 0;
        const gradientId = `star-${i}-${size}-${Math.round(value * 10)}`;
        return (
          <svg
            key={i}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            style={{ display: 'block' }}
            aria-hidden="true"
          >
            <defs>
              <linearGradient id={gradientId}>
                <stop offset={`${fill * 100}%`} stopColor="currentColor" />
                <stop offset={`${fill * 100}%`} stopColor="oklch(1 0 0 / 0.12)" />
              </linearGradient>
            </defs>
            <path
              d="M12 2l2.9 6.7 7.1.7-5.4 4.8 1.7 7.1L12 17.6 5.7 21.3l1.7-7.1L2 9.4l7.1-.7L12 2z"
              fill={`url(#${gradientId})`}
            />
          </svg>
        );
      })}
    </span>
  );
}

/* ── SkeletonCard ──────────────────────────────────────────────── */

export function SkeletonCard() {
  return (
    <div
      style={{
        background: 'var(--mv-surface)',
        border: '1px solid var(--mv-line)',
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          aspectRatio: '16/9',
          background: 'oklch(1 0 0 / 0.04)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(90deg, transparent, oklch(1 0 0 / 0.04), transparent)',
            animation: 'shimmer 1.6s ease-in-out infinite',
          }}
        />
      </div>
      <div style={{ padding: 16 }}>
        <div
          style={{ height: 10, background: 'oklch(1 0 0 / 0.04)', borderRadius: 99, width: '40%' }}
        />
        <div
          style={{
            height: 14,
            background: 'oklch(1 0 0 / 0.06)',
            borderRadius: 99,
            width: '85%',
            marginTop: 10,
          }}
        />
        <div
          style={{
            height: 14,
            background: 'oklch(1 0 0 / 0.06)',
            borderRadius: 99,
            width: '60%',
            marginTop: 6,
          }}
        />
        <div
          style={{
            height: 10,
            background: 'oklch(1 0 0 / 0.04)',
            borderRadius: 99,
            width: '70%',
            marginTop: 18,
          }}
        />
      </div>
    </div>
  );
}
