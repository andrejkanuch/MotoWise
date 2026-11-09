import tzLookup from '@photostructure/tz-lookup';
import type { LatLng } from '../../../common/polyline';

const FALLBACK_ZONE = 'UTC';
/** Area/Location names (or plain UTC). Offsets like "GMT+1" or "+01:00" are not IANA names. */
const IANA_SHAPE = /^(?:UTC|[A-Za-z]+(?:\/[A-Za-z0-9_+-]+)+)$/;

/** Whether a client-sent zone is a real IANA zone this runtime knows. */
export function isValidIanaZone(zone: string | null | undefined): zone is string {
  if (!zone || !IANA_SHAPE.test(zone)) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

function zoneAt(point: LatLng): string | null {
  try {
    const zone = tzLookup(point.lat, point.lng);
    return isValidIanaZone(zone) ? zone : null;
  } catch {
    return null;
  }
}

/**
 * The zone a ride's local time is read in: the ride's own (device) zone when it
 * is valid, else the start point's, else the rider's latest known zone, else UTC.
 */
export function resolveTimeZone(input: {
  rideZone: string | null;
  start: LatLng | null;
  riderZone: string | null;
}): string {
  if (isValidIanaZone(input.rideZone)) return input.rideZone;
  const fromStart = input.start ? zoneAt(input.start) : null;
  if (fromStart) return fromStart;
  if (isValidIanaZone(input.riderZone)) return input.riderZone;
  return FALLBACK_ZONE;
}

const ISO_DOW: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export interface LocalTimeFields {
  /** YYYY-MM-DD in the zone. */
  localDate: string;
  localStartHour: number;
  /** ISO weekday, 1 = Monday. */
  localDow: number;
}

export function localTimeFields(startedAt: string, zone: string): LocalTimeFields {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
      weekday: 'short',
    })
      .formatToParts(new Date(startedAt))
      .map((p) => [p.type, p.value]),
  );
  return {
    localDate: `${parts.year}-${parts.month}-${parts.day}`,
    localStartHour: Number(parts.hour),
    localDow: ISO_DOW[parts.weekday],
  };
}
