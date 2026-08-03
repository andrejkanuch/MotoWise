import type { TripTemplateNode } from '@/lib/fetch-places';
import { Flag, MonoLabel } from './primitives';
import { formatDistance, formatDuration, formatNumber, tripHref } from './utils';

interface EditorsLedgerProps {
  picks: TripTemplateNode[];
}

export function EditorsLedger({ picks }: EditorsLedgerProps) {
  if (picks.length === 0) return null;

  const hero = picks[0];
  const side = picks.slice(1, 4);
  const bottom = picks.slice(4, 6);

  return (
    <section style={{ padding: '110px 40px 0', maxWidth: 1320, margin: '0 auto' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 2fr',
          gap: 56,
          marginBottom: 36,
        }}
      >
        <div>
          <MonoLabel>Editor&apos;s picks · {picks.length} rides</MonoLabel>
          <h2
            style={{
              fontSize: 'clamp(40px, 5vw, 64px)',
              fontWeight: 500,
              letterSpacing: '-0.04em',
              lineHeight: 0.98,
              margin: '14px 0 0',
            }}
          >
            Worth crossing
            <br />
            <span className="mv-serif" style={{ color: 'var(--mv-warm-400)' }}>
              a continent
            </span>{' '}
            for.
          </h2>
        </div>
        <p
          style={{
            alignSelf: 'end',
            color: 'var(--mv-ink-2)',
            fontSize: 16,
            lineHeight: 1.6,
            maxWidth: 520,
            margin: 0,
          }}
        >
          Our editors pick the rides that have stayed in our riders&apos; minds long after the
          engine cooled — the ones we keep coming back to.
        </p>
      </div>

      {/* Hero pick + side grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14 }}>
        {/* Hero */}
        <a
          href={tripHref(hero)}
          style={{
            position: 'relative',
            minHeight: 600,
            borderRadius: 22,
            overflow: 'hidden',
            textDecoration: 'none',
            color: 'inherit',
            display: 'block',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(135deg, oklch(0.32 0.06 30), oklch(0.14 0.02 30)), repeating-linear-gradient(45deg, oklch(1 0 0 / 0.025) 0 2px, transparent 2px 9px)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(180deg, oklch(0.08 0.008 55 / 0.4) 0%, transparent 30%, oklch(0.08 0.008 55 / 0.96) 100%)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 26,
              left: 26,
              right: 26,
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 12px 5px 5px',
                background: 'oklch(0.1 0.008 55 / 0.6)',
                backdropFilter: 'blur(10px)',
                border: '1px solid var(--mv-line)',
                borderRadius: 999,
              }}
            >
              <Flag code={hero.countryCode ?? 'XX'} w={18} h={14} />
              <span
                style={{
                  fontFamily: 'var(--font-geist-mono, monospace)',
                  fontSize: 10,
                  color: 'var(--mv-ink-2)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                {hero.countryCode ?? ''} · {hero.city ?? hero.regionCode ?? ''}
              </span>
            </span>
            <span
              style={{
                padding: '5px 11px',
                background: 'var(--mv-warm-500)',
                color: '#1a1410',
                borderRadius: 999,
                fontFamily: 'var(--font-geist-mono, monospace)',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
              }}
            >
              Editor&apos;s No 01
            </span>
          </div>
          <div style={{ position: 'absolute', left: 32, right: 32, bottom: 30 }}>
            <h3
              style={{
                fontSize: 'clamp(40px, 4vw, 56px)',
                fontWeight: 500,
                letterSpacing: '-0.03em',
                lineHeight: 0.95,
                margin: 0,
              }}
            >
              {(hero.title ?? 'Unnamed').split('—')[0].trim()}
              <br />
              <span className="mv-serif" style={{ color: 'var(--mv-warm-400)' }}>
                Pass.
              </span>
            </h3>
            {hero.description && (
              <p
                style={{
                  marginTop: 18,
                  color: 'var(--mv-ink-2)',
                  fontSize: 14.5,
                  lineHeight: 1.55,
                  maxWidth: 460,
                }}
              >
                {hero.description.slice(0, 160)}
              </p>
            )}
            <div style={{ marginTop: 20, display: 'flex', gap: 18 }}>
              {hero.distanceM != null && (
                <div>
                  <MonoLabel size={9}>Distance</MonoLabel>
                  <div style={{ fontSize: 13.5, fontWeight: 500, marginTop: 4 }}>
                    {formatDistance(hero.distanceM)}
                  </div>
                </div>
              )}
              {hero.elevationGainM != null && (
                <div>
                  <MonoLabel size={9}>Elevation</MonoLabel>
                  <div style={{ fontSize: 13.5, fontWeight: 500, marginTop: 4 }}>
                    {formatNumber(hero.elevationGainM)} m
                  </div>
                </div>
              )}
              <div>
                <MonoLabel size={9}>Surface</MonoLabel>
                <div style={{ fontSize: 13.5, fontWeight: 500, marginTop: 4 }}>
                  {hero.surfaceType === 'paved'
                    ? 'Paved'
                    : hero.surfaceType === 'mixed'
                      ? 'Mixed'
                      : hero.surfaceType === 'off-road'
                        ? 'Off-Road'
                        : 'Paved'}
                </div>
              </div>
              {hero.estimatedDurationMinutes != null && (
                <div>
                  <MonoLabel size={9}>Time</MonoLabel>
                  <div style={{ fontSize: 13.5, fontWeight: 500, marginTop: 4 }}>
                    {formatDuration(hero.estimatedDurationMinutes)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </a>

        {/* Side cards */}
        <div style={{ display: 'grid', gridTemplateRows: `repeat(${side.length}, 1fr)`, gap: 14 }}>
          {side.map((f, i) => (
            <a
              key={f.id}
              href={tripHref(f)}
              style={{
                position: 'relative',
                borderRadius: 18,
                overflow: 'hidden',
                textDecoration: 'none',
                color: 'inherit',
                display: 'flex',
              }}
            >
              <div style={{ width: 200, position: 'relative', flexShrink: 0 }}>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: `linear-gradient(135deg, oklch(0.30 0.05 ${(i * 80 + 220) % 360}), oklch(0.13 0.02 240))`,
                  }}
                />
              </div>
              <div
                style={{
                  flex: 1,
                  padding: '20px 22px',
                  background: 'var(--mv-surface)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Flag code={f.countryCode ?? 'XX'} w={20} h={14} />
                      <MonoLabel>{f.countryCode ?? ''}</MonoLabel>
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-geist-mono, monospace)',
                        fontSize: 10,
                        color: 'var(--mv-ink-3)',
                        letterSpacing: '0.15em',
                      }}
                    >
                      No 0{i + 2}
                    </span>
                  </div>
                  <div
                    style={{
                      marginTop: 10,
                      fontSize: 22,
                      fontWeight: 500,
                      letterSpacing: '-0.02em',
                      lineHeight: 1.05,
                    }}
                  >
                    {(f.title ?? 'Unnamed').split('—')[0].trim()}
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: 14,
                    paddingTop: 12,
                    borderTop: '1px solid var(--mv-line)',
                  }}
                >
                  {f.distanceM != null && (
                    <span
                      style={{
                        fontFamily: 'var(--font-geist-mono, monospace)',
                        fontSize: 10,
                        color: 'var(--mv-ink-2)',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {formatDistance(f.distanceM)}
                    </span>
                  )}
                  {f.elevationGainM != null && (
                    <span
                      style={{
                        fontFamily: 'var(--font-geist-mono, monospace)',
                        fontSize: 10,
                        color: 'var(--mv-ink-2)',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                      }}
                    >
                      ↑ {formatNumber(f.elevationGainM)} m
                    </span>
                  )}
                  <span
                    style={{
                      fontFamily: 'var(--font-geist-mono, monospace)',
                      fontSize: 10,
                      color: 'var(--mv-ink-2)',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {formatDuration(f.estimatedDurationMinutes)}
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Last picks as a strip */}
      {bottom.length > 0 && (
        <div
          style={{
            marginTop: 14,
            display: 'grid',
            gridTemplateColumns: `repeat(${bottom.length}, 1fr)`,
            gap: 14,
          }}
        >
          {bottom.map((f, i) => (
            <a
              key={f.id}
              href={tripHref(f)}
              style={{
                position: 'relative',
                height: 200,
                borderRadius: 18,
                overflow: 'hidden',
                textDecoration: 'none',
                color: 'inherit',
                display: 'flex',
              }}
            >
              <div style={{ width: 220, position: 'relative', flexShrink: 0 }}>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: `linear-gradient(135deg, oklch(0.30 0.06 ${(i * 60 + 140) % 360}), oklch(0.13 0.02 150))`,
                  }}
                />
              </div>
              <div
                style={{
                  flex: 1,
                  padding: 22,
                  background: 'var(--mv-surface)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Flag code={f.countryCode ?? 'XX'} w={20} h={14} />
                      <MonoLabel>{f.countryCode ?? ''}</MonoLabel>
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-geist-mono, monospace)',
                        fontSize: 10,
                        color: 'var(--mv-ink-3)',
                        letterSpacing: '0.15em',
                      }}
                    >
                      No 0{i + 5}
                    </span>
                  </div>
                  <div
                    style={{
                      marginTop: 12,
                      fontSize: 26,
                      fontWeight: 500,
                      letterSpacing: '-0.02em',
                      lineHeight: 1.05,
                    }}
                  >
                    {(f.title ?? 'Unnamed').split('—')[0].trim()}
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: 14,
                    paddingTop: 12,
                    borderTop: '1px solid var(--mv-line)',
                  }}
                >
                  {f.distanceM != null && (
                    <span
                      style={{
                        fontFamily: 'var(--font-geist-mono, monospace)',
                        fontSize: 10,
                        color: 'var(--mv-ink-2)',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {formatDistance(f.distanceM)}
                    </span>
                  )}
                  {f.elevationGainM != null && (
                    <span
                      style={{
                        fontFamily: 'var(--font-geist-mono, monospace)',
                        fontSize: 10,
                        color: 'var(--mv-ink-2)',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                      }}
                    >
                      ↑ {formatNumber(f.elevationGainM)} m
                    </span>
                  )}
                  <span
                    style={{
                      fontFamily: 'var(--font-geist-mono, monospace)',
                      fontSize: 10,
                      color: 'var(--mv-ink-2)',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {formatDuration(f.estimatedDurationMinutes)}
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
