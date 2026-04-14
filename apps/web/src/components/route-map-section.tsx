'use client';

import dynamic from 'next/dynamic';

const MapHeroInteractive = dynamic(
  () => import('./map-hero-interactive').then((m) => m.MapHeroInteractive),
  { ssr: false, loading: () => <MapPlaceholder /> },
);

function MapPlaceholder() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-neutral-900 text-neutral-600">
      <div className="flex items-center gap-2">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-600 border-t-amber-500" />
        <span className="text-sm">Loading map…</span>
      </div>
    </div>
  );
}

interface RouteMapSectionProps {
  polyline: [number, number][];
}

export function RouteMapSection({ polyline }: RouteMapSectionProps) {
  if (polyline.length === 0) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-2xl bg-neutral-900 text-neutral-600 lg:h-[500px]">
        <p className="text-sm">No route data available</p>
      </div>
    );
  }

  return (
    <div className="h-[400px] w-full overflow-hidden rounded-2xl lg:h-[500px]">
      <MapHeroInteractive polyline={polyline} />
    </div>
  );
}
