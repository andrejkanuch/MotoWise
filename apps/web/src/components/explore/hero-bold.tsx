import { Suspense } from 'react';
import { ExploreSearchBar } from '@/components/explore-search-bar';
import { Icon, MonoLabel } from './primitives';

interface HeroBoldProps {
  totalRoutes: number;
  totalCountries: number;
  countries: Array<{ code: string; label: string }>;
}

export function HeroBold({ totalRoutes, totalCountries, countries }: HeroBoldProps) {
  return (
    <section
      style={{ position: 'relative', padding: '160px 40px 60px', maxWidth: 1320, margin: '0 auto' }}
    >
      {/* Dispatch slug */}
      <div
        style={{
          position: 'absolute',
          top: 110,
          left: 40,
          right: 40,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <MonoLabel size={11}>No 137 · Atlas of Riders</MonoLabel>
        <MonoLabel size={11}>Edition 2026 · Spring</MonoLabel>
      </div>

      <h1
        style={{
          fontSize: 'clamp(80px, 11vw, 168px)',
          fontWeight: 400,
          lineHeight: 0.86,
          letterSpacing: '-0.05em',
          margin: '36px 0 0',
          color: 'var(--mv-ink)',
        }}
      >
        <span style={{ display: 'block' }}>Where are you</span>
        <span className="mv-serif" style={{ color: 'var(--mv-warm-400)', display: 'block' }}>
          riding
        </span>
        <span style={{ display: 'block' }}>next?</span>
      </h1>

      {/* Two-column lower section */}
      <div
        style={{
          marginTop: 40,
          display: 'grid',
          gridTemplateColumns: '1.4fr 1fr',
          gap: 56,
          alignItems: 'end',
        }}
      >
        {/* Search */}
        <div>
          <Suspense>
            <ExploreSearchBar countries={countries} />
          </Suspense>
          <p
            style={{
              marginTop: 24,
              color: 'var(--mv-ink-2)',
              fontSize: 16.5,
              maxWidth: 520,
              lineHeight: 1.5,
            }}
          >
            <span className="mv-serif" style={{ color: 'var(--mv-warm-400)', fontSize: 22 }}>
              {totalRoutes}
            </span>{' '}
            rider-curated routes across{' '}
            <span className="mv-serif" style={{ color: 'var(--mv-warm-400)', fontSize: 22 }}>
              {totalCountries}
            </span>{' '}
            countries — twisty passes, coastal corners, alpine routes, all rated by people
            who&apos;ve ridden them.
          </p>

          <div
            style={{
              marginTop: 24,
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <MonoLabel>Try</MonoLabel>
            {['Mountain passes', 'Weekend escape', 'Dolomites', 'Big Sur', 'Pyrenees'].map((c) => (
              <span
                key={c}
                style={{
                  padding: '7px 13px 7px 10px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  borderRadius: 999,
                  background: 'oklch(1 0 0 / 0.03)',
                  border: '1px solid var(--mv-line)',
                  color: 'var(--mv-ink-2)',
                  fontSize: 12.5,
                  fontWeight: 500,
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 999,
                    background: 'var(--mv-warm-500)',
                  }}
                />
                {c}
              </span>
            ))}
          </div>
        </div>

        {/* Dispatch panel */}
        <div
          style={{
            padding: '28px 28px',
            background: 'oklch(0.13 0.01 55)',
            border: '1px solid var(--mv-line)',
            borderRadius: 18,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: -80,
              right: -80,
              width: 240,
              height: 240,
              borderRadius: 999,
              border: '1px solid var(--mv-line)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: -40,
              right: -40,
              width: 160,
              height: 160,
              borderRadius: 999,
              border: '1px solid var(--mv-line)',
            }}
          />
          <MonoLabel>This week&apos;s dispatch</MonoLabel>
          <div
            style={{
              marginTop: 18,
              fontSize: 22,
              fontWeight: 500,
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
            }}
          >
            <span className="mv-serif" style={{ color: 'var(--mv-warm-400)' }}>
              4,812
            </span>{' '}
            km logged, 218 rides shared, 12 new routes added by community.
          </div>
          <div
            style={{
              marginTop: 22,
              paddingTop: 22,
              borderTop: '1px solid var(--mv-line)',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <MonoLabel>Trending</MonoLabel>
              <div style={{ marginTop: 6, fontSize: 14, fontWeight: 500 }}>
                Pyrenees · Coll d&apos;Ordino
              </div>
            </div>
            <Icon name="arrow-right" size={16} color="var(--mv-ink-3)" />
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div
        style={{
          marginTop: 56,
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          borderTop: '1px solid var(--mv-line)',
          borderBottom: '1px solid var(--mv-line)',
        }}
      >
        {[
          { v: String(totalRoutes), l: 'Routes mapped', sup: '+12 this month' },
          { v: String(totalCountries), l: 'Countries', sup: '4 continents' },
          { v: '12k', l: 'Riders', sup: 'Contributing' },
          { v: '4.8', l: 'Avg. rating', sup: 'Out of 5.0' },
        ].map((s, i) => (
          <div
            key={s.l}
            style={{
              padding: '28px 24px',
              borderRight: i < 3 ? '1px solid var(--mv-line)' : 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
              }}
            >
              <MonoLabel>
                {String(i + 1).padStart(2, '0')} / {s.l}
              </MonoLabel>
              <span
                style={{
                  fontFamily: 'var(--font-geist-mono, monospace)',
                  fontSize: 9.5,
                  color: 'var(--mv-ink-4)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                {s.sup}
              </span>
            </div>
            <div
              className="mv-serif"
              style={{
                fontSize: 56,
                lineHeight: 1,
                letterSpacing: '-0.04em',
                color: 'var(--mv-ink)',
              }}
            >
              {s.v}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
