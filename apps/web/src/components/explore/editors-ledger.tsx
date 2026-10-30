import type { TripTemplateNode } from '@/lib/fetch-places';
import { COUNTRY_NAMES } from '@/lib/geo-names';
import { MetaLabel, RouteFigures } from './primitives';
import { TripListCard } from './trip-list-card';
import { difficultyLabel, surfaceLabel, tripHref } from './utils';

interface EditorsLedgerProps {
  picks: TripTemplateNode[];
}

function placeLine(trip: TripTemplateNode): string {
  const country = trip.countryCode ? (COUNTRY_NAMES[trip.countryCode] ?? trip.countryCode) : '';
  return [trip.city ?? trip.regionCode, country].filter(Boolean).join(', ');
}

/**
 * Editor's picks: the first pick is the section's one larger tile, the rest
 * are hairline rows with their figures.
 */
export function EditorsLedger({ picks }: EditorsLedgerProps) {
  if (picks.length === 0) return null;

  const [lead, ...rest] = picks;
  const leadMeta = [
    placeLine(lead),
    surfaceLabel(lead.surfaceType),
    difficultyLabel(lead.difficulty),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <section className="xp-wrap xp-section">
      <h2 className="mv-h2">Editor&apos;s picks</h2>
      <p className="xp-sub">
        {picks.length === 1
          ? 'One route picked by hand.'
          : `${picks.length} routes picked by hand.`}
      </p>

      <div className="xp-picks">
        <a href={tripHref(lead)} className="xp-tile">
          <div>
            <MetaLabel>{leadMeta}</MetaLabel>
            <h3 className="mv-h3 xp-h3 xp-tile-title">{lead.title ?? 'Unnamed route'}</h3>
            {lead.description && (
              <p className="xp-tile-desc">
                {lead.description.length > 180
                  ? `${lead.description.slice(0, 180).trimEnd()}…`
                  : lead.description}
              </p>
            )}
          </div>
          <RouteFigures trip={lead} size="lg" />
        </a>

        {rest.length > 0 && (
          <div className="mv-rows">
            {rest.map((trip) => (
              <TripListCard key={trip.id} trip={trip} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
