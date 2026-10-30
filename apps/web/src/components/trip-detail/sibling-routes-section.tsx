import type { TripTemplateNode } from '@/lib/fetch-places';
import { regionDisplayName } from '@/lib/geo-names';
import { relativeTrip } from '@/lib/seo/canonical';

/**
 * "More routes in {scope}" internal-link cluster shown on a trip detail page.
 * Server-rendered; links are lowercased via relativeTrip so they match the
 * canonical trip URLs. Styled by trip-detail.css (.sib-*): a hairline list,
 * one route per row, 56px targets.
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
    <section className="sib" aria-labelledby="sibling-routes-title">
      <h2 className="sib-title" id="sibling-routes-title">
        More routes in {scopeLabel}
      </h2>
      <ul className="sib-list">
        {routes.map((r) => {
          const href = relativeTrip(r.countryCode ?? '', r.regionCode ?? '', r.slug ?? '');
          const km = r.distanceM ? Math.round(r.distanceM / 1000) : null;
          const meta = [
            r.regionCode
              ? regionDisplayName(r.countryCode ?? fallbackCountryCode, r.regionCode)
              : null,
            km ? `${km.toLocaleString('en-US')} km` : null,
          ]
            .filter(Boolean)
            .join(' · ');
          return (
            <li key={r.id}>
              <a className="sib-row" href={href}>
                <span className="sib-row-title">{r.title}</span>
                {meta && <span className="sib-row-meta">{meta}</span>}
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
