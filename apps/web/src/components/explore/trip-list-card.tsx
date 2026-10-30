import type { TripTemplateNode } from '@/lib/fetch-places';
import { RouteFigures } from './primitives';
import { difficultyLabel, surfaceLabel, tripHref } from './utils';

/**
 * One route as a hairline row on the page surface: title, where it is and
 * what it is, then its figures in the condensed face. Server-safe; the
 * hover callbacks are only wired by client parents (the map-linked list).
 */
export function TripListCard({
  trip,
  hovered,
  focused,
  onMouseEnter,
  onMouseLeave,
}: {
  trip: TripTemplateNode;
  hovered?: boolean;
  focused?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const place = [trip.city ?? trip.regionCode, trip.countryCode].filter(Boolean).join(', ');
  const meta = [
    place,
    surfaceLabel(trip.surfaceType),
    difficultyLabel(trip.difficulty),
    trip.isMotovaultPick ? "Editor's pick" : '',
    trip.averageRating != null && trip.reviewCount > 0
      ? `Rated ${trip.averageRating.toFixed(1)} by ${trip.reviewCount} rider${trip.reviewCount === 1 ? '' : 's'}`
      : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <a
      href={tripHref(trip)}
      data-trip-id={trip.id}
      data-hovered={hovered ? 'true' : undefined}
      data-focused={focused ? 'true' : undefined}
      className="mv-row xp-row"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <span className="xp-row-body">
        <span className="mv-row-title" style={{ display: 'block' }}>
          {trip.title ?? 'Unnamed route'}
        </span>
        {meta && <span className="mv-row-sub">{meta}</span>}
      </span>
      <span className="xp-row-figs">
        <RouteFigures trip={trip} />
      </span>
    </a>
  );
}
