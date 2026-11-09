import { describe, expect, it } from 'vitest';
import { decodePolyline, encodePolyline } from './polyline';

// Google's documented example: (38.5, -120.2), (40.7, -120.95), (43.252, -126.453).
// Both decoders this replaced (fuel stops, trip GPX export) returned exactly these
// points for this string, and an empty list for ''.
const GOOGLE_EXAMPLE = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';
const GOOGLE_POINTS = [
  { lat: 38.5, lng: -120.2 },
  { lat: 40.7, lng: -120.95 },
  { lat: 43.252, lng: -126.453 },
];

describe('decodePolyline', () => {
  it('decodes the documented example', () => {
    expect(decodePolyline(GOOGLE_EXAMPLE)).toEqual(GOOGLE_POINTS);
  });

  it('returns an empty list for an empty string', () => {
    expect(decodePolyline('')).toEqual([]);
  });
});

describe('encodePolyline', () => {
  it('encodes the documented example', () => {
    expect(encodePolyline(GOOGLE_POINTS)).toBe(GOOGLE_EXAMPLE);
  });

  it('rounds to 5 decimals and round-trips', () => {
    const encoded = encodePolyline([
      { lat: 42.4651234, lng: -2.4456789 },
      { lat: 42.4659, lng: -2.44 },
    ]);
    expect(decodePolyline(encoded)).toEqual([
      { lat: 42.46512, lng: -2.44568 },
      { lat: 42.4659, lng: -2.44 },
    ]);
  });
});
