import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchProfile } from '../../../lib/fetch-profile';
import { formatDistance, formatDuration } from '../../../lib/format-utils';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const profile = await fetchProfile(username);
  if (!profile) return { title: 'Rider Not Found' };

  const description = profile.bio
    ? profile.bio.slice(0, 155)
    : `${profile.displayName} rides with MotoVault. ${profile.stats.totalRides} rides logged.`;

  return {
    title: `${profile.displayName} (@${profile.username})`,
    description,
    openGraph: {
      title: `${profile.displayName} (@${profile.username})`,
      description,
      type: 'profile',
      url: `https://motovault.app/rider/${profile.username}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${profile.displayName} (@${profile.username})`,
      description,
    },
  };
}

function formatJoinDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
  });
}

export default async function RiderProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = await fetchProfile(username);

  if (!profile) {
    notFound();
  }

  const initial = profile.displayName?.charAt(0)?.toUpperCase() ?? '?';

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Hero header */}
      <header className="bg-gradient-to-br from-[#0a1540] to-[#3366e6] text-white">
        <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
          <div className="flex items-center gap-5">
            {profile.avatarUrl ? (
              // biome-ignore lint/performance/noImgElement: user avatar from Supabase storage
              <img
                src={profile.avatarUrl}
                alt={profile.displayName}
                className="h-20 w-20 rounded-full border-3 border-white/20 object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/15 text-3xl font-bold">
                {initial}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold">{profile.displayName}</h1>
              <p className="text-white/70">@{profile.username}</p>
              {profile.city && <p className="mt-1 text-sm text-white/60">{profile.city}</p>}
            </div>
          </div>
          {profile.bio && (
            <p className="mt-4 text-sm leading-relaxed text-white/80">{profile.bio}</p>
          )}

          {/* Stats */}
          <div className="mt-8 grid grid-cols-3 gap-4">
            <div className="rounded-xl bg-white/10 p-3 text-center">
              <p className="text-2xl font-bold">{profile.stats.totalRides}</p>
              <p className="text-xs text-white/60">Rides</p>
            </div>
            <div className="rounded-xl bg-white/10 p-3 text-center">
              <p className="text-2xl font-bold">{formatDistance(profile.stats.totalDistanceM)}</p>
              <p className="text-xs text-white/60">Distance</p>
            </div>
            <div className="rounded-xl bg-white/10 p-3 text-center">
              <p className="text-2xl font-bold">{formatDuration(profile.stats.totalDurationS)}</p>
              <p className="text-xs text-white/60">Ride Time</p>
            </div>
          </div>
        </div>
      </header>

      {/* Bikes */}
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        {profile.bikes.length > 0 && (
          <section>
            <h2 className="mb-4 text-lg font-bold text-neutral-900">Garage</h2>
            <div className="space-y-3">
              {profile.bikes.map((bike) => (
                <div
                  key={`${bike.year}-${bike.make}-${bike.model}`}
                  className="rounded-xl border border-neutral-200 bg-white p-4"
                >
                  <p className="font-semibold text-neutral-900">
                    {bike.nickname ?? `${bike.year} ${bike.make} ${bike.model}`}
                  </p>
                  {bike.nickname && (
                    <p className="text-sm text-neutral-500">
                      {bike.year} {bike.make} {bike.model}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <p className="mt-6 text-xs text-neutral-400">
          Riding since {formatJoinDate(profile.stats.joinedAt)}
        </p>
      </main>

      {/* CTA footer */}
      <footer className="border-t border-neutral-200 bg-white py-10">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <p className="text-lg font-bold text-neutral-900">Track your rides with MotoVault</p>
          <p className="mt-1 text-sm text-neutral-500">
            AI-powered motorcycle maintenance, diagnostics & ride tracking
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <a
              href="https://apps.apple.com/app/motovault/id6745417382"
              className="inline-flex items-center rounded-xl bg-neutral-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
            >
              Download on iOS
            </a>
            <a
              href="https://play.google.com/store/apps/details?id=com.motovault.app"
              className="inline-flex items-center rounded-xl border border-neutral-300 bg-white px-6 py-3 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-50"
            >
              Get on Android
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
