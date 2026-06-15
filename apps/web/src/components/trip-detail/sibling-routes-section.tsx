import type { TripTemplateNode } from '@/lib/fetch-places';
import { regionDisplayName } from '@/lib/geo-names';
import { relativeTrip } from '@/lib/seo/canonical';

/**
 * "More routes in {scope}" internal-link cluster shown on a trip detail page.
 * Server-rendered; links are lowercased via relativeTrip so they match the
 * canonical trip URLs.
 */
export function SiblingRoutesSection({
  routes,
  scopeLabel,
  fallbackCountryCode,
}: {
  routes: TripTemplateNode[];
  scopeLabel: string;
  fallbackCountryCode: string;
}) {
  if (routes.length === 0) return null;

  return (
    <section style={{ maxWidth: 1080, margin: '0 auto', padding: '8px 24px 48px' }}>
      <h2
        style={{
          fontSize: 'clamp(22px, 2.5vw, 30px)',
          fontWeight: 500,
          letterSpacing: '-0.02em',
          marginBottom: 20,
        }}
      >
        More routes in{' '}
        <span className="serif" style={{ color: 'var(--mv-warm-400)' }}>
          {scopeLabel}
        </span>
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 12,
        }}
      >
        {routes.map((r) => {
          const href = relativeTrip(r.countryCode ?? '', r.regionCode ?? '', r.slug ?? '');
          const km = r.distanceM ? Math.round(r.distanceM / 1000) : null;
          const meta = [
            r.regionCode
              ? regionDisplayName(r.countryCode ?? fallbackCountryCode, r.regionCode)
              : null,
            km ? `${km} km` : null,
          ]
            .filter(Boolean)
            .join(' · ');
          return (
            <a
              key={r.id}
              href={href}
              style={{
                display: 'block',
                padding: 18,
                borderRadius: 14,
                border: '1px solid var(--mv-line)',
                background: 'var(--mv-bg)',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <span style={{ display: 'block', fontWeight: 600, fontSize: 15, lineHeight: 1.3 }}>
                {r.title}
              </span>
              {meta && (
                <span
                  style={{ display: 'block', marginTop: 6, fontSize: 13, color: 'var(--mv-ink-3)' }}
                >
                  {meta}
                </span>
              )}
            </a>
          );
        })}
      </div>
    </section>
  );
}
