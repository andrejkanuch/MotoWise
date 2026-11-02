import type { TripByShareTokenQuery } from '@motovault/graphql';
import Image from 'next/image';
import { OpenInAppActions } from '@/components/open-in-app-link';
import { CtaPageType } from '@/lib/cta-taxonomy';
import '@/components/marketing/design-system.css';
import '@/components/share-page.css';

type SharedTrip = NonNullable<TripByShareTokenQuery['tripByShareToken']>;

/**
 * Read-only SSR view of a shared trip. No map for MVP — we deliberately
 * avoid pulling the Mapbox token into this page so nothing trip-specific
 * ends up in OG previews or bundled into the edge runtime.
 */
export function SharedTripView({ data }: { data: SharedTrip }) {
  const { waypoints, participants } = data;

  const startDate = formatDate(data.startDate);
  const endDate = formatDate(data.endDate);
  const dateRange = startDate === endDate ? startDate : `${startDate} to ${endDate}`;
  const context = [dateRange, capitalize(data.difficulty), capitalize(data.status)].join(' · ');
  const sortedWaypoints = waypoints.slice().sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="mv-marketing sp">
      <div className="sp-brand">
        <a href="/">
          <Image src="/images/marketing/MotoVault.png" alt="" width={28} height={28} />
          MotoVault
        </a>
      </div>

      <main className="sp-main sp-main-tall">
        <h1 className="mv-section-title sp-title">{data.title}</h1>
        <p className="sp-sub">{context}</p>

        <div className="sp-figures">
          <div className="sp-figure">
            <span className="mv-figure sp-figure-value">
              {data.participantCount}
              <small>of {data.maxRiders}</small>
            </span>
            <span className="sp-figure-label">Riders on the trip</span>
          </div>
          <div className="sp-figure">
            <span className="mv-figure sp-figure-value">{waypoints.length}</span>
            <span className="sp-figure-label">
              {waypoints.length === 1 ? 'Waypoint' : 'Waypoints'}
            </span>
          </div>
        </div>

        {data.description && (
          <section className="sp-section">
            <h2 className="sp-section-title">About the trip</h2>
            <p className="sp-prose">{data.description}</p>
          </section>
        )}

        {sortedWaypoints.length > 0 && (
          <section className="sp-section">
            <h2 className="sp-section-title">Waypoints</h2>
            <ol className="mv-rows">
              {sortedWaypoints.map((wp, index) => (
                <li key={wp.id} className="mv-row sp-row">
                  <span className="sp-row-num" aria-hidden="true">
                    {index + 1}
                  </span>
                  <div className="sp-row-body">
                    <div className="sp-row-title">{wp.name}</div>
                    <div className="sp-row-meta">
                      <span>{capitalize(wp.type)}</span>
                      {wp.dayIndex != null && <span>Day {wp.dayIndex + 1}</span>}
                    </div>
                    {wp.notes && <p className="sp-row-note">{wp.notes}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {participants.length > 0 && (
          <section className="sp-section">
            <h2 className="sp-section-title">Riders</h2>
            <ul className="mv-rows">
              {participants.map((p) => (
                <li key={p.anonId} className="mv-row">
                  {p.avatarUrl ? (
                    // biome-ignore lint/performance/noImgElement: tiny avatar thumbnail, edge runtime
                    <img src={p.avatarUrl} alt="" className="sp-row-avatar" />
                  ) : (
                    <span className="sp-row-avatar" aria-hidden="true" />
                  )}
                  <div className="sp-row-body">
                    <div className="sp-row-title">{p.displayName}</div>
                  </div>
                  <span className="sp-row-aside">{capitalize(p.role)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <footer className="sp-cta">
        <div className="sp-cta-inner">
          <h2 className="mv-h2">Ride it with them</h2>
          <p className="sp-cta-sub">
            Open the trip in the app to see the route on the map, join the group and record the
            ride.
          </p>
          <OpenInAppActions
            deepLink={`motovault://trip/${data.id}`}
            pageType={CtaPageType.SharedTrip}
            slug={data.id}
          />
        </div>
      </footer>
    </div>
  );
}

/** "in_progress" → "In progress": enum values never print an underscore. */
function capitalize(s: string): string {
  const words = s.replace(/_/g, ' ');
  return words.length === 0 ? words : words[0].toUpperCase() + words.slice(1);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
