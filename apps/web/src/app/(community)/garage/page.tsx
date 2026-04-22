'use client';

import { MyMotorcyclesDocument } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import { Bike, Calendar, CircleDollarSign, Gauge, PenTool, Settings, Wrench } from 'lucide-react';
import Image from 'next/image';
import { useEffect } from 'react';
import { SaveRouteButton } from '@/components/save-route-button';
import { trackEvent, WebEvent } from '@/lib/analytics';
import { gqlFetcher } from '@/lib/graphql-client';

const SAVED_ROUTES_QUERY = /* GraphQL */ `
  query SavedRoutes($first: Int) {
    savedRoutes(first: $first) {
      edges {
        node {
          id
          name
          distanceM
          elevationGainM
          surfaceType
          ratingAvg
          ratingCount
          slug
          countryCode
          regionCode
        }
        cursor
      }
      pageInfo {
        hasNextPage
      }
    }
  }
` as never;

export default function GaragePage() {
  useEffect(() => {
    trackEvent(WebEvent.GARAGE_VIEWED);
  }, []);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['garage', 'motorcycles'],
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
  });

  const bikes = data?.myMotorcycles ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-warm-500 border-t-transparent" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
          <Settings className="h-8 w-8 text-red-400" />
        </div>
        <p className="text-lg text-neutral-300">Failed to load garage</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-4 rounded-full bg-warm-500 px-6 py-2.5 text-sm font-semibold text-neutral-950 transition-colors hover:bg-warm-400"
        >
          Retry
        </button>
      </div>
    );
  }

  if (bikes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-warm-500/10">
          <Bike className="h-8 w-8 text-warm-400" />
        </div>
        <h2 className="text-xl font-bold text-neutral-50">No bikes yet</h2>
        <p className="mt-2 max-w-sm text-neutral-400">
          Add your first motorcycle in the MotoVault mobile app to see it here.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-8 text-2xl font-bold text-neutral-50">My Garage</h1>

      {/* Saved Routes */}
      <SavedRoutesSection />

      <h2 className="mb-4 mt-12 text-lg font-semibold text-neutral-200">Motorcycles</h2>

      <div className="flex flex-col gap-6">
        {bikes.map((bike) => (
          <div
            key={bike.id}
            className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/50"
          >
            {/* Bike header with photo */}
            <div className="flex flex-col sm:flex-row">
              {/* Photo */}
              <div className="relative h-48 w-full bg-neutral-800 sm:h-auto sm:w-64 flex-shrink-0">
                {bike.primaryPhotoUrl ? (
                  <Image
                    src={bike.primaryPhotoUrl}
                    alt={bike.nickname || `${bike.year} ${bike.make} ${bike.model}`}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Bike className="h-16 w-16 text-neutral-600" />
                  </div>
                )}
              </div>

              {/* Bike info */}
              <div className="flex-1 p-6">
                <div className="flex items-start justify-between">
                  <div>
                    {bike.nickname && (
                      <h2 className="text-xl font-bold text-neutral-50">{bike.nickname}</h2>
                    )}
                    <p
                      className={`${bike.nickname ? 'text-neutral-400' : 'text-xl font-bold text-neutral-50'}`}
                    >
                      {bike.year} {bike.make} {bike.model}
                    </p>
                  </div>
                  {bike.isPrimary && (
                    <span className="rounded-full bg-warm-500/15 px-3 py-1 text-xs font-medium text-warm-400">
                      Primary
                    </span>
                  )}
                </div>

                {/* Stats grid */}
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {bike.currentMileage != null && (
                    <div className="flex items-center gap-2 text-sm text-neutral-400">
                      <Gauge className="h-4 w-4 text-neutral-500" />
                      <span>
                        {bike.currentMileage.toLocaleString()} {bike.mileageUnit ?? 'km'}
                      </span>
                    </div>
                  )}
                  {bike.type && (
                    <div className="flex items-center gap-2 text-sm text-neutral-400">
                      <PenTool className="h-4 w-4 text-neutral-500" />
                      <span className="capitalize">{bike.type.replace('_', ' ')}</span>
                    </div>
                  )}
                  {bike.purchaseDate && (
                    <div className="flex items-center gap-2 text-sm text-neutral-400">
                      <Calendar className="h-4 w-4 text-neutral-500" />
                      <span>
                        Since{' '}
                        {new Date(bike.purchaseDate).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action buttons — coming soon */}
            <div className="border-t border-neutral-800 px-6 py-4">
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled
                  className="flex items-center gap-2 rounded-xl border border-neutral-700 px-4 py-2.5 text-sm text-neutral-500 opacity-60 cursor-not-allowed"
                >
                  <Wrench className="h-4 w-4" />
                  Add Maintenance
                  <span className="ml-1 rounded-full bg-neutral-800 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
                    Soon
                  </span>
                </button>
                <button
                  type="button"
                  disabled
                  className="flex items-center gap-2 rounded-xl border border-neutral-700 px-4 py-2.5 text-sm text-neutral-500 opacity-60 cursor-not-allowed"
                >
                  <CircleDollarSign className="h-4 w-4" />
                  Log Expense
                  <span className="ml-1 rounded-full bg-neutral-800 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
                    Soon
                  </span>
                </button>
                <button
                  type="button"
                  disabled
                  className="flex items-center gap-2 rounded-xl border border-neutral-700 px-4 py-2.5 text-sm text-neutral-500 opacity-60 cursor-not-allowed"
                >
                  <Settings className="h-4 w-4" />
                  Bike Settings
                  <span className="ml-1 rounded-full bg-neutral-800 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
                    Soon
                  </span>
                </button>
              </div>
              <p className="mt-3 text-xs text-neutral-600">
                Manage your bikes in full on the MotoVault mobile app. Web management coming soon.
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Saved Routes Section ────────────────────────────────────────

interface SavedRoute {
  id: string;
  name?: string;
  distanceM: number;
  elevationGainM?: number;
  surfaceType?: string;
  ratingAvg?: number;
  ratingCount: number;
  slug?: string;
  countryCode?: string;
  regionCode?: string;
}

function SavedRoutesSection() {
  const { data, isLoading } = useQuery({
    queryKey: ['garage', 'saved-routes'],
    queryFn: () =>
      gqlFetcher<
        {
          savedRoutes: {
            edges: Array<{ node: SavedRoute; cursor: string }>;
            pageInfo: { hasNextPage: boolean };
          };
        },
        { first: number }
      >(SAVED_ROUTES_QUERY, { first: 20 }),
  });

  const routes = data?.savedRoutes?.edges?.map((e) => e.node) ?? [];

  if (isLoading) {
    return (
      <div>
        <h2 className="mb-4 text-lg font-semibold text-neutral-200">Saved Routes</h2>
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-800 border-t-neutral-400" />
      </div>
    );
  }

  if (routes.length === 0) {
    return (
      <div>
        <h2 className="mb-3 text-lg font-semibold text-neutral-200">Saved Routes</h2>
        <p className="text-sm text-neutral-500">
          No saved routes yet.{' '}
          <a
            href="/explore"
            className="text-neutral-300 underline underline-offset-2 hover:text-white"
          >
            Explore routes
          </a>{' '}
          and tap the heart to save them here.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-200">Saved Routes</h2>
        <a
          href="/explore"
          className="text-sm text-neutral-500 transition-colors hover:text-neutral-300"
        >
          Browse more
        </a>
      </div>
      <div className="divide-y divide-neutral-800/30">
        {routes.map((route) => {
          const href =
            route.countryCode && route.regionCode && route.slug
              ? `/route/${route.countryCode.toLowerCase()}/${route.regionCode.toLowerCase()}/${route.slug}`
              : `/routes/${route.id}`;
          return (
            <div key={route.id} className="flex items-center justify-between py-3">
              <a href={href} className="group min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-200 transition-colors group-hover:text-white">
                  {route.name ?? 'Unnamed Route'}
                </p>
                <p className="mt-0.5 flex gap-x-3 text-xs text-neutral-500">
                  {route.distanceM > 0 && <span>{(route.distanceM / 1000).toFixed(1)} km</span>}
                  {route.elevationGainM != null && <span>{Math.round(route.elevationGainM)}m</span>}
                  {route.ratingAvg != null && <span>★ {route.ratingAvg.toFixed(1)}</span>}
                </p>
              </a>
              <SaveRouteButton routeId={route.id} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
