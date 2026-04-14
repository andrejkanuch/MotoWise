import type { ResolveTripByTokenResponse } from '@motovault/types';

/**
 * Read-only SSR view of a shared trip. No map for MVP — we deliberately
 * avoid pulling the Mapbox token into this page so nothing trip-specific
 * ends up in OG previews or bundled into the edge runtime.
 */
export function SharedTripView({ data }: { data: ResolveTripByTokenResponse }) {
  const { trip, waypoints, participants } = data;

  const startDate = formatDate(trip.start_date);
  const endDate = formatDate(trip.end_date);
  const dateRange = startDate === endDate ? startDate : `${startDate} — ${endDate}`;

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Hero — brand gradient from design-system primary scale (tokens.css) */}
      <div className="h-20 w-full bg-gradient-to-br from-primary-950 to-primary-500" />

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-neutral-900">{trip.title}</h1>
        <p className="mt-1 text-sm text-neutral-500">{dateRange}</p>

        {/* Quick facts */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Difficulty" value={capitalize(trip.difficulty)} />
          <StatCard label="Status" value={capitalize(trip.status)} />
          <StatCard label="Riders" value={`${trip.participant_count}/${trip.max_riders}`} />
          <StatCard label="Waypoints" value={String(waypoints.length)} />
        </div>

        {trip.description && (
          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              About
            </h2>
            <p className="mt-2 whitespace-pre-wrap text-base text-neutral-800">
              {trip.description}
            </p>
          </section>
        )}

        {waypoints.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Waypoints
            </h2>
            <ol className="mt-3 space-y-2">
              {waypoints
                .slice()
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((wp, index) => (
                  <li
                    key={wp.id}
                    className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-4"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-neutral-900">{wp.name}</p>
                      <p className="text-xs uppercase tracking-wide text-neutral-500">
                        {wp.type}
                        {wp.day_index != null ? ` • Day ${wp.day_index + 1}` : ''}
                      </p>
                      {wp.notes && <p className="mt-1 text-sm text-neutral-700">{wp.notes}</p>}
                    </div>
                  </li>
                ))}
            </ol>
          </section>
        )}

        {participants.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Riders
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {participants.map((p) => (
                <li
                  key={p.anon_id}
                  className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-800"
                >
                  {p.avatar_url ? (
                    // biome-ignore lint/performance/noImgElement: tiny avatar thumbnail, edge runtime
                    <img src={p.avatar_url} alt="" className="h-5 w-5 rounded-full object-cover" />
                  ) : (
                    <span className="h-5 w-5 rounded-full bg-neutral-200" />
                  )}
                  <span className="font-medium">{p.display_name}</span>
                  <span className="text-xs text-neutral-500">{capitalize(p.role)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      {/* CTA */}
      <footer className="border-t border-neutral-200 bg-white py-10">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <p className="text-lg font-bold text-neutral-900">Open this trip in MotoVault</p>
          <p className="mt-1 text-sm text-neutral-500">
            Plan routes, track rides, and ride together
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <a
              href={`motovault://trip/${trip.id}`}
              className="inline-flex items-center rounded-xl bg-neutral-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
            >
              Open in App
            </a>
            <a
              href="https://apps.apple.com/us/app/motovault/id6760291360"
              className="inline-flex items-center rounded-xl border border-neutral-300 bg-white px-6 py-3 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-50"
            >
              App Store
            </a>
            <a
              href="https://play.google.com/store/apps/details?id=com.motovault.app"
              className="inline-flex items-center rounded-xl border border-neutral-300 bg-white px-6 py-3 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-50"
            >
              Google Play
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 text-center">
      <p className="text-xl font-bold text-neutral-900">{value}</p>
      <p className="text-xs text-neutral-500">{label}</p>
    </div>
  );
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
