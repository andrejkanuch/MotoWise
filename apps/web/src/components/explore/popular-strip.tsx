import type { TripTemplateNode } from '@/lib/fetch-places';
import { distanceParts } from './primitives';
import { formatDuration, tripHref } from './utils';

/** The fields a chip prints; the explore page ships only these to the client. */
export type PopularTrip = Pick<
  TripTemplateNode,
  'id' | 'title' | 'slug' | 'countryCode' | 'regionCode' | 'distanceM' | 'estimatedDurationMinutes'
>;

export function toPopularTrip(t: TripTemplateNode): PopularTrip {
  return {
    id: t.id,
    title: t.title,
    slug: t.slug,
    countryCode: t.countryCode,
    regionCode: t.regionCode,
    distanceM: t.distanceM,
    estimatedDurationMinutes: t.estimatedDurationMinutes,
  };
}

interface PopularStripProps {
  trips: PopularTrip[];
  /** A country name, or {@link WORLD} when no country was detected. */
  countryName: string;
}

/** The sentinel passed when no country was detected for the visitor. */
export const WORLD = 'the world';

function tripShortTitle(trip: PopularTrip): string {
  return (trip.title ?? 'Unnamed route').split('—')[0].trim();
}

/**
 * A row of hairline chips: the routes we hold for the visitor's country,
 * each with its distance and riding time as figures.
 */
export function PopularStrip({ trips, countryName }: PopularStripProps) {
  if (trips.length === 0) return null;
  const display = trips.slice(0, 4);
  const inCountry = countryName !== WORLD;

  return (
    <section className="xp-wrap xp-section-tight">
      <h2 className="mv-h2">{inCountry ? `Start in ${countryName}` : 'Start here'}</h2>
      <div className="mv-chips xp-chips-strip">
        {display.map((t) => {
          const distance = t.distanceM != null ? distanceParts(t.distanceM) : null;
          const time = formatDuration(t.estimatedDurationMinutes);
          return (
            <a key={t.id} href={tripHref(t)} className="mv-chip is-tall">
              <span>{tripShortTitle(t)}</span>
              {distance && (
                <span className="mv-figure xp-figure-value">
                  {distance.value}
                  <span className="xp-figure-unit">{distance.unit}</span>
                </span>
              )}
              {time && <span className="xp-chip-muted">{time}</span>}
            </a>
          );
        })}
      </div>
    </section>
  );
}
