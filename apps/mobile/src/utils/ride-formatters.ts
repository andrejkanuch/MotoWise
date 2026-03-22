/**
 * Shared formatting utilities for rides and measurements.
 * All data is stored in metric (meters, m/s, celsius, bar) in the database.
 * Conversion to imperial is display-only, controlled by the user's MeasurementSystem preference.
 */

import type { MeasurementSystem } from '@motovault/types';

/** Check if the system uses imperial units */
function isImperial(system: MeasurementSystem): boolean {
  return system === 'imperial';
}

// ─── Distance ────────────────────────────────────────────────────────────────

/** Convert meters to display distance with unit suffix */
export function formatDistance(meters: number, system: MeasurementSystem = 'metric'): string {
  if (isImperial(system)) {
    const miles = meters / 1609.34;
    return miles < 10 ? `${miles.toFixed(1)} mi` : `${Math.round(miles)} mi`;
  }
  const km = meters / 1000;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

/** Format distance as a number string (no unit suffix) */
export function formatDistanceValue(meters: number, system: MeasurementSystem = 'metric'): string {
  if (isImperial(system)) {
    const miles = meters / 1609.34;
    return miles < 10 ? miles.toFixed(1) : String(Math.round(miles));
  }
  const km = meters / 1000;
  return km < 10 ? km.toFixed(1) : String(Math.round(km));
}

/** Get the distance unit label */
export function distanceUnitLabel(system: MeasurementSystem = 'metric'): string {
  return isImperial(system) ? 'mi' : 'km';
}

// ─── Speed ───────────────────────────────────────────────────────────────────

/** Convert meters/second to display speed with unit */
export function formatSpeed(mps: number, system: MeasurementSystem = 'metric'): string {
  if (isImperial(system)) {
    return `${Math.round(mps * 2.237)} mph`;
  }
  return `${Math.round(mps * 3.6)} km/h`;
}

/** Convert m/s to display speed as a number (no unit) */
export function formatSpeedValue(mps: number, system: MeasurementSystem = 'metric'): number {
  return isImperial(system) ? Math.round(mps * 2.237) : Math.round(mps * 3.6);
}

/** Get the speed unit label */
export function speedUnitLabel(system: MeasurementSystem = 'metric'): string {
  return isImperial(system) ? 'mph' : 'km/h';
}

// ─── Elevation ───────────────────────────────────────────────────────────────

/** Format elevation in feet or meters */
export function formatElevation(meters: number, system: MeasurementSystem = 'metric'): string {
  if (isImperial(system)) {
    return `${Math.round(meters * 3.281)} ft`;
  }
  return `${Math.round(meters)} m`;
}

// ─── Time ────────────────────────────────────────────────────────────────────

/** Format duration from seconds */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Format elapsed time as HH:MM:SS */
export function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

// ─── Date ────────────────────────────────────────────────────────────────────

/** Format date relatively */
export function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Format date for display */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Format full date with weekday */
export function formatFullDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Format time */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
