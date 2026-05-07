import type { TripTemplateNode } from '@/lib/fetch-places';
import { Flag, MonoLabel } from './primitives';
import { tripHref } from './utils';

interface PopularStripProps {
  trips: TripTemplateNode[];
  countryName: string;
}

export function PopularStrip({ trips, countryName }: PopularStripProps) {
  if (trips.length === 0) return null;
  const display = trips.slice(0, 4);

  return (
    <section style={{ padding: '90px 40px 0', maxWidth: 1320, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 18,
          marginBottom: 32,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: 'var(--mv-warm-500)',
          }}
        />
        <MonoLabel>Detected · {countryName}</MonoLabel>
        <span style={{ flex: 1, height: 1, background: 'var(--mv-line)' }} />
        <h2
          style={{
            fontSize: 28,
            fontWeight: 500,
            margin: 0,
            letterSpacing: '-0.02em',
          }}
        >
          Popular{' '}
          <span className="mv-serif" style={{ color: 'var(--mv-warm-400)' }}>
            in your country
          </span>
        </h2>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {display.map((t, i) => {
          const hue = Math.abs(((t.startLat ?? 40) * 11) % 360);
          return (
            <a
              key={t.id}
              href={tripHref(t)}
              style={{
                position: 'relative',
                aspectRatio: '4 / 5',
                borderRadius: 16,
                overflow: 'hidden',
                background: 'var(--mv-surface)',
                textDecoration: 'none',
                color: 'inherit',
                display: 'block',
                border: '1px solid var(--mv-line)',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: `linear-gradient(135deg, oklch(0.28 0.05 ${hue}), oklch(0.13 0.02 30))`,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'linear-gradient(180deg, transparent 30%, oklch(0.08 0.008 55 / 0.95) 100%)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: 16,
                  left: 16,
                  right: 16,
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <Flag code={t.countryCode ?? 'XX'} w={26} h={18} />
                <span
                  style={{
                    fontFamily: 'var(--font-geist-mono, monospace)',
                    fontSize: 10,
                    color: 'var(--mv-ink-3)',
                    letterSpacing: '0.15em',
                  }}
                >
                  No{String(i + 1).padStart(2, '0')}
                </span>
              </div>
              <div style={{ position: 'absolute', left: 18, right: 18, bottom: 18 }}>
                <div
                  style={{
                    fontFamily: 'var(--font-geist-mono, monospace)',
                    fontSize: 9.5,
                    color: 'var(--mv-ink-3)',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                  }}
                >
                  {t.city ?? t.regionCode ?? ''}
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 19,
                    fontWeight: 500,
                    letterSpacing: '-0.015em',
                    lineHeight: 1.1,
                  }}
                >
                  {(t.title ?? 'Unnamed Route').split('—')[0].trim()}
                </div>
                <div
                  style={{
                    marginTop: 10,
                    paddingTop: 10,
                    borderTop: '1px solid var(--mv-line)',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-geist-mono, monospace)',
                      fontSize: 10,
                      color: 'var(--mv-ink-2)',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {t.distanceM != null ? `${Math.round(t.distanceM / 1000)}km` : ''}
                    {t.estimatedDurationMinutes != null
                      ? ` · ${t.estimatedDurationMinutes < 60 ? `${t.estimatedDurationMinutes}m` : `${Math.floor(t.estimatedDurationMinutes / 60)}h`}`
                      : ''}
                  </span>
                  {t.averageRating != null && (
                    <span
                      style={{
                        fontFamily: 'var(--font-geist-mono, monospace)',
                        fontSize: 10,
                        color: 'var(--mv-warm-400)',
                        letterSpacing: '0.08em',
                      }}
                    >
                      ★ {t.averageRating.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}
