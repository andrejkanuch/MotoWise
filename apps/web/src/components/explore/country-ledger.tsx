import { CONTINENT_ORDER, COUNTRY_CONTINENT } from '@/lib/continent-map';
import { Flag, Icon, MonoLabel } from './primitives';

interface CountryLedgerProps {
  countries: Array<{ code: string; name: string; routeCount: number }>;
}

export function CountryLedger({ countries }: CountryLedgerProps) {
  const max = Math.max(...countries.map((c) => c.routeCount), 1);

  // Group by continent
  const grouped = CONTINENT_ORDER.map((cont) => ({
    continent: cont,
    list: countries
      .filter((c) => (COUNTRY_CONTINENT[c.code] ?? 'Europe') === cont)
      .sort((a, b) => b.routeCount - a.routeCount),
  })).filter((g) => g.list.length > 0);

  return (
    <section style={{ padding: '120px 40px 0', maxWidth: 1320, margin: '0 auto' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 56,
          marginBottom: 56,
          alignItems: 'end',
        }}
      >
        <div>
          <MonoLabel>Index · {countries.length} countries</MonoLabel>
          <h2
            className="mv-serif"
            style={{
              fontSize: 'clamp(56px, 7vw, 96px)',
              fontWeight: 400,
              letterSpacing: '-0.045em',
              lineHeight: 0.92,
              margin: '20px 0 0',
              color: 'var(--mv-ink)',
            }}
          >
            Where riders
            <br />
            ride.
          </h2>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'end',
            gap: 12,
          }}
        >
          <p
            style={{
              color: 'var(--mv-ink-3)',
              fontSize: 14,
              lineHeight: 1.55,
              maxWidth: 360,
              margin: 0,
            }}
          >
            Every country on MotoVault, sorted by route count and grouped by region. Bars show
            density relative to our top destination.
          </p>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '0 64px',
          borderTop: '1px solid var(--mv-line)',
        }}
      >
        {grouped.map((g) => (
          <div
            key={g.continent}
            style={{
              paddingTop: 32,
              paddingBottom: 32,
              borderBottom: '1px solid var(--mv-line)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <span
                className="mv-serif"
                style={{ fontSize: 28, color: 'var(--mv-ink)', letterSpacing: '-0.02em' }}
              >
                {g.continent}
              </span>
              <MonoLabel size={11}>
                {g.list.length} · {g.list.reduce((s, c) => s + c.routeCount, 0)} routes
              </MonoLabel>
            </div>
            {g.list.map((c, i) => (
              <a
                key={c.code}
                href={`/explore/${c.code.toLowerCase()}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '24px 22px 1fr 1fr 60px 14px',
                  alignItems: 'center',
                  gap: 14,
                  padding: '10px 4px',
                  borderTop: i === 0 ? 'none' : '1px solid var(--mv-line-2)',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-geist-mono, monospace)',
                    fontSize: 10,
                    color: 'var(--mv-ink-4)',
                    letterSpacing: '0.05em',
                  }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <Flag code={c.code} w={22} h={15} />
                <span
                  style={{
                    fontSize: 14.5,
                    fontWeight: 500,
                    letterSpacing: '-0.005em',
                  }}
                >
                  {c.name}
                </span>
                <div
                  style={{
                    height: 6,
                    background: 'oklch(1 0 0 / 0.04)',
                    borderRadius: 99,
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: `${(c.routeCount / max) * 100}%`,
                      background: 'var(--mv-warm-500)',
                      borderRadius: 99,
                    }}
                  />
                </div>
                <span
                  style={{
                    fontFamily: 'var(--font-geist-mono, monospace)',
                    fontSize: 11,
                    color: 'var(--mv-ink-2)',
                    letterSpacing: '0.04em',
                    textAlign: 'right',
                  }}
                >
                  {String(c.routeCount).padStart(2, '0')} routes
                </span>
                <Icon name="arrow-right" size={12} color="var(--mv-ink-3)" />
              </a>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
