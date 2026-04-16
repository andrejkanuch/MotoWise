import {
  buildAppleMapsUrl,
  buildGoogleMapsUrls,
  buildWazeUrls,
  chunkWaypointsForGoogle,
  GOOGLE_MAX_POINTS_PER_URL,
  type NavWaypoint,
  segmentCountForProvider,
} from '../nav-handoff';

const wp = (lat: number, lng: number, name?: string): NavWaypoint => ({ lat, lng, name });

const range = (n: number): NavWaypoint[] =>
  Array.from({ length: n }, (_, i) => wp(40 + i * 0.01, -74 - i * 0.01, `Stop ${i + 1}`));

describe('buildAppleMapsUrl', () => {
  it('returns null for fewer than 2 waypoints', () => {
    expect(buildAppleMapsUrl([])).toBeNull();
    expect(buildAppleMapsUrl([wp(1, 2)])).toBeNull();
  });

  it('builds a simple saddr/daddr URL for 2 waypoints', () => {
    const url = buildAppleMapsUrl([wp(40.7, -74.0), wp(40.8, -74.1)]);
    expect(url).toBe('maps://?saddr=40.7,-74&daddr=40.8,-74.1&dirflg=d');
  });

  it('chains +to: for 3+ waypoints on iOS 16+', () => {
    const url = buildAppleMapsUrl(
      [wp(40.7, -74.0), wp(40.8, -74.1), wp(40.9, -74.2), wp(41, -74.3)],
      { iosMajorVersion: 17 },
    );
    expect(url).toBe('maps://?saddr=40.7,-74&daddr=40.8,-74.1+to:40.9,-74.2+to:41,-74.3&dirflg=d');
  });

  it('falls back to first→last on iOS < 16', () => {
    const url = buildAppleMapsUrl([wp(40.7, -74.0), wp(40.8, -74.1), wp(40.9, -74.2)], {
      iosMajorVersion: 15,
    });
    expect(url).toBe('maps://?saddr=40.7,-74&daddr=40.9,-74.2&dirflg=d');
  });

  it('rounds coordinates to 6 decimals for URL sanity', () => {
    const url = buildAppleMapsUrl([wp(40.1234567891, -74.987654321), wp(41, -74)]);
    expect(url).toContain('saddr=40.123457,-74.987654');
  });
});

describe('chunkWaypointsForGoogle', () => {
  it('returns a single chunk when at or under the limit', () => {
    expect(chunkWaypointsForGoogle(range(1))).toHaveLength(1);
    expect(chunkWaypointsForGoogle(range(GOOGLE_MAX_POINTS_PER_URL))).toHaveLength(1);
    expect(chunkWaypointsForGoogle(range(GOOGLE_MAX_POINTS_PER_URL))[0]).toHaveLength(
      GOOGLE_MAX_POINTS_PER_URL,
    );
  });

  it('chunks with 1-point overlap beyond the limit', () => {
    const chunks = chunkWaypointsForGoogle(range(14));
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(10);
    expect(chunks[1]).toHaveLength(5);
    // Invariant: last of chunk N equals first of chunk N+1 (no teleport).
    expect(chunks[0][chunks[0].length - 1]).toBe(chunks[1][0]);
  });

  it('chunks across multiple overlaps', () => {
    const chunks = chunkWaypointsForGoogle(range(25));
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < chunks.length - 1; i++) {
      expect(chunks[i][chunks[i].length - 1]).toBe(chunks[i + 1][0]);
    }
    // Union of all chunks (de-duped by identity) equals the input.
    const seen = new Set<NavWaypoint>();
    for (const c of chunks) for (const w of c) seen.add(w);
    expect(seen.size).toBe(25);
  });
});

describe('buildGoogleMapsUrls', () => {
  it('returns empty for <2 waypoints', () => {
    expect(buildGoogleMapsUrls([])).toEqual({ urls: [], chunked: false });
    expect(buildGoogleMapsUrls([wp(1, 2)])).toEqual({ urls: [], chunked: false });
  });

  it('builds one URL for <=10 waypoints, no chunking', () => {
    const { urls, chunked } = buildGoogleMapsUrls(range(3));
    expect(urls).toHaveLength(1);
    expect(chunked).toBe(false);
    expect(urls[0]).toContain('origin=40%2C-74');
    expect(urls[0]).toContain('destination=40.02%2C-74.02');
    expect(urls[0]).toContain('waypoints=40.01%2C-74.01');
    expect(urls[0]).toContain('travelmode=driving');
  });

  it('omits waypoints param when only origin+destination', () => {
    const { urls } = buildGoogleMapsUrls(range(2));
    expect(urls[0]).not.toContain('waypoints=');
  });

  it('returns multiple URLs for >10 waypoints with chunked=true', () => {
    const { urls, chunked } = buildGoogleMapsUrls(range(14));
    expect(urls).toHaveLength(2);
    expect(chunked).toBe(true);
  });
});

describe('buildWazeUrls', () => {
  it('returns empty for <2 waypoints', () => {
    expect(buildWazeUrls([])).toEqual([]);
    expect(buildWazeUrls([wp(1, 2)])).toEqual([]);
  });

  it('produces one Waze URL per destination after the first waypoint', () => {
    const urls = buildWazeUrls(range(4));
    expect(urls).toHaveLength(3);
    expect(urls[0]).toBe('waze://?ll=40.01,-74.01&navigate=yes');
    expect(urls[2]).toBe('waze://?ll=40.03,-74.03&navigate=yes');
  });
});

describe('segmentCountForProvider', () => {
  it('returns 1 for apple + gpx regardless of waypoint count', () => {
    expect(segmentCountForProvider('apple', range(20))).toBe(1);
    expect(segmentCountForProvider('gpx', range(2))).toBe(1);
  });

  it('returns 0 when waypoints are insufficient', () => {
    expect(segmentCountForProvider('apple', range(1))).toBe(0);
    expect(segmentCountForProvider('waze', range(1))).toBe(0);
  });

  it('returns the google chunk count', () => {
    expect(segmentCountForProvider('google', range(14))).toBe(2);
    expect(segmentCountForProvider('google', range(5))).toBe(1);
  });

  it('returns n-1 for waze', () => {
    expect(segmentCountForProvider('waze', range(7))).toBe(6);
  });
});
