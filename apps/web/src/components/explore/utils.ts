import type { TripTemplateNode } from '@/lib/fetch-places';

export function tripHref(trip: TripTemplateNode): string {
  if (trip.slug && trip.countryCode && trip.regionCode) {
    return `/trips/${trip.countryCode}/${trip.regionCode}/${trip.slug}`;
  }
  return `/trips/${trip.id}`;
}

export function formatDistance(meters: number): string {
  const km = meters / 1000;
  return km >= 100 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`;
}

export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null) return '';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function surfaceLabel(s: string | null | undefined): string {
  switch (s) {
    case 'paved':
      return 'Paved';
    case 'mixed':
      return 'Mixed';
    case 'off-road':
      return 'Off-Road';
    default:
      return '';
  }
}

export function difficultyKind(d: string): 'Easy' | 'Moderate' | 'Hard' | 'Expert' {
  switch (d) {
    case 'expert':
      return 'Expert';
    case 'challenging':
      return 'Hard';
    case 'moderate':
      return 'Moderate';
    default:
      return 'Easy';
  }
}

export function difficultyLabel(d: string): string {
  switch (d) {
    case 'easy':
      return 'Easy';
    case 'moderate':
      return 'Moderate';
    case 'challenging':
      return 'Hard';
    case 'expert':
      return 'Expert';
    default:
      return d;
  }
}

export function applyFilters(
  trips: TripTemplateNode[],
  params: URLSearchParams,
): TripTemplateNode[] {
  let result = [...trips];

  const difficulty = params.get('difficulty');
  if (difficulty) result = result.filter((t) => t.difficulty === difficulty);

  const surface = params.get('surface');
  if (surface) result = result.filter((t) => t.surfaceType === surface);

  const sort = params.get('sort') ?? 'rating';
  switch (sort) {
    case 'distance':
      result.sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0));
      break;
    case 'newest':
      result.sort((a, b) => {
        const da = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const db = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        return db - da;
      });
      break;
    default:
      result.sort((a, b) => (b.averageRating ?? 0) - (a.averageRating ?? 0));
  }

  return result;
}
