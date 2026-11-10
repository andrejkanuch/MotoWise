import { describe, expect, it } from 'vitest';
import { isValidIanaZone, localTimeFields, resolveTimeZone } from './time-zone';

describe('isValidIanaZone', () => {
  it('accepts IANA names and rejects offsets and junk', () => {
    expect(isValidIanaZone('Europe/Madrid')).toBe(true);
    expect(isValidIanaZone('America/Argentina/Buenos_Aires')).toBe(true);
    expect(isValidIanaZone('UTC')).toBe(true);
    expect(isValidIanaZone('GMT+1')).toBe(false);
    expect(isValidIanaZone('+01:00')).toBe(false);
    expect(isValidIanaZone('Europe/Atlantis')).toBe(false);
    expect(isValidIanaZone('')).toBe(false);
    expect(isValidIanaZone(null)).toBe(false);
  });
});

describe('resolveTimeZone', () => {
  const madrid = { lat: 40.4168, lng: -3.7038 };

  it("uses the ride's own zone when it is valid", () => {
    expect(resolveTimeZone({ rideZone: 'Europe/Lisbon', start: madrid, riderZone: null })).toBe(
      'Europe/Lisbon',
    );
  });

  it('falls back to the start point for an invalid stored zone', () => {
    expect(resolveTimeZone({ rideZone: 'GMT+1', start: madrid, riderZone: 'Asia/Tokyo' })).toBe(
      'Europe/Madrid',
    );
  });

  it("falls back to the rider's latest zone, then UTC, without a start point", () => {
    expect(resolveTimeZone({ rideZone: null, start: null, riderZone: 'Asia/Tokyo' })).toBe(
      'Asia/Tokyo',
    );
    expect(resolveTimeZone({ rideZone: null, start: null, riderZone: 'bogus' })).toBe('UTC');
  });
});

describe('localTimeFields', () => {
  it("gives the date, hour and ISO weekday in the ride's zone", () => {
    // 2026-06-06 is a Saturday; 23:30 UTC is 01:30 on Sunday in Madrid (UTC+2).
    expect(localTimeFields('2026-06-06T23:30:00Z', 'Europe/Madrid')).toEqual({
      localDate: '2026-06-07',
      localStartHour: 1,
      localDow: 7,
    });
    expect(localTimeFields('2026-06-08T00:15:00Z', 'UTC')).toEqual({
      localDate: '2026-06-08',
      localStartHour: 0,
      localDow: 1,
    });
  });
});
