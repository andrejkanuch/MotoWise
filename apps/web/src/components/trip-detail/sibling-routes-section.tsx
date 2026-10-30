import type { TripTemplateNode } from '@/lib/fetch-places';
import { relativeTrip } from '@/lib/seo/canonical';
import { humanRegionName } from './display-names';

/**
 * "More routes in {scope}" internal-link cluster shown on a trip detail page.
 * Server-rendered; links are lowercased via relativeTrip so they match the
 * canonical trip URLs. A hairline list on the shared .mv-rows grammar, one
 * route per row; trip-detail.css (.sib) only places the block.
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
      <h2 className="mv-h2" id="sibling-routes-title">
        More routes in {scopeLabel}
      </h2>
      <ul className="mv-rows">
        {routes.map((r) => {
          const href = relativeTrip(r.countryCode ?? '', r.regionCode ?? '', r.slug ?? '');
          const km = r.distanceM ? Math.round(r.distanceM / 1000) : null;
          const meta = [
            humanRegionName(r.countryCode ?? fallbackCountryCode, r.regionCode),
            km ? `${km.toLocaleString('en-US')} km` : null,
          ]
            .filter(Boolean)
            .join(' · ');
          return (
            <li key={r.id}>
              <a className="mv-row" href={href}>
                <span className="mv-row-title">{r.title}</span>
                {meta && <span className="mv-row-aside">{meta}</span>}
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
