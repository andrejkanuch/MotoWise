import type { TripTemplateNode } from '@/lib/fetch-places';
import { distanceParts, Icon } from './primitives';
import { formatDuration, tripHref } from './utils';

interface PopularStripProps {
  trips: TripTemplateNode[];
  countryName: string;
}

function tripShortTitle(trip: TripTemplateNode): string {
  return (trip.title ?? 'Unnamed route').split('—')[0].trim();
}

/**
 * A row of hairline chips: the routes we hold for the visitor's country,
 * each with its distance and riding time as figures.
 */
export function PopularStrip({ trips, countryName }: PopularStripProps) {
  if (trips.length === 0) return null;
  const display = trips.slice(0, 4);
  const inCountry = countryName !== 'the world';

  return (
    <section className="xp-wrap xp-section-tight">
      <h2 className="xp-h2">{inCountry ? `Start in ${countryName}` : 'Start here'}</h2>
      <p className="xp-sub">
        {inCountry
          ? `Routes in ${countryName}, where you seem to be riding from.`
          : 'A few routes from across the atlas.'}
      </p>
      <div className="xp-chip-row" style={{ marginTop: 24 }}>
        {display.map((t) => {
          const distance = t.distanceM != null ? distanceParts(t.distanceM) : null;
          const time = formatDuration(t.estimatedDurationMinutes);
          return (
            <a key={t.id} href={tripHref(t)} className="xp-chip">
              <span>{tripShortTitle(t)}</span>
              {distance && (
                <span className="mv-figure xp-figure-value">
                  {distance.value}
                  <span className="xp-figure-unit">{distance.unit}</span>
                </span>
              )}
              {time && <span className="xp-chip-muted">{time}</span>}
              <Icon name="arrow-right" size={14} color="var(--mv-ink-3)" />
            </a>
          );
        })}
      </div>
    </section>
  );
}
