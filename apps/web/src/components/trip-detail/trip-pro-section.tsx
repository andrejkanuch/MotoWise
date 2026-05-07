'use client';

import Link from 'next/link';
import { GpxDownloadButton } from '@/components/gpx-download-button';
import { useProStatus } from '@/hooks/use-pro-status';

type Props = {
  routeId: string;
  routeName: string;
  isAuthenticated: boolean;
};

export function TripProSection({ routeId, routeName, isAuthenticated }: Props) {
  const { isPro, isLoading } = useProStatus();

  if (isLoading) return null;

  if (isPro) {
    return (
      <section className="rsec">
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '24px 0',
          }}
        >
          <GpxDownloadButton
            routeId={routeId}
            routeName={routeName}
            isAuthenticated={isAuthenticated}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="rsec">
      <div
        style={{
          background: 'linear-gradient(135deg, oklch(0.14 0.025 55), oklch(0.11 0.015 55))',
          border: '1px solid var(--mv-line)',
          borderRadius: 20,
          padding: '48px 40px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-geist-mono, monospace)',
            fontSize: 10,
            color: 'var(--mv-warm-400)',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            marginBottom: 16,
          }}
        >
          MotoVault Pro
        </div>
        <h3
          style={{
            fontSize: 'clamp(24px, 3vw, 36px)',
            fontWeight: 500,
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
          }}
        >
          Export GPX, build multi-day trips,{' '}
          <span className="serif" style={{ color: 'var(--mv-warm-400)' }}>
            go further.
          </span>
        </h3>
        <p
          style={{
            color: 'var(--mv-ink-3)',
            fontSize: 14,
            lineHeight: 1.55,
            maxWidth: 480,
            margin: '16px auto 0',
          }}
        >
          Download GPX files for offline navigation, create multi-day itineraries, and get priority
          access to new routes.
        </p>
        <div
          style={{
            marginTop: 28,
            display: 'flex',
            justifyContent: 'center',
            gap: 12,
          }}
        >
          <Link href="/pro/checkout" className="mv-btn mv-btn-primary">
            <span>Try Pro free</span>
          </Link>
          <Link href="/pro" className="mv-btn mv-btn-ghost">
            Learn more
          </Link>
        </div>
      </div>
    </section>
  );
}
