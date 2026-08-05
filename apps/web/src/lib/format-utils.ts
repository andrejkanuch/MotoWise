/** Convert meters to a human-friendly distance string */
export function formatDistance(meters: number): string {
  const km = meters / 1000;
  if (km >= 1000) return `${(km / 1000).toFixed(1)}k km`;
  return `${km.toFixed(1)} km`;
}

/** Convert seconds to a compact "Xh Ym" duration string */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours >= 1) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

/** Convert m/s to km/h as a formatted string */
export function formatSpeed(mps: number): string {
  return `${Math.round(mps * 3.6)} km/h`;
}

/** Format an ISO date string as "Month Day, Year" */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
