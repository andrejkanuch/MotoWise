export function formatSegmentDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatSegmentDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h === 0) return `${m} min`;
  return `${h}h ${m}m`;
}

export function formatDayDate(startDate: Date, dayIndex: number): string {
  const d = new Date(startDate);
  d.setDate(d.getDate() + dayIndex);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

let tempIdCounter = 0;
export function tempId(): string {
  tempIdCounter += 1;
  return `tmp_${Date.now()}_${tempIdCounter}`;
}
