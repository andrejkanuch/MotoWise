import {
  decodePolyline,
  decodePolylineLatLng,
  encodePolyline,
  simplifyEncodedPolyline,
} from '../polyline';

// Classic Google-encoded polyline example from the reference doc.
const CANONICAL = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';
const CANONICAL_LATLNG: [number, number][] = [
  [38.5, -120.2],
  [40.7, -120.95],
  [43.252, -126.453],
];

describe('encodePolyline', () => {
  it('encodes [lat, lng] pairs to the canonical string', () => {
    expect(encodePolyline(CANONICAL_LATLNG)).toBe(CANONICAL);
  });

  it('returns empty string for empty input', () => {
    expect(encodePolyline([])).toBe('');
  });
});

describe('decodePolylineLatLng', () => {
  it('decodes to [lat, lng] pairs', () => {
    expect(decodePolylineLatLng(CANONICAL)).toEqual(CANONICAL_LATLNG);
  });

  it('round-trips with encodePolyline', () => {
    const points: [number, number][] = [
      [48.8566, 2.3522],
      [51.5074, -0.1278],
      [40.7128, -74.006],
    ];
    expect(decodePolylineLatLng(encodePolyline(points))).toEqual(points);
  });
});

describe('decodePolyline', () => {
  // GeoJSON order — this is what trip-detail's map preview consumes.
  it('decodes to [lng, lat] pairs (GeoJSON order)', () => {
    expect(decodePolyline(CANONICAL)).toEqual([
      [-120.2, 38.5],
      [-120.95, 40.7],
      [-126.453, 43.252],
    ]);
  });

  it('is the coordinate-flipped twin of decodePolylineLatLng', () => {
    const lngLat = decodePolyline(CANONICAL);
    const latLng = decodePolylineLatLng(CANONICAL);
    expect(lngLat).toEqual(latLng.map(([lat, lng]) => [lng, lat]));
  });

  it('returns empty array for empty input', () => {
    expect(decodePolyline('')).toEqual([]);
  });
});

describe('simplifyEncodedPolyline', () => {
  it('returns the input unchanged when already at or below maxPoints', () => {
    const encoded = encodePolyline(CANONICAL_LATLNG);
    expect(simplifyEncodedPolyline(encoded, 3)).toBe(encoded);
    expect(simplifyEncodedPolyline(encoded, 10)).toBe(encoded);
  });

  it('downsamples to maxPoints while preserving first and last', () => {
    const dense: [number, number][] = Array.from({ length: 20 }, (_, i) => [
      48 + i * 0.01,
      2 + i * 0.01,
    ]);
    const simplified = decodePolylineLatLng(simplifyEncodedPolyline(encodePolyline(dense), 5));
    expect(simplified).toHaveLength(5);
    expect(simplified[0]).toEqual(dense[0]);
    expect(simplified[simplified.length - 1]).toEqual(dense[dense.length - 1]);
  });
});
