import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchRide } from '../../../lib/fetch-ride';
import { formatDate, formatDistance, formatDuration } from '../../../lib/format-utils';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const ride = await fetchRide(id);
  if (!ride) return { title: 'Ride Not Found' };

  const title = ride.name ?? 'MotoVault Ride';
  const description = `${formatDistance(ride.distanceM ?? 0)} ride tracked with MotoVault`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      url: `https://motovault.app/ride/${ride.id}`,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function RidePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ride = await fetchRide(id);

  if (!ride) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Route thumbnail hero */}
      {ride.routeThumbnailUri ? (
        <div className="relative h-64 w-full bg-neutral-200 sm:h-80">
          {/* biome-ignore lint/performance/noImgElement: route thumbnail from Supabase storage */}
          <img
            src={ride.routeThumbnailUri}
            alt="Route map"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-50 to-transparent" />
        </div>
      ) : (
        <div className="h-20 w-full bg-gradient-to-br from-[#0a1540] to-[#3366e6]" />
      )}

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        {/* Title */}
        <h1 className="text-2xl font-bold text-neutral-900">{ride.name ?? 'MotoVault Ride'}</h1>
        <p className="mt-1 text-sm text-neutral-500">{formatDate(ride.startedAt)}</p>

        {/* Stats grid */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Distance" value={formatDistance(ride.distanceM ?? 0)} />
          {ride.durationS != null && ride.durationS > 0 && (
            <StatCard label="Duration" value={formatDuration(ride.durationS)} />
          )}
          {(ride.elevationGain ?? 0) > 0 && (
            <StatCard label="Elevation Gain" value={`${Math.round(ride.elevationGain ?? 0)}m`} />
          )}
          {(ride.elevationLoss ?? 0) > 0 && (
            <StatCard label="Elevation Loss" value={`${Math.round(ride.elevationLoss ?? 0)}m`} />
          )}
        </div>
      </main>

      {/* CTA */}
      <footer className="border-t border-neutral-200 bg-white py-10">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <p className="text-lg font-bold text-neutral-900">View full ride in MotoVault</p>
          <p className="mt-1 text-sm text-neutral-500">
            Track your rides, maintain your bike, diagnose issues
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <a
              href={`motovault://ride/${ride.id}`}
              className="inline-flex items-center rounded-xl bg-neutral-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
            >
              Open in App
            </a>
            <a
              href="https://apps.apple.com/us/app/motovault/id6760291360"
              className="inline-flex items-center rounded-xl border border-neutral-300 bg-white px-6 py-3 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-50"
            >
              Get MotoVault
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
