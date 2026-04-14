import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchProfile } from '../../../../lib/fetch-profile';
import { fetchSavedRoutes } from '../../../../lib/fetch-saved-routes';
import { formatDistance } from '../../../../lib/format-utils';
import { SavedRoutesClient } from './saved-routes-client';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const profile = await fetchProfile(handle);
  if (!profile) return { title: 'User Not Found' };

  const displayName = profile.displayName ?? profile.publicUsername;
  const title = `Saved Routes by ${displayName} (@${profile.publicUsername})`;
  const description = `Browse motorcycle routes saved by ${displayName} on MotoVault. Discover scenic rides, twisty roads, and epic adventures.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      url: `https://motovault.app/u/${profile.publicUsername}/saved`,
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

export default async function SavedRoutesPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const profile = await fetchProfile(handle);

  if (!profile) {
    notFound();
  }

  const savedRoutes = await fetchSavedRoutes(handle);

  if (!savedRoutes) {
    return <EmptyState handle={profile.publicUsername} />;
  }

  const { edges, pageInfo } = savedRoutes;

  if (edges.length === 0) {
    return <EmptyState handle={profile.publicUsername} />;
  }

  return (
    <div>
      <h2 className="mb-6 text-lg font-bold text-neutral-900">
        Saved Routes
        <span className="ml-2 text-sm font-normal text-neutral-500">
          by @{profile.publicUsername}
        </span>
      </h2>

      {/* Route cards grid */}
      <div className="grid gap-3 sm:grid-cols-2">
        {edges.map(({ node }) => (
          <RouteCard key={node.id} route={node} />
        ))}
      </div>

      {/* Infinite scroll client component */}
      {pageInfo.hasNextPage && (
        <SavedRoutesClient handle={handle} initialEndCursor={pageInfo.endCursor} />
      )}

      {/* Soft-wall overlay for unauthenticated users */}
      <SoftWallOverlay />
    </div>
  );
}

function RouteCard({
  route,
}: {
  route: {
    id: string;
    name?: string;
    distanceM: number;
    elevationGainM?: number;
    surfaceType?: string;
    isMotovaultPick: boolean;
    ratingAvg?: number;
    ratingCount: number;
    commentCount: number;
    contributor: {
      displayName: string;
      publicUsername?: string;
    };
  };
}) {
  const surfaceLabel =
    route.surfaceType === 'paved'
      ? 'Paved'
      : route.surfaceType === 'mixed'
        ? 'Mixed'
        : route.surfaceType === 'off-road'
          ? 'Off-road'
          : null;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 transition-shadow hover:shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2">
        <svg
          className="h-4 w-4 shrink-0 text-blue-600"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          aria-hidden="true"
        >
          <title>Route</title>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z"
          />
        </svg>
        <h3 className="flex-1 truncate text-sm font-semibold text-neutral-900">
          {route.name ?? 'Unnamed Route'}
        </h3>
        {route.isMotovaultPick && (
          <span className="shrink-0 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
            Pick
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-neutral-600">
        <span className="font-medium">{formatDistance(route.distanceM)}</span>

        {(route.elevationGainM ?? 0) > 0 && (
          <span>{Math.round(route.elevationGainM ?? 0)}m elev.</span>
        )}

        {surfaceLabel && <span>{surfaceLabel}</span>}

        {route.ratingAvg != null && route.ratingCount > 0 && (
          <span className="flex items-center gap-1">
            <svg
              className="h-3 w-3 text-amber-500"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <title>Rating</title>
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            {route.ratingAvg.toFixed(1)} ({route.ratingCount})
          </span>
        )}

        {route.commentCount > 0 && <span>{route.commentCount} reviews</span>}
      </div>

      {/* Contributor */}
      <p className="mt-2 text-xs text-neutral-400">
        by {route.contributor.displayName}
        {route.contributor.publicUsername ? ` @${route.contributor.publicUsername}` : ''}
      </p>
    </div>
  );
}

function EmptyState({ handle }: { handle: string }) {
  return (
    <div className="py-16 text-center">
      <svg
        className="mx-auto h-12 w-12 text-neutral-300"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        aria-hidden="true"
      >
        <title>No saved routes</title>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z"
        />
      </svg>
      <h3 className="mt-4 text-sm font-semibold text-neutral-900">No saved routes</h3>
      <p className="mt-1 text-sm text-neutral-500">@{handle} hasn&apos;t saved any routes yet.</p>
    </div>
  );
}

function SoftWallOverlay() {
  return (
    <div className="pointer-events-none relative mt-8">
      {/* Gradient fade */}
      <div className="absolute inset-x-0 -top-24 h-24 bg-gradient-to-t from-neutral-50 to-transparent" />

      {/* CTA */}
      <div className="pointer-events-auto rounded-xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <p className="text-base font-semibold text-neutral-900">Want to discover more routes?</p>
        <p className="mt-1 text-sm text-neutral-500">
          Download MotoVault to browse, save, and navigate routes on your rides.
        </p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <a
            href="https://apps.apple.com/us/app/motovault/id6760291360"
            className="inline-flex items-center rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
          >
            Download on iOS
          </a>
          <a
            href="https://play.google.com/store/apps/details?id=com.motovault.app"
            className="inline-flex items-center rounded-xl border border-neutral-300 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-50"
          >
            Get on Android
          </a>
        </div>
      </div>
    </div>
  );
}
